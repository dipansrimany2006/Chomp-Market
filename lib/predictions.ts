export interface Prediction {
  id: string;
  title: string;
  category: string;
  options: string[];           // Custom options array
  odds: number[];              // Percentage odds per option
  priceChange: number;
  volume: string;
  endDate: string;
  isHot?: boolean;
  imageUrl?: string;
  description?: string;
  contractAddress?: string;
  winningOptions?: boolean[];  // Which options won (if resolved)
  creatorAddress?: string;     // Creator's wallet address
  createdAt?: string;          // Creation timestamp
  status?: 'active' | 'resolved' | 'cancelled';  // Market status
  isOpen?: boolean;            // Whether market is open for betting (from blockchain)
}

// API Poll response type - Updated for custom options
export interface PollFromAPI {
  _id: string;
  question: string;
  category: string;
  options: string[];           // Required array of options
  odds?: number[];             // Optional odds array
  yesPrice?: number;           // Legacy field
  noPrice?: number;            // Legacy field
  totalVolume: number;
  pollEnd: string;
  resolutionCriteria: string;
  status: 'active' | 'resolved' | 'cancelled';
  createdAt: string;
  image?: string;
  contractAddress?: string;
  winningOptionIndices?: number[];
  creatorWalletAddress?: string;
}

// Transform API poll to Prediction format
export function transformPollToPrediction(poll: PollFromAPI): Prediction {
  const endDate = new Date(poll.pollEnd);
  const formattedDate = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Format volume
  const formatVolume = (vol: number): string => {
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(0)}K`;
    return `$${vol}`;
  };

  // Get options - use poll.options or fallback to legacy Yes/No
  const options = poll.options && poll.options.length > 0
    ? poll.options
    : ['Yes', 'No'];

  // Get odds - use poll.odds, calculate from legacy fields, or default to equal odds
  let odds: number[];
  if (poll.odds && poll.odds.length > 0) {
    odds = poll.odds;
  } else if (poll.yesPrice !== undefined && poll.noPrice !== undefined) {
    // Legacy: convert yesPrice/noPrice to odds array
    odds = [poll.yesPrice, poll.noPrice];
  } else {
    // Default: equal odds for all options
    odds = options.map(() => 100 / options.length);
  }

  // Calculate price change (difference from equal odds for first option)
  const equalOdds = 100 / options.length;
  const priceChange = odds[0] - equalOdds;

  // Calculate winning options array from indices
  let winningOptions: boolean[] | undefined;
  if (poll.winningOptionIndices && poll.winningOptionIndices.length > 0) {
    winningOptions = options.map((_, index) =>
      poll.winningOptionIndices!.includes(index)
    );
  }

  return {
    id: poll._id,
    title: poll.question,
    category: poll.category,
    options,
    odds,
    priceChange,
    volume: formatVolume(poll.totalVolume),
    endDate: formattedDate,
    isHot: poll.totalVolume > 1000,
    description: poll.resolutionCriteria,
    imageUrl: poll.image,
    contractAddress: poll.contractAddress,
    winningOptions,
    creatorAddress: poll.creatorWalletAddress,
    createdAt: poll.createdAt,
    status: poll.status,
  };
}
