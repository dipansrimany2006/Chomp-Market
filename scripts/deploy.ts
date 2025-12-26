import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Deploying Prediction Market Contracts");
  console.log("(Using Native MNT for betting)");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "MNT");

  if (balance === 0n) {
    throw new Error("Deployer has no balance. Please fund your wallet first.");
  }

  // Deploy Factory (no collateral token needed - uses native MNT)
  console.log("\n[1/2] Deploying PredictionMarketFactory...");
  const Factory = await ethers.getContractFactory("PredictionMarketFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("✓ PredictionMarketFactory deployed to:", factoryAddress);

  // Create a sample market (only on testnet/local)
  let sampleMarketAddress = "";
  if (network.name !== "mantle") {
    console.log("\n[2/2] Creating sample prediction market...");
    const oneWeek = 7 * 24 * 60 * 60;
    const endTime = Math.floor(Date.now() / 1000) + oneWeek;

    // Custom options for the sample market
    const sampleOptions = ["Yes, above $150K", "No, below $150K"];

    const tx = await factory.createMarket(
      "Will BTC reach $150,000 by end of 2025?",
      endTime,
      sampleOptions
    );
    const receipt = await tx.wait();

    // Get market address from logs
    const marketCreatedEvent = receipt?.logs.find((log) => {
      try {
        const parsed = factory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        return parsed?.name === "MarketCreated";
      } catch {
        return false;
      }
    });

    if (marketCreatedEvent) {
      const parsed = factory.interface.parseLog({
        topics: marketCreatedEvent.topics as string[],
        data: marketCreatedEvent.data,
      });
      sampleMarketAddress = parsed?.args[0];
      console.log("✓ Sample market created at:", sampleMarketAddress);
    }
  } else {
    console.log("\n[2/2] Skipping sample market creation on mainnet");
  }

  // Print deployment summary
  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Network:           ", network.name);
  console.log("Chain ID:          ", network.config.chainId);
  console.log("Deployer:          ", deployer.address);
  console.log("----------------------------------------");
  console.log("Collateral:         Native MNT");
  console.log("Factory:           ", factoryAddress);
  if (sampleMarketAddress) {
    console.log("Sample Market:     ", sampleMarketAddress);
  }
  console.log("========================================");

  // Print explorer links
  const explorerUrl = network.name === "mantle"
    ? "https://mantlescan.xyz"
    : network.name === "mantleSepolia"
      ? "https://sepolia.mantlescan.xyz"
      : null;

  if (explorerUrl) {
    console.log("\nView on Explorer:");
    console.log(`Factory: ${explorerUrl}/address/${factoryAddress}`);
    if (sampleMarketAddress) {
      console.log(`Sample Market: ${explorerUrl}/address/${sampleMarketAddress}`);
    }
  }

  // Save deployment addresses to file
  const fs = await import("fs");
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    collateral: "Native MNT",
    contracts: {
      factory: factoryAddress,
      sampleMarket: sampleMarketAddress || null,
    },
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(
    `${deploymentsDir}/${network.name}.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\n✓ Deployment info saved to deployments/${network.name}.json`);

  // Print update reminder
  console.log("\n========================================");
  console.log("NEXT STEPS");
  console.log("========================================");
  console.log("Update lib/contracts.ts with:");
  console.log(`  FACTORY: '${factoryAddress}',`);
  if (sampleMarketAddress) {
    console.log(`  SAMPLE_MARKET: '${sampleMarketAddress}',`);
  }
  console.log("========================================");

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  });
