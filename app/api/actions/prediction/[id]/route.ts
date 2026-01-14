import { createAction, button, input, createNextHandler } from '@dipansrimany/mlink-sdk';
import connectDB from '@/lib/db.connection';
import Poll from '@/model/poll.model';
import { ethers } from 'ethers';
import { MARKET_ABI } from '@/lib/contracts';

// Define the poll type based on the model
interface PollDocument {
  _id: string;
  question: string;
  category: string;
  resolutionCriteria: string;
  resolutionSource?: string;
  image?: string;
  options: string[];
  winningOptionIndices: number[];
  pollEnd: Date;
  odds?: number[];
  totalVolume: number;
  totalTrades: number;
  status: string;
  contractAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to extract poll ID from URL
function extractPollId(url: string): string {
  const parts = url.split('/');
  // URL format: /api/actions/prediction/[id]
  return parts[parts.length - 1].split('?')[0];
}

// Create the action handler
const createPredictionAction = async (req: Request) => {
  const pollId = extractPollId(req.url);

  await connectDB();
  const poll = await Poll.findById(pollId).lean() as PollDocument | null;

  if (!poll) {
    throw new Error('Prediction market not found');
  }

  if (!poll.contractAddress) {
    throw new Error('This market is not deployed on-chain yet');
  }

  // Build action buttons from poll options
  const actionButtons = poll.options.map((option: string, index: number) =>
    button({
      label: `${option} (${poll.odds?.[index]?.toFixed(0) || '50'}%)`,
      value: `option_${index}`,
      disabled: poll.status !== 'active'
    })
  );

  // Add custom amount input
  actionButtons.push(
    input({
      label: 'Amount (MNT)',
      placeholder: '0.1',
    })
  );

  // Format end date
  const endDate = new Date(poll.pollEnd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return createAction({
    title: poll.question,
    icon: poll.image || 'https://prediction-market-tau.vercel.app/logo.png',
    description: `${poll.resolutionCriteria || 'Predict the outcome'} | Ends: ${endDate}`,
    actions: actionButtons,
    handler: async ({ account, action, input: inputAmount }) => {
      // Parse which option was selected
      let optionIndex = 0;
      if (action?.startsWith('option_')) {
        optionIndex = parseInt(action.split('_')[1]);
      }

      // Default amount or use custom input (default 0.1 MNT)
      const amount = inputAmount || '0.1';
      const amountWei = ethers.parseEther(amount);

      // Encode the buyShares function call
      const iface = new ethers.Interface(MARKET_ABI);
      const data = iface.encodeFunctionData('buyShares', [optionIndex]);

      const optionLabel = poll.options[optionIndex] || `Option ${optionIndex + 1}`;

      return {
        transaction: {
          to: poll.contractAddress!,
          value: `0x${amountWei.toString(16)}`, // MNT amount in hex
          data: data,
          chainId: 5003, // Mantle Sepolia
        },
        message: `Buying ${amount} MNT of "${optionLabel}" shares on "${poll.question}"`
      };
    }
  });
};

// Export the handlers using createNextHandler
export const { GET, POST, OPTIONS } = createNextHandler(createPredictionAction);
