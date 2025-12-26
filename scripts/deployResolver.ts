import { ethers, network } from "hardhat";

// UMA Optimistic Oracle V2 addresses by network
// Reference: https://docs.uma.xyz/resources/network-addresses
const UMA_ORACLE_ADDRESSES: Record<string, string> = {
  // Mainnets
  mainnet: "0xA0Ae6609447e57a42c51B50EAe921D701823FFAe",      // Ethereum Mainnet
  polygon: "0xee3afe347d5c74317041e2618c49534daf887c24",      // Polygon
  arbitrum: "0x88Ad27C41AD06f01153E7Cd9b10cBEdF4616f4d5",     // Arbitrum One
  optimism: "0x255483434aba5a75dc60c1391bB162BCd9DE2B78",     // Optimism
  base: "0x2aBf1Bd76655de80eDB3086114315Eec75AF500c",        // Base

  // Testnets
  sepolia: "0xA0Ae6609447e57a42c51B50EAe921D701823FFAe",      // Sepolia
  goerli: "0xA5B9d8a0B0Fa04Ba71BDD68069661ED5C0848884",       // Goerli (deprecated)

  // For local testing - will use a mock
  hardhat: "",
  localhost: "",
};

// Common bond currencies by network (WETH or USDC)
const BOND_CURRENCIES: Record<string, { address: string; name: string }> = {
  mainnet: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", name: "WETH" },
  polygon: { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", name: "WETH" },
  arbitrum: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", name: "WETH" },
  optimism: { address: "0x4200000000000000000000000000000000000006", name: "WETH" },
  base: { address: "0x4200000000000000000000000000000000000006", name: "WETH" },
  sepolia: { address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", name: "WETH" },
  goerli: { address: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6", name: "WETH" },
};

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("========================================");
  console.log("Deploying UMA Market Resolver");
  console.log("========================================");
  console.log("Deployer:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Check if UMA is supported on this network
  const oracleAddress = UMA_ORACLE_ADDRESSES[network.name];
  const bondCurrencyInfo = BOND_CURRENCIES[network.name];

  if (!oracleAddress && network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n⚠️  WARNING: UMA Protocol is not officially deployed on", network.name);
    console.log("   Supported networks: Ethereum, Polygon, Arbitrum, Optimism, Base, Sepolia");
    console.log("\n   Options:");
    console.log("   1. Deploy on a supported network");
    console.log("   2. Use manual resolution (creator resolves markets)");
    console.log("   3. Deploy a mock oracle for testing purposes");

    // For Mantle, we can still deploy the resolver with custom addresses
    console.log("\n   If you want to proceed with custom addresses:");
    console.log("   npx hardhat run scripts/deployResolver.ts --network <network>");
    console.log("   Set environment variables: UMA_ORACLE_ADDRESS and BOND_CURRENCY_ADDRESS");

    // Check for custom addresses from environment
    const customOracle = process.env.UMA_ORACLE_ADDRESS;
    const customBond = process.env.BOND_CURRENCY_ADDRESS;

    if (!customOracle || !customBond) {
      throw new Error(
        `UMA not supported on ${network.name}. Set UMA_ORACLE_ADDRESS and BOND_CURRENCY_ADDRESS env vars to use custom addresses.`
      );
    }

    console.log("\n   Using custom addresses from environment variables...");
  }

  let finalOracleAddress = oracleAddress || process.env.UMA_ORACLE_ADDRESS || "";
  let finalBondCurrency = bondCurrencyInfo?.address || process.env.BOND_CURRENCY_ADDRESS || "";
  let bondCurrencyName = bondCurrencyInfo?.name || "Custom Token";

  // For local testing, deploy mocks
  if (network.name === "hardhat" || network.name === "localhost") {
    console.log("\n[1/4] Deploying Mock Oracle for local testing...");

    // Deploy a mock oracle
    const MockOracle = await ethers.getContractFactory("MockOptimisticOracle");
    const mockOracle = await MockOracle.deploy();
    await mockOracle.waitForDeployment();
    finalOracleAddress = await mockOracle.getAddress();
    console.log("✓ Mock Oracle deployed to:", finalOracleAddress);

    // Deploy a mock bond currency
    console.log("\n[2/4] Deploying Mock Bond Currency...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockBond = await MockERC20.deploy("Mock WETH", "mWETH", 18);
    await mockBond.waitForDeployment();
    finalBondCurrency = await mockBond.getAddress();
    bondCurrencyName = "Mock WETH";
    console.log("✓ Mock Bond Currency deployed to:", finalBondCurrency);
  } else {
    console.log("\n[1/4] Using UMA Oracle at:", finalOracleAddress);
    console.log("[2/4] Using Bond Currency (" + bondCurrencyName + "):", finalBondCurrency);
  }

  // Deploy the resolver
  console.log("\n[3/4] Deploying UMAMarketResolver...");
  const Resolver = await ethers.getContractFactory("UMAMarketResolver");
  const resolver = await Resolver.deploy(finalOracleAddress, finalBondCurrency);
  await resolver.waitForDeployment();
  const resolverAddress = await resolver.getAddress();
  console.log("✓ UMAMarketResolver deployed to:", resolverAddress);

  // Try to set resolver on factory if deployment exists
  console.log("\n[4/4] Configuring Factory (if exists)...");
  const fs = await import("fs");
  const deploymentPath = `./deployments/${network.name}.json`;

  if (fs.existsSync(deploymentPath)) {
    try {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
      const factoryAddress = deployment.contracts.factory;

      if (factoryAddress) {
        const factory = await ethers.getContractAt("PredictionMarketFactory", factoryAddress);
        const tx = await factory.setDefaultResolver(resolverAddress);
        await tx.wait();
        console.log("✓ Set resolver on factory:", factoryAddress);

        // Update deployment file
        deployment.contracts.resolver = resolverAddress;
        deployment.contracts.umaOracle = finalOracleAddress;
        deployment.contracts.bondCurrency = finalBondCurrency;
        fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
        console.log("✓ Updated deployment file");
      }
    } catch (error: any) {
      console.log("⚠️  Could not configure factory:", error.message);
    }
  } else {
    console.log("⚠️  No factory deployment found. Configure manually:");
    console.log(`   factory.setDefaultResolver("${resolverAddress}")`);
  }

  // Print summary
  console.log("\n========================================");
  console.log("DEPLOYMENT SUMMARY");
  console.log("========================================");
  console.log("Network:           ", network.name);
  console.log("Chain ID:          ", network.config.chainId);
  console.log("----------------------------------------");
  console.log("UMA Oracle:        ", finalOracleAddress);
  console.log("Bond Currency:     ", finalBondCurrency, `(${bondCurrencyName})`);
  console.log("Resolver:          ", resolverAddress);
  console.log("========================================");

  // Print usage instructions
  console.log("\n📖 USAGE INSTRUCTIONS");
  console.log("========================================");
  console.log("1. After market ends, anyone can request resolution:");
  console.log(`   resolver.requestResolution(marketAddress)`);
  console.log("");
  console.log("2. Wait for liveness period (2 hours default)");
  console.log("   - Proposers submit answers with bond");
  console.log("   - Disputers can challenge incorrect answers");
  console.log("");
  console.log("3. After liveness, settle and resolve:");
  console.log(`   resolver.settleAndResolve(marketAddress)`);
  console.log("========================================");

  return {
    resolver: resolverAddress,
    oracle: finalOracleAddress,
    bondCurrency: finalBondCurrency,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error.message);
    process.exit(1);
  });
