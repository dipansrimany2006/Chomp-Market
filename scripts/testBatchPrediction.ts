import { ethers, network } from "hardhat";

/**
 * Test script to verify BatchPrediction contract works correctly
 * Run with: npx hardhat run scripts/testBatchPrediction.ts --network mantleSepolia
 */

const BATCH_PREDICTION_ADDRESS = "0x4CE81DB827E2D53a97E57a7A4F4097de976B9f0A";

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Testing BatchPrediction Contract");
  console.log("========================================");
  console.log("Signer:", signer.address);
  console.log("Network:", network.name);

  // Get BatchPrediction contract
  const batchPrediction = await ethers.getContractAt(
    [
      "function batchPredictSimple(address[] markets, uint8[] optionIndices, uint256[] amounts) payable",
      "function validatePredictions(address[] markets, uint256[] amounts) view returns (bool[] valid, uint256 totalAmount)",
    ],
    BATCH_PREDICTION_ADDRESS,
    signer
  );

  // Test market address - replace with an actual active market
  const testMarketAddress = process.env.TEST_MARKET_ADDRESS || "0x08c7deb5a5cfa2d028e0dbb5010e55cd9b15707d";

  if (!testMarketAddress) {
    console.log("\nNo TEST_MARKET_ADDRESS provided.");
    console.log("Please set TEST_MARKET_ADDRESS environment variable to test.");
    console.log("\nExample:");
    console.log("  TEST_MARKET_ADDRESS=0x... npx hardhat run scripts/testBatchPrediction.ts --network mantleSepolia");
    return;
  }

  console.log("\nTest market:", testMarketAddress);

  // Get market contract to check status
  const market = await ethers.getContractAt(
    [
      "function isOpenForBetting() view returns (bool)",
      "function endTime() view returns (uint256)",
      "function marketStatus() view returns (uint8)",
      "function optionCount() view returns (uint8)",
      "function question() view returns (string)",
    ],
    testMarketAddress,
    signer
  );

  // Check market status
  console.log("\n--- Market Status ---");
  try {
    const question = await market.question();
    const isOpen = await market.isOpenForBetting();
    const endTime = await market.endTime();
    const status = await market.marketStatus();
    const optionCount = await market.optionCount();

    const now = Math.floor(Date.now() / 1000);
    const endTimeNum = Number(endTime);

    console.log("Question:", question);
    console.log("Is Open:", isOpen);
    console.log("Status:", Number(status), "(0=Active, 1=Resolved, 2=Cancelled)");
    console.log("Option Count:", Number(optionCount));
    console.log("End Time:", new Date(endTimeNum * 1000).toISOString());
    console.log("Current Time:", new Date(now * 1000).toISOString());
    console.log("Time Remaining:", endTimeNum - now, "seconds");
    console.log("Is Expired:", now >= endTimeNum);

    if (!isOpen) {
      console.log("\n❌ Market is NOT open for betting. Cannot test.");
      return;
    }

    // Validate predictions
    console.log("\n--- Validate Predictions ---");
    const markets = [testMarketAddress];
    const amounts = [ethers.parseEther("0.01")]; // 0.01 MNT

    const validation = await batchPrediction.validatePredictions(markets, amounts);
    console.log("Valid:", validation.valid);
    console.log("Total Amount:", ethers.formatEther(validation.totalAmount), "MNT");

    if (!validation.valid[0]) {
      console.log("\n❌ Market failed validation");
      return;
    }

    // Try to estimate gas for batch prediction
    console.log("\n--- Estimate Gas ---");
    const optionIndices = [0]; // Bet on first option

    try {
      const gasEstimate = await batchPrediction.batchPredictSimple.estimateGas(
        markets,
        optionIndices,
        amounts,
        { value: amounts[0] }
      );
      console.log("✓ Gas estimate:", gasEstimate.toString());

      // Ask if user wants to execute
      console.log("\n✓ Transaction would succeed!");
      console.log("To execute, uncomment the execution code in this script.");

      // Execute the transaction
      console.log("\n--- Execute Transaction ---");
      const tx = await batchPrediction.batchPredictSimple(
        markets,
        optionIndices,
        amounts,
        { value: amounts[0] }
      );
      console.log("TX Hash:", tx.hash);
      await tx.wait();
      console.log("✓ Transaction confirmed!");

    } catch (err: unknown) {
      console.log("❌ Gas estimation failed:");
      const error = err as Error;
      console.log(error.message);

      // Try to get more details
      if ('data' in error) {
        console.log("Error data:", (error as { data?: string }).data);
      }
    }

  } catch (err) {
    console.error("Error checking market:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
