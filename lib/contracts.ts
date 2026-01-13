import { ethers } from 'ethers';

// Contract addresses on Mantle Sepolia (Native MNT version)
export const CONTRACTS = {
  FACTORY: '0xF79884A18E7eeDD24d55f1A3BbA745Eb646Fd7f8',
  SAMPLE_MARKET: '0xa1504E28Af39CdB48f36AE86582663Fa3DF3777b',
  BATCH_PREDICTION: '0x4CE81DB827E2D53a97E57a7A4F4097de976B9f0A',
} as const;

// Chain configuration
export const MANTLE_SEPOLIA = {
  chainId: 5003,
  name: 'Mantle Sepolia',
  rpcUrl: 'https://rpc.sepolia.mantle.xyz',
  blockExplorer: 'https://sepolia.mantlescan.xyz',
  currency: {
    name: 'MNT',
    symbol: 'MNT',
    decimals: 18,
  },
};

// PredictionMarketFactory ABI - Uses native MNT
export const FACTORY_ABI = [
  'function createMarket(string _question, uint256 _endTime, string[] _options) returns (address marketAddress)',
  'function getTotalMarkets() view returns (uint256)',
  'function getAllMarkets() view returns (address[])',
  'function getMarketsByCreator(address creator) view returns (address[])',
  'function getMarketsPaginated(uint256 offset, uint256 limit) view returns (address[] markets, uint256 total)',
  'function getActiveMarkets() view returns (address[])',
  'function isValidMarket(address) view returns (bool)',
  'function owner() view returns (address)',
  'function defaultResolver() view returns (address)',
  'event MarketCreated(address indexed marketAddress, address indexed creator, string question, uint256 endTime, string[] options)',
];

// PredictionMarket ABI - Uses native MNT for betting
export const MARKET_ABI = [
  // View functions
  'function creator() view returns (address)',
  'function resolver() view returns (address)',
  'function question() view returns (string)',
  'function endTime() view returns (uint256)',
  'function createdAt() view returns (uint256)',
  'function marketStatus() view returns (uint8)',
  'function optionCount() view returns (uint8)',
  'function optionLabels(uint256) view returns (string)',
  'function winningOptions(uint256) view returns (bool)',
  'function hasWinners() view returns (bool)',
  'function totalShares(uint256) view returns (uint256)',
  'function shares(address, uint8) view returns (uint256)',
  'function hasClaimed(address) view returns (bool)',
  'function getMarketInfo() view returns (address _creator, string _question, uint256 _endTime, uint256 _createdAt, uint8 _status, uint8 _optionCount, string[] _optionLabels, uint256[] _totalShares, bool[] _winningOptions, uint256 _totalPool)',
  'function getUserPosition(address user) view returns (uint256[] _shares, bool _hasClaimed)',
  'function getOdds() view returns (uint256[])',
  'function getTotalPool() view returns (uint256)',
  'function getContractBalance() view returns (uint256)',
  'function getTimeRemaining() view returns (uint256)',
  'function isOpenForBetting() view returns (bool)',
  'function getOptionLabel(uint8 index) view returns (string)',
  'function getOptionLabels() view returns (string[])',
  'function getTotalShares() view returns (uint256[])',
  'function getWinningOptions() view returns (bool[])',
  'function getOptionPrice(uint8 optionIndex) view returns (uint256)',
  'function calculatePotentialPayout(address user, uint8[] winnerIndices) view returns (uint256)',
  'function calculateSellPayout(uint8 optionIndex, uint256 sharesAmount) view returns (uint256 payout)',
  'function getUserShares(address user, uint8 optionIndex) view returns (uint256)',
  // Write functions - buyShares is now payable (send MNT with transaction)
  'function buyShares(uint8 optionIndex) payable',
  'function sellShares(uint8 optionIndex, uint256 sharesAmount)',
  'function resolveMarket(uint8[] winnerIndices)',
  'function claimWinnings()',
  'function claimRefund()',
  'function cancelMarket()',
  // Events
  'event MarketCreated(address indexed creator, string question, uint256 endTime, string[] options)',
  'event SharesBought(address indexed buyer, uint8 optionIndex, uint256 amount)',
  'event SharesSold(address indexed seller, uint8 optionIndex, uint256 sharesAmount, uint256 payout)',
  'event MarketResolved(uint8[] winnerIndices, uint256 totalPool)',
  'event MarketCancelled(address indexed cancelledBy)',
  'event Claimed(address indexed user, uint256 payout)',
  'event Refunded(address indexed user, uint256 amount)',
];

// BatchPrediction ABI - For multi-market predictions in a single transaction
export const BATCH_PREDICTION_ABI = [
  // Write functions
  'function batchPredict((address market, uint8 optionIndex, uint256 amount)[] predictions) payable',
  'function batchPredictSimple(address[] markets, uint8[] optionIndices, uint256[] amounts) payable',
  // View functions
  'function validatePredictions(address[] markets, uint256[] amounts) view returns (bool[] valid, uint256 totalAmount)',
  'function owner() view returns (address)',
  // Events
  'event BatchPredictionExecuted(address indexed user, uint256 totalAmount, uint256 marketsCount)',
  'event PredictionPlaced(address indexed user, address indexed market, uint8 optionIndex, uint256 amount)',
  'event PredictionFailed(address indexed user, address indexed market, uint8 optionIndex, uint256 amount, string reason)',
];

// Market status enum
export enum MarketStatus {
  Active = 0,
  Resolved = 1,
  Cancelled = 2,
}

// Market info type - Updated for custom options
export interface MarketInfo {
  address: string;
  creator: string;
  question: string;
  endTime: number;
  createdAt: number;
  status: MarketStatus;
  optionCount: number;
  optionLabels: string[];
  totalShares: bigint[];
  winningOptions: boolean[];
  totalPool: bigint;
  odds: number[]; // Percentage odds per option (0-100)
  isOpen: boolean;
}

// User position type - Updated for custom options
export interface UserPosition {
  shares: bigint[]; // Shares per option
  hasClaimed: boolean;
}

// Helper function to get provider
export function getProvider() {
  return new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
}

// Helper function to get factory contract (read-only)
export function getFactoryContract(providerOrSigner?: ethers.Provider | ethers.Signer) {
  const provider = providerOrSigner || getProvider();
  return new ethers.Contract(CONTRACTS.FACTORY, FACTORY_ABI, provider);
}

// Helper function to get market contract (read-only)
export function getMarketContract(address: string, providerOrSigner?: ethers.Provider | ethers.Signer) {
  const provider = providerOrSigner || getProvider();
  return new ethers.Contract(address, MARKET_ABI, provider);
}

// Fetch market info from contract - Updated for custom options
export async function fetchMarketInfo(marketAddress: string): Promise<MarketInfo> {
  const market = getMarketContract(marketAddress);

  const [info, odds, isOpen] = await Promise.all([
    market.getMarketInfo(),
    market.getOdds(),
    market.isOpenForBetting(),
  ]);

  // Convert odds from basis points (10000 = 100%) to percentage
  const oddsPercentage = (odds as bigint[]).map((o: bigint) => Number(o) / 100);

  return {
    address: marketAddress,
    creator: info._creator,
    question: info._question,
    endTime: Number(info._endTime),
    createdAt: Number(info._createdAt),
    status: Number(info._status) as MarketStatus,
    optionCount: Number(info._optionCount),
    optionLabels: info._optionLabels as string[],
    totalShares: info._totalShares as bigint[],
    winningOptions: info._winningOptions as boolean[],
    totalPool: info._totalPool,
    odds: oddsPercentage,
    isOpen,
  };
}

// Fetch user position from contract - Updated for custom options
export async function fetchUserPosition(marketAddress: string, userAddress: string): Promise<UserPosition> {
  const market = getMarketContract(marketAddress);
  const position = await market.getUserPosition(userAddress);

  return {
    shares: position._shares as bigint[],
    hasClaimed: position._hasClaimed,
  };
}

// Fetch all markets from factory
export async function fetchAllMarkets(): Promise<string[]> {
  const factory = getFactoryContract();
  return await factory.getAllMarkets();
}

// Fetch active markets from factory
export async function fetchActiveMarkets(): Promise<string[]> {
  const factory = getFactoryContract();
  return await factory.getActiveMarkets();
}

// Format token amount (assumes 18 decimals)
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  return ethers.formatUnits(amount, decimals);
}

// Parse token amount (assumes 18 decimals)
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  return ethers.parseUnits(amount, decimals);
}
