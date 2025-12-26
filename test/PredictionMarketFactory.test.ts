import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { PredictionMarketFactory, PredictionMarket, MockERC20 } from "../typechain-types";

describe("PredictionMarketFactory", function () {
  let factory: PredictionMarketFactory;
  let mockToken: MockERC20;
  let alternateToken: MockERC20;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  const ONE_WEEK = 7 * 24 * 60 * 60;

  async function deployFactory() {
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20Factory.deploy("Test Token", "TEST", 18);
    await mockToken.waitForDeployment();

    alternateToken = await MockERC20Factory.deploy("Alternate Token", "ALT", 18);
    await alternateToken.waitForDeployment();

    const FactoryFactory = await ethers.getContractFactory("PredictionMarketFactory");
    factory = await FactoryFactory.deploy(await mockToken.getAddress());
    await factory.waitForDeployment();

    return { factory, mockToken, alternateToken };
  }

  before(async function () {
    [owner, alice, bob] = await ethers.getSigners();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      await deployFactory();

      expect(await factory.owner()).to.equal(owner.address);
      expect(await factory.defaultCollateralToken()).to.equal(await mockToken.getAddress());
      expect(await factory.getTotalMarkets()).to.equal(0);
    });

    it("Should reject deployment with zero address token", async function () {
      const FactoryFactory = await ethers.getContractFactory("PredictionMarketFactory");
      await expect(
        FactoryFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(FactoryFactory, "InvalidToken");
    });
  });

  describe("Creating Markets", function () {
    beforeEach(async function () {
      await deployFactory();
    });

    it("Should create a market with default token", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;
      const question = "Will BTC reach $100k?";

      const tx = await factory.connect(alice).createMarket(question, endTime, ethers.ZeroAddress);
      const receipt = await tx.wait();

      // Get market address from event
      const event = receipt?.logs.find((log) => {
        try {
          return factory.interface.parseLog({ topics: log.topics as string[], data: log.data })?.name === "MarketCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;

      expect(await factory.getTotalMarkets()).to.equal(1);
      expect(await factory.isValidMarket(await factory.allMarkets(0))).to.equal(true);
    });

    it("Should create a market with custom token", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;
      const question = "Custom token market?";

      await factory.connect(alice).createMarket(question, endTime, await alternateToken.getAddress());

      const marketAddress = await factory.allMarkets(0);
      const market = await ethers.getContractAt("PredictionMarket", marketAddress) as PredictionMarket;

      expect(await market.collateralToken()).to.equal(await alternateToken.getAddress());
    });

    it("Should track markets by creator", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;

      await factory.connect(alice).createMarket("Question 1", endTime, ethers.ZeroAddress);
      await factory.connect(alice).createMarket("Question 2", endTime, ethers.ZeroAddress);
      await factory.connect(bob).createMarket("Question 3", endTime, ethers.ZeroAddress);

      const aliceMarkets = await factory.getMarketsByCreator(alice.address);
      const bobMarkets = await factory.getMarketsByCreator(bob.address);

      expect(aliceMarkets.length).to.equal(2);
      expect(bobMarkets.length).to.equal(1);
    });

    it("Should reject market with empty question", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;

      await expect(
        factory.createMarket("", endTime, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidQuestion");
    });

    it("Should reject market with past end time", async function () {
      const pastTime = (await time.latest()) - 1000;

      await expect(
        factory.createMarket("Valid question", pastTime, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidEndTime");
    });

    it("Should use createMarketSimple correctly", async function () {
      const endTime = (await time.latest()) + ONE_WEEK;

      await factory.connect(alice).createMarketSimple("Simple market", endTime);

      expect(await factory.getTotalMarkets()).to.equal(1);
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      await deployFactory();

      const endTime = (await time.latest()) + ONE_WEEK;

      // Create multiple markets
      for (let i = 0; i < 5; i++) {
        await factory.connect(alice).createMarket(`Question ${i}`, endTime, ethers.ZeroAddress);
      }
    });

    it("Should return all markets", async function () {
      const markets = await factory.getAllMarkets();
      expect(markets.length).to.equal(5);
    });

    it("Should return paginated markets", async function () {
      const [markets, total] = await factory.getMarketsPaginated(1, 2);

      expect(markets.length).to.equal(2);
      expect(total).to.equal(5n);
    });

    it("Should handle pagination beyond total", async function () {
      const [markets, total] = await factory.getMarketsPaginated(10, 5);

      expect(markets.length).to.equal(0);
      expect(total).to.equal(5n);
    });

    it("Should return active markets", async function () {
      // All 5 should be active initially
      let activeMarkets = await factory.getActiveMarkets();
      expect(activeMarkets.length).to.equal(5);

      // Resolve one market (alice is the creator since she created them)
      await time.increase(ONE_WEEK + 1);

      const marketAddress = await factory.allMarkets(0);
      const market = await ethers.getContractAt("PredictionMarket", marketAddress) as PredictionMarket;
      await market.connect(alice).resolveMarket(1); // Resolve as YES - alice is the creator

      activeMarkets = await factory.getActiveMarkets();
      expect(activeMarkets.length).to.equal(4);
    });
  });

  describe("Admin Functions", function () {
    beforeEach(async function () {
      await deployFactory();
    });

    it("Should allow owner to update default token", async function () {
      await factory.setDefaultCollateralToken(await alternateToken.getAddress());

      expect(await factory.defaultCollateralToken()).to.equal(await alternateToken.getAddress());
    });

    it("Should reject token update from non-owner", async function () {
      await expect(
        factory.connect(alice).setDefaultCollateralToken(await alternateToken.getAddress())
      ).to.be.revertedWithCustomError(factory, "NotOwner");
    });

    it("Should reject zero address token update", async function () {
      await expect(
        factory.setDefaultCollateralToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidToken");
    });

    it("Should allow ownership transfer", async function () {
      await factory.transferOwnership(alice.address);

      expect(await factory.owner()).to.equal(alice.address);
    });

    it("Should reject ownership transfer to zero address", async function () {
      await expect(
        factory.transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidToken");
    });

    it("Should reject ownership transfer from non-owner", async function () {
      await expect(
        factory.connect(alice).transferOwnership(bob.address)
      ).to.be.revertedWithCustomError(factory, "NotOwner");
    });
  });

  describe("Integration with PredictionMarket", function () {
    it("Should create functional markets through factory", async function () {
      await deployFactory();

      const endTime = (await time.latest()) + ONE_WEEK;
      await factory.connect(alice).createMarket("Integration test", endTime, ethers.ZeroAddress);

      const marketAddress = await factory.allMarkets(0);
      const market = await ethers.getContractAt("PredictionMarket", marketAddress) as PredictionMarket;

      // Mint and approve tokens
      await mockToken.mint(bob.address, ethers.parseEther("100"));
      await mockToken.connect(bob).approve(marketAddress, ethers.MaxUint256);

      // Buy shares
      await market.connect(bob).buyYes(ethers.parseEther("50"));

      expect(await market.yesShares(bob.address)).to.equal(ethers.parseEther("50"));
      expect(await market.totalYes()).to.equal(ethers.parseEther("50"));
    });
  });
});
