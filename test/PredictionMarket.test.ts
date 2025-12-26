import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { PredictionMarket, MockERC20 } from "../typechain-types";

describe("PredictionMarket", function () {
  let predictionMarket: PredictionMarket;
  let mockToken: MockERC20;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let charlie: SignerWithAddress;

  const QUESTION = "Will ETH reach $10,000 by end of 2025?";
  const ONE_DAY = 24 * 60 * 60;
  const ONE_WEEK = 7 * ONE_DAY;
  const INITIAL_BALANCE = ethers.parseEther("1000");

  // Helper to deploy fresh contracts
  async function deployContracts(endTimeOffset: number = ONE_WEEK) {
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();

    const endTime = (await time.latest()) + endTimeOffset;

    const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarket");
    predictionMarket = await PredictionMarketFactory.deploy(
      owner.address,
      await mockToken.getAddress(),
      QUESTION,
      endTime
    );
    await predictionMarket.waitForDeployment();

    // Mint tokens to users
    await mockToken.mint(alice.address, INITIAL_BALANCE);
    await mockToken.mint(bob.address, INITIAL_BALANCE);
    await mockToken.mint(charlie.address, INITIAL_BALANCE);

    // Approve market to spend tokens
    const marketAddress = await predictionMarket.getAddress();
    await mockToken.connect(alice).approve(marketAddress, ethers.MaxUint256);
    await mockToken.connect(bob).approve(marketAddress, ethers.MaxUint256);
    await mockToken.connect(charlie).approve(marketAddress, ethers.MaxUint256);

    return { predictionMarket, mockToken, endTime };
  }

  before(async function () {
    [owner, alice, bob, charlie] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      await deployContracts();

      expect(await predictionMarket.creator()).to.equal(owner.address);
      expect(await predictionMarket.question()).to.equal(QUESTION);
      expect(await predictionMarket.marketStatus()).to.equal(0); // Active
      expect(await predictionMarket.totalYes()).to.equal(0);
      expect(await predictionMarket.totalNo()).to.equal(0);
    });

    it("Should reject deployment with past endTime", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20Factory.deploy("Test", "TST", 18);

      const pastTime = (await time.latest()) - ONE_DAY;

      const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarket");
      await expect(
        PredictionMarketFactory.deploy(owner.address, await token.getAddress(), QUESTION, pastTime)
      ).to.be.revertedWithCustomError(PredictionMarketFactory, "InvalidEndTime");
    });

    it("Should reject deployment with zero address token", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;

      const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarket");
      await expect(
        PredictionMarketFactory.deploy(owner.address, ethers.ZeroAddress, QUESTION, endTime)
      ).to.be.revertedWithCustomError(PredictionMarketFactory, "InvalidAmount");
    });

    it("Should reject deployment with empty question", async function () {
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const token = await MockERC20Factory.deploy("Test", "TST", 18);
      const endTime = (await time.latest()) + ONE_WEEK;

      const PredictionMarketFactory = await ethers.getContractFactory("PredictionMarket");
      await expect(
        PredictionMarketFactory.deploy(owner.address, await token.getAddress(), "", endTime)
      ).to.be.revertedWithCustomError(PredictionMarketFactory, "InvalidAmount");
    });
  });

  describe("Buying Shares", function () {
    beforeEach(async function () {
      await deployContracts();
    });

    it("Should allow buying YES shares", async function () {
      const amount = ethers.parseEther("100");

      await expect(predictionMarket.connect(alice).buyYes(amount))
        .to.emit(predictionMarket, "SharesBought")
        .withArgs(alice.address, 1, amount); // 1 = Outcome.Yes

      expect(await predictionMarket.yesShares(alice.address)).to.equal(amount);
      expect(await predictionMarket.totalYes()).to.equal(amount);
    });

    it("Should allow buying NO shares", async function () {
      const amount = ethers.parseEther("100");

      await expect(predictionMarket.connect(bob).buyNo(amount))
        .to.emit(predictionMarket, "SharesBought")
        .withArgs(bob.address, 2, amount); // 2 = Outcome.No

      expect(await predictionMarket.noShares(bob.address)).to.equal(amount);
      expect(await predictionMarket.totalNo()).to.equal(amount);
    });

    it("Should reject zero amount purchases", async function () {
      await expect(
        predictionMarket.connect(alice).buyYes(0)
      ).to.be.revertedWithCustomError(predictionMarket, "InvalidAmount");

      await expect(
        predictionMarket.connect(alice).buyNo(0)
      ).to.be.revertedWithCustomError(predictionMarket, "InvalidAmount");
    });

    it("Should reject purchases after market ends", async function () {
      const amount = ethers.parseEther("100");

      // Fast forward past end time
      await time.increase(ONE_WEEK + 1);

      await expect(
        predictionMarket.connect(alice).buyYes(amount)
      ).to.be.revertedWithCustomError(predictionMarket, "MarketEnded");

      await expect(
        predictionMarket.connect(alice).buyNo(amount)
      ).to.be.revertedWithCustomError(predictionMarket, "MarketEnded");
    });

    it("Should reject purchases without token approval", async function () {
      const amount = ethers.parseEther("100");

      // Revoke approval
      await mockToken.connect(alice).approve(await predictionMarket.getAddress(), 0);

      await expect(
        predictionMarket.connect(alice).buyYes(amount)
      ).to.be.reverted;
    });

    it("Should reject purchases with insufficient balance", async function () {
      const amount = ethers.parseEther("2000"); // More than minted

      await expect(
        predictionMarket.connect(alice).buyYes(amount)
      ).to.be.reverted;
    });

    it("Should allow multiple purchases by same user", async function () {
      const amount1 = ethers.parseEther("50");
      const amount2 = ethers.parseEther("75");

      await predictionMarket.connect(alice).buyYes(amount1);
      await predictionMarket.connect(alice).buyYes(amount2);

      expect(await predictionMarket.yesShares(alice.address)).to.equal(amount1 + amount2);
      expect(await predictionMarket.totalYes()).to.equal(amount1 + amount2);
    });

    it("Should allow user to buy both YES and NO shares", async function () {
      const yesAmount = ethers.parseEther("50");
      const noAmount = ethers.parseEther("30");

      await predictionMarket.connect(alice).buyYes(yesAmount);
      await predictionMarket.connect(alice).buyNo(noAmount);

      expect(await predictionMarket.yesShares(alice.address)).to.equal(yesAmount);
      expect(await predictionMarket.noShares(alice.address)).to.equal(noAmount);
    });
  });

  describe("Market Resolution", function () {
    beforeEach(async function () {
      await deployContracts();

      // Set up some bets
      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));
    });

    it("Should allow creator to resolve market after end time", async function () {
      await time.increase(ONE_WEEK + 1);

      await expect(predictionMarket.resolveMarket(1)) // 1 = Outcome.Yes
        .to.emit(predictionMarket, "MarketResolved")
        .withArgs(1, ethers.parseEther("100"), ethers.parseEther("100"));

      expect(await predictionMarket.marketStatus()).to.equal(1); // Resolved
      expect(await predictionMarket.resolvedOutcome()).to.equal(1); // Yes
    });

    it("Should reject resolution before end time", async function () {
      await expect(
        predictionMarket.resolveMarket(1)
      ).to.be.revertedWithCustomError(predictionMarket, "MarketStillOpen");
    });

    it("Should reject resolution by non-creator", async function () {
      await time.increase(ONE_WEEK + 1);

      await expect(
        predictionMarket.connect(alice).resolveMarket(1)
      ).to.be.revertedWithCustomError(predictionMarket, "NotAuthorized");
    });

    it("Should reject invalid outcome (None)", async function () {
      await time.increase(ONE_WEEK + 1);

      await expect(
        predictionMarket.resolveMarket(0) // 0 = Outcome.None
      ).to.be.revertedWithCustomError(predictionMarket, "InvalidOutcome");
    });

    it("Should reject double resolution", async function () {
      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1);

      await expect(
        predictionMarket.resolveMarket(2)
      ).to.be.revertedWithCustomError(predictionMarket, "MarketNotActive");
    });
  });

  describe("Claiming Winnings - Proportional Payout", function () {
    it("Should pay winners proportionally from total pool (equal bets)", async function () {
      await deployContracts();

      // Alice bets 100 on YES, Bob bets 100 on NO
      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1); // YES wins

      const aliceBalanceBefore = await mockToken.balanceOf(alice.address);

      await predictionMarket.connect(alice).claimWinnings();

      const aliceBalanceAfter = await mockToken.balanceOf(alice.address);

      // Alice should get entire pool (200 tokens)
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("200"));
    });

    it("Should distribute winnings proportionally among multiple winners", async function () {
      await deployContracts();

      // Alice bets 100 on YES, Charlie bets 100 on YES, Bob bets 200 on NO
      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(charlie).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("200"));

      // Total pool = 400
      // YES wins
      // Alice gets: (100 / 200) * 400 = 200
      // Charlie gets: (100 / 200) * 400 = 200

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1); // YES wins

      const aliceBalanceBefore = await mockToken.balanceOf(alice.address);
      const charlieBalanceBefore = await mockToken.balanceOf(charlie.address);

      await predictionMarket.connect(alice).claimWinnings();
      await predictionMarket.connect(charlie).claimWinnings();

      const aliceBalanceAfter = await mockToken.balanceOf(alice.address);
      const charlieBalanceAfter = await mockToken.balanceOf(charlie.address);

      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("200"));
      expect(charlieBalanceAfter - charlieBalanceBefore).to.equal(ethers.parseEther("200"));
    });

    it("Should give nothing to losers", async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1); // YES wins, Bob loses

      await expect(
        predictionMarket.connect(bob).claimWinnings()
      ).to.be.revertedWithCustomError(predictionMarket, "NothingToClaim");
    });

    it("Should reject claim before resolution", async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));

      await expect(
        predictionMarket.connect(alice).claimWinnings()
      ).to.be.revertedWithCustomError(predictionMarket, "MarketNotResolved");
    });

    it("Should reject double claims", async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1);

      await predictionMarket.connect(alice).claimWinnings();

      await expect(
        predictionMarket.connect(alice).claimWinnings()
      ).to.be.revertedWithCustomError(predictionMarket, "AlreadyClaimed");
    });

    it("Should reject claim from non-participant", async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1);

      await expect(
        predictionMarket.connect(charlie).claimWinnings()
      ).to.be.revertedWithCustomError(predictionMarket, "NothingToClaim");
    });

    it("Should handle uneven bet ratios correctly", async function () {
      await deployContracts();

      // Alice bets 300 on YES, Bob bets 100 on NO
      await predictionMarket.connect(alice).buyYes(ethers.parseEther("300"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));

      // Total pool = 400
      // If NO wins, Bob gets all 400

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(2); // NO wins

      const bobBalanceBefore = await mockToken.balanceOf(bob.address);

      await predictionMarket.connect(bob).claimWinnings();

      const bobBalanceAfter = await mockToken.balanceOf(bob.address);

      expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Market Cancellation", function () {
    beforeEach(async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("50"));
    });

    it("Should allow creator to cancel market", async function () {
      await expect(predictionMarket.cancelMarket())
        .to.emit(predictionMarket, "MarketCancelled")
        .withArgs(owner.address);

      expect(await predictionMarket.marketStatus()).to.equal(2); // Cancelled
    });

    it("Should reject cancellation by non-creator", async function () {
      await expect(
        predictionMarket.connect(alice).cancelMarket()
      ).to.be.revertedWithCustomError(predictionMarket, "NotAuthorized");
    });

    it("Should allow refunds after cancellation", async function () {
      await predictionMarket.cancelMarket();

      const aliceBalanceBefore = await mockToken.balanceOf(alice.address);
      const bobBalanceBefore = await mockToken.balanceOf(bob.address);

      await predictionMarket.connect(alice).claimRefund();
      await predictionMarket.connect(bob).claimRefund();

      const aliceBalanceAfter = await mockToken.balanceOf(alice.address);
      const bobBalanceAfter = await mockToken.balanceOf(bob.address);

      // Everyone gets their exact stake back
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("100"));
      expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("50"));
    });

    it("Should reject refund if market not cancelled", async function () {
      await expect(
        predictionMarket.connect(alice).claimRefund()
      ).to.be.revertedWithCustomError(predictionMarket, "MarketNotCancelled");
    });

    it("Should reject double refunds", async function () {
      await predictionMarket.cancelMarket();
      await predictionMarket.connect(alice).claimRefund();

      await expect(
        predictionMarket.connect(alice).claimRefund()
      ).to.be.revertedWithCustomError(predictionMarket, "NothingToRefund");
    });

    it("Should refund user with both YES and NO positions", async function () {
      // Alice buys both sides
      await predictionMarket.connect(alice).buyNo(ethers.parseEther("25"));

      await predictionMarket.cancelMarket();

      const aliceBalanceBefore = await mockToken.balanceOf(alice.address);

      await predictionMarket.connect(alice).claimRefund();

      const aliceBalanceAfter = await mockToken.balanceOf(alice.address);

      // Alice gets back 100 (YES) + 25 (NO) = 125
      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("125"));
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));
    });

    it("Should return correct market info", async function () {
      const info = await predictionMarket.getMarketInfo();

      expect(info._creator).to.equal(owner.address);
      expect(info._question).to.equal(QUESTION);
      expect(info._status).to.equal(0); // Active
      expect(info._totalYes).to.equal(ethers.parseEther("100"));
      expect(info._totalNo).to.equal(ethers.parseEther("100"));
      expect(info._totalPool).to.equal(ethers.parseEther("200"));
    });

    it("Should return correct user position", async function () {
      const position = await predictionMarket.getUserPosition(alice.address);

      expect(position._yesShares).to.equal(ethers.parseEther("100"));
      expect(position._noShares).to.equal(0);
      expect(position._hasClaimed).to.equal(false);
    });

    it("Should calculate potential payout correctly", async function () {
      // Alice has 100 YES shares, total pool is 200
      // If YES wins, Alice gets all 200
      const payout = await predictionMarket.calculatePotentialPayout(alice.address, 1);
      expect(payout).to.equal(ethers.parseEther("200"));

      // If NO wins, Alice gets 0 (she only has YES shares)
      const payoutNo = await predictionMarket.calculatePotentialPayout(alice.address, 2);
      expect(payoutNo).to.equal(0);
    });

    it("Should return correct odds", async function () {
      const odds = await predictionMarket.getOdds();

      // Equal bets, so 50-50 odds (5000 basis points each)
      expect(odds.yesOdds).to.equal(5000n);
      expect(odds.noOdds).to.equal(5000n);
    });

    it("Should return 50-50 odds when no bets placed", async function () {
      await deployContracts(); // Fresh market with no bets

      const odds = await predictionMarket.getOdds();

      expect(odds.yesOdds).to.equal(5000n);
      expect(odds.noOdds).to.equal(5000n);
    });

    it("Should correctly report if market is open for betting", async function () {
      expect(await predictionMarket.isOpenForBetting()).to.equal(true);

      await time.increase(ONE_WEEK + 1);

      expect(await predictionMarket.isOpenForBetting()).to.equal(false);
    });

    it("Should return correct time remaining", async function () {
      const remaining = await predictionMarket.getTimeRemaining();
      expect(remaining).to.be.gt(0);

      await time.increase(ONE_WEEK + 1);

      expect(await predictionMarket.getTimeRemaining()).to.equal(0);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle market with only YES bets", async function () {
      await deployContracts();

      await predictionMarket.connect(alice).buyYes(ethers.parseEther("100"));
      await predictionMarket.connect(charlie).buyYes(ethers.parseEther("100"));
      // No one bets NO

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(1); // YES wins

      // Alice gets her proportional share: (100/200) * 200 = 100
      const aliceBalanceBefore = await mockToken.balanceOf(alice.address);
      await predictionMarket.connect(alice).claimWinnings();
      const aliceBalanceAfter = await mockToken.balanceOf(alice.address);

      expect(aliceBalanceAfter - aliceBalanceBefore).to.equal(ethers.parseEther("100"));
    });

    it("Should handle market with only NO bets when NO wins", async function () {
      await deployContracts();

      await predictionMarket.connect(bob).buyNo(ethers.parseEther("100"));
      // No one bets YES

      await time.increase(ONE_WEEK + 1);
      await predictionMarket.resolveMarket(2); // NO wins

      const bobBalanceBefore = await mockToken.balanceOf(bob.address);
      await predictionMarket.connect(bob).claimWinnings();
      const bobBalanceAfter = await mockToken.balanceOf(bob.address);

      expect(bobBalanceAfter - bobBalanceBefore).to.equal(ethers.parseEther("100"));
    });

    it("Should handle very small bet amounts", async function () {
      await deployContracts();

      const smallAmount = 1n; // 1 wei
      await predictionMarket.connect(alice).buyYes(smallAmount);

      expect(await predictionMarket.yesShares(alice.address)).to.equal(smallAmount);
    });

    it("Should handle very large bet amounts", async function () {
      await deployContracts();

      const largeAmount = ethers.parseEther("999"); // Almost all tokens
      await predictionMarket.connect(alice).buyYes(largeAmount);

      expect(await predictionMarket.yesShares(alice.address)).to.equal(largeAmount);
    });
  });
});
