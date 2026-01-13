import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Deploying BatchPrediction Contract");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Please fund your wallet first.");
  }

  // Deploy BatchPrediction contract
  console.log("\nDeploying BatchPrediction...");
  const BatchPrediction = await ethers.getContractFactory("BatchPrediction");
  const batchPrediction = await BatchPrediction.deploy();
  await batchPrediction.waitForDeployment();
  const batchPredictionAddress = await batchPrediction.getAddress();
  console.log("✓ BatchPrediction deployed to:", batchPredictionAddress);

  // Print deployment summary
  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Network:            ", network.name);
  console.log("Chain ID:           ", network.config.chainId);
  console.log("Deployer:           ", deployer.address);
  console.log("----------------------------------------");
  console.log("BatchPrediction:    ", batchPredictionAddress);
  console.log("========================================");

  // Print explorer links
  const explorerUrl = network.name === "mantle"
    ? "https://mantlescan.xyz"
    : network.name === "mantleSepolia"
      ? "https://sepolia.mantlescan.xyz"
      : null;

  if (explorerUrl) {
    console.log("\nView on Explorer:");
    console.log(`BatchPrediction: ${explorerUrl}/address/${batchPredictionAddress}`);
  }

  // Save deployment address
  const fs = await import("fs");
  const deploymentsDir = "./deployments";

  // Read existing deployment info if exists
  let existingDeployment: Record<string, unknown> = {};
  const deploymentFile = `${deploymentsDir}/${network.name}.json`;
  if (fs.existsSync(deploymentFile)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  }

  // Update with BatchPrediction address
  const deploymentInfo = {
    ...existingDeployment,
    contracts: {
      ...(existingDeployment.contracts as Record<string, unknown> || {}),
      batchPrediction: batchPredictionAddress,
    },
    batchPredictionDeployedAt: new Date().toISOString(),
  };

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n✓ Deployment info saved to ${deploymentFile}`);

  // Print update reminder
  console.log("\n========================================");
  console.log("NEXT STEPS");
  console.log("========================================");
  console.log("Update lib/contracts.ts with:");
  console.log(`  BATCH_PREDICTION: '${batchPredictionAddress}',`);
  console.log("========================================");

  return { batchPrediction: batchPredictionAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  });
