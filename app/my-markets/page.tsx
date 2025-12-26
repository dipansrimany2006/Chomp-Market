'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  Trophy,
} from 'lucide-react';
import { useMarket } from '@/hooks/useContracts';
import { MANTLE_SEPOLIA, MARKET_ABI } from '@/lib/contracts';
import { ethers } from 'ethers';

interface PollData {
  _id: string;
  question: string;
  category: string;
  options: string[];
  odds?: number[];
  totalVolume: number;
  pollEnd: string;
  status: 'active' | 'resolved' | 'cancelled';
  contractAddress?: string;
  winningOptionIndices?: number[];
  createdAt: string;
}

// Color palette for options - theme-aware
const OPTION_COLORS = [
  { bg: 'bg-primary', bgLight: 'bg-primary/20', text: 'text-primary', border: 'border-primary/30' },
  { bg: 'bg-primary/80', bgLight: 'bg-primary/15', text: 'text-primary/80', border: 'border-primary/25' },
  { bg: 'bg-primary/60', bgLight: 'bg-primary/10', text: 'text-primary/60', border: 'border-primary/20' },
  { bg: 'bg-primary/40', bgLight: 'bg-primary/5', text: 'text-primary/40', border: 'border-primary/15' },
];

// Helper to fetch on-chain market info for debugging
interface OnChainDebugInfo {
  endTime: Date;
  blockTime: Date;
  creator: string;
  status: number;
  statusText: string;
  optionCount: number;
}

async function fetchOnChainDebugInfo(contractAddress: string): Promise<OnChainDebugInfo | null> {
  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
    const market = new ethers.Contract(contractAddress, MARKET_ABI, provider);

    const [endTimeUnix, creator, status, optionCount, blockNumber] = await Promise.all([
      market.endTime(),
      market.creator(),
      market.marketStatus(),
      market.optionCount(),
      provider.getBlockNumber(),
    ]);

    const block = await provider.getBlock(blockNumber);
    const statusNum = Number(status);
    const statusTexts = ['Active', 'Resolved', 'Cancelled'];

    return {
      endTime: new Date(Number(endTimeUnix) * 1000),
      blockTime: new Date(Number(block?.timestamp || 0) * 1000),
      creator: creator,
      status: statusNum,
      statusText: statusTexts[statusNum] || 'Unknown',
      optionCount: Number(optionCount),
    };
  } catch (err) {
    console.error('Error fetching on-chain info:', err);
    return null;
  }
}

// Market Card Component
function MarketCard({ poll, onResolve, onCancel, userWallet }: {
  poll: PollData;
  onResolve: (poll: PollData) => void;
  onCancel: (poll: PollData) => void;
  userWallet?: string;
}) {
  const router = useRouter();
  const [debugInfo, setDebugInfo] = useState<OnChainDebugInfo | null>(null);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);

  const endDate = new Date(poll.pollEnd);
  const isEnded = endDate < new Date();
  const canResolve = isEnded && poll.status === 'active';

  // Fetch on-chain debug info
  const handleCheckOnChainInfo = async () => {
    if (!poll.contractAddress) {
      alert('No contract address for this market');
      return;
    }
    setIsLoadingDebug(true);
    const info = await fetchOnChainDebugInfo(poll.contractAddress);
    setDebugInfo(info);
    setIsLoadingDebug(false);
  };

  const getStatusBadge = () => {
    switch (poll.status) {
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Resolved
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        if (isEnded) {
          return (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Needs Resolution
            </span>
          );
        }
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Active
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3
            className="text-foreground font-semibold text-lg mb-2 cursor-pointer hover:text-primary transition-colors"
            onClick={() => router.push(`/prediction/${poll._id}`)}
          >
            {poll.question}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {getStatusBadge()}
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {poll.category}
            </span>
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2 mb-4">
        {poll.options.map((option, index) => {
          const color = OPTION_COLORS[index % OPTION_COLORS.length];
          const isWinner = poll.winningOptionIndices?.includes(index);
          return (
            <div
              key={index}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg',
                isWinner ? 'bg-primary/20 border border-primary/30' : 'bg-muted'
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn('text-sm', isWinner ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                  {option}
                </span>
                {isWinner && <Trophy className="w-4 h-4 text-primary" />}
              </div>
              <span className={cn('text-sm font-medium', color.text)}>
                {poll.odds ? `${Math.round(poll.odds[index])}%` : '-'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
        <span>Volume: ${poll.totalVolume.toLocaleString()}</span>
        <span>DB End: {endDate.toLocaleString()}</span>
      </div>

      {/* On-Chain Debug Info */}
      {poll.contractAddress && (
        <div className="mb-4">
          {!debugInfo ? (
            <button
              type="button"
              onClick={handleCheckOnChainInfo}
              disabled={isLoadingDebug}
              className="text-xs text-primary hover:text-primary/80 underline"
            >
              {isLoadingDebug ? 'Checking...' : 'Check on-chain status'}
            </button>
          ) : (
            <div className="bg-muted border border-border rounded-lg p-3 text-xs space-y-2">
              <p className="text-muted-foreground">
                <span className="text-muted-foreground">On-Chain Status:</span>{' '}
                <span className={debugInfo.status === 0 ? 'text-primary' : debugInfo.status === 1 ? 'text-foreground' : 'text-muted-foreground'}>
                  {debugInfo.statusText}
                </span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-muted-foreground">Blockchain End Time:</span>{' '}
                {debugInfo.endTime.toLocaleString()}
              </p>
              <p className="text-muted-foreground">
                <span className="text-muted-foreground">Current Block Time:</span>{' '}
                {debugInfo.blockTime.toLocaleString()}
              </p>
              <p className="text-muted-foreground">
                <span className="text-muted-foreground">Contract Creator:</span>{' '}
                <span className="font-mono">{debugInfo.creator.slice(0, 10)}...{debugInfo.creator.slice(-8)}</span>
              </p>
              <p className="text-muted-foreground">
                <span className="text-muted-foreground">Your Wallet:</span>{' '}
                <span className="font-mono">{userWallet ? `${userWallet.slice(0, 10)}...${userWallet.slice(-8)}` : 'Not connected'}</span>
              </p>
              <p className={cn(
                'font-medium',
                userWallet?.toLowerCase() === debugInfo.creator.toLowerCase() ? 'text-primary' : 'text-muted-foreground'
              )}>
                {userWallet?.toLowerCase() === debugInfo.creator.toLowerCase()
                  ? 'You ARE the creator'
                  : 'You are NOT the creator (cannot resolve)'
                }
              </p>
              <p className={cn(
                'font-medium',
                debugInfo.blockTime > debugInfo.endTime ? 'text-primary' : 'text-muted-foreground'
              )}>
                {debugInfo.blockTime > debugInfo.endTime
                  ? 'Time check PASSED'
                  : `Time check FAILED (${Math.ceil((debugInfo.endTime.getTime() - debugInfo.blockTime.getTime()) / (1000 * 60 * 60))} hours remaining)`
                }
              </p>
              {debugInfo.status !== 0 && (
                <p className="text-muted-foreground font-medium">
                  Market is already {debugInfo.statusText} - cannot resolve again
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Contract Link */}
      {poll.contractAddress && (
        <a
          href={`${MANTLE_SEPOLIA.blockExplorer}/address/${poll.contractAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
        >
          <span>View on Mantlescan</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {/* Time Until Resolvable */}
      {poll.status === 'active' && !isEnded && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 mb-4">
          <p className="text-muted-foreground text-xs">
            Resolvable after: {endDate.toLocaleString()}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {canResolve && (
          <button
            type="button"
            onClick={() => onResolve(poll)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
          >
            Resolve Market
          </button>
        )}
        {poll.status === 'active' && !isEnded && (
          <button
            type="button"
            onClick={() => onCancel(poll)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-muted-foreground border border-border transition-colors"
          >
            Cancel Market
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(`/prediction/${poll._id}`)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
        >
          View Details
        </button>
      </div>
    </div>
  );
}

// Resolve Modal Component
function ResolveModal({
  poll,
  onClose,
  onConfirm,
  isLoading
}: {
  poll: PollData;
  onClose: () => void;
  onConfirm: (winnerIndices: number[]) => void;
  isLoading: boolean;
}) {
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);

  const toggleWinner = (index: number) => {
    setSelectedWinners(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-foreground mb-2">Resolve Market</h2>
        <p className="text-muted-foreground text-sm mb-4">{poll.question}</p>

        <p className="text-foreground text-sm mb-3">Select the winning option(s):</p>

        <div className="space-y-2 mb-6">
          {poll.options.map((option, index) => {
            const color = OPTION_COLORS[index % OPTION_COLORS.length];
            const isSelected = selectedWinners.includes(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleWinner(index)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
                  isSelected
                    ? `${color.bg} text-primary-foreground`
                    : `bg-muted text-muted-foreground border border-border hover:bg-muted/80`
                )}
              >
                <span>{option}</span>
                {isSelected && <CheckCircle className="w-5 h-5" />}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedWinners)}
            disabled={selectedWinners.length === 0 || isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resolving...
              </>
            ) : (
              'Confirm Resolution'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Cancel Confirmation Modal
function CancelModal({
  poll,
  onClose,
  onConfirm,
  isLoading
}: {
  poll: PollData;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-foreground mb-2">Cancel Market</h2>
        <p className="text-muted-foreground text-sm mb-4">{poll.question}</p>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-foreground font-medium text-sm">Warning</p>
              <p className="text-muted-foreground text-xs mt-1">
                Cancelling this market will allow all users to claim full refunds for their positions. This action cannot be undone.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors disabled:opacity-50"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary/20 hover:bg-primary/30 text-foreground transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Market'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyMarketsPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const [polls, setPolls] = useState<PollData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState<PollData | null>(null);
  const [cancelModal, setCancelModal] = useState<PollData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get the resolve/cancel functions from useMarket hook
  const { resolveMarket, cancelMarket } = useMarket(resolveModal?.contractAddress || cancelModal?.contractAddress || '');

  useEffect(() => {
    const fetchMyPolls = async () => {
      if (!user?.wallet?.address) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/poll?creatorWalletAddress=${user.wallet.address}`);
        const data = await response.json();

        if (data.success && data.polls) {
          setPolls(data.polls);
        }
      } catch (err) {
        console.error('Error fetching polls:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (authenticated) {
      fetchMyPolls();
    } else {
      setIsLoading(false);
    }
  }, [authenticated, user?.wallet?.address]);

  const handleResolve = async (winnerIndices: number[]) => {
    if (!resolveModal || !user?.wallet?.address) return;

    setIsProcessing(true);
    setSuccessMessage(null);

    try {
      // If on-chain market exists, resolve on-chain first
      if (resolveModal.contractAddress) {
        await resolveMarket(winnerIndices);
      }

      // Update database
      const response = await fetch(`/api/poll/${resolveModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          winningOptionIndices: winnerIndices,
          walletAddress: user.wallet.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setPolls(prev => prev.map(p =>
          p._id === resolveModal._id
            ? { ...p, status: 'resolved' as const, winningOptionIndices: winnerIndices }
            : p
        ));
        setSuccessMessage(`Market resolved successfully! Winners: ${winnerIndices.map(i => resolveModal.options[i]).join(', ')}`);
        setResolveModal(null);
      } else {
        throw new Error(data.error || 'Failed to resolve market');
      }
    } catch (err) {
      console.error('Error resolving market:', err);
      // Parse common smart contract errors
      const errorMsg = err instanceof Error ? err.message : 'Failed to resolve market';
      if (errorMsg.includes('0xea8e4eb5') || errorMsg.includes('MarketStillOpen')) {
        alert('Cannot resolve market: The market end time has not passed yet. Please wait until the market ends.');
      } else if (errorMsg.includes('0x') && errorMsg.includes('NotAuthorized')) {
        alert('Cannot resolve market: You are not the creator of this market.');
      } else if (errorMsg.includes('MarketNotActive')) {
        alert('Cannot resolve market: The market is not active (may already be resolved or cancelled).');
      } else {
        alert(errorMsg);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelModal || !user?.wallet?.address) return;

    setIsProcessing(true);
    setSuccessMessage(null);

    try {
      // If on-chain market exists, cancel on-chain first
      if (cancelModal.contractAddress) {
        await cancelMarket();
      }

      // Update database
      const response = await fetch(`/api/poll/${cancelModal._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'cancelled',
          walletAddress: user.wallet.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update local state
        setPolls(prev => prev.map(p =>
          p._id === cancelModal._id
            ? { ...p, status: 'cancelled' as const }
            : p
        ));
        setSuccessMessage('Market cancelled successfully!');
        setCancelModal(null);
      } else {
        throw new Error(data.error || 'Failed to cancel market');
      }
    } catch (err) {
      console.error('Error cancelling market:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel market');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter polls by status
  const needsResolution = polls.filter(p => p.status === 'active' && new Date(p.pollEnd) < new Date());
  const activePolls = polls.filter(p => p.status === 'active' && new Date(p.pollEnd) >= new Date());
  const resolvedPolls = polls.filter(p => p.status === 'resolved');
  const cancelledPolls = polls.filter(p => p.status === 'cancelled');

  if (!authenticated) {
    return (
      <div className="w-[80%] flex flex-col items-center justify-center py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Connect Wallet</h1>
          <p className="text-muted-foreground mb-6">Connect your wallet to view and manage your markets</p>
          <button
            onClick={login}
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-[80%] flex flex-col items-center justify-center py-16">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <p className="text-muted-foreground text-sm mt-4">Loading your markets...</p>
      </div>
    );
  }

  return (
    <div className="w-[80%] flex flex-col py-6 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Markets</span>
          </button>
          <h1 className="text-2xl font-bold text-foreground">My Markets</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage and resolve your prediction markets
          </p>
        </div>
        <button
          onClick={() => router.push('/create')}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors"
        >
          Create Market
        </button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-primary/20 border border-primary/30 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-primary" />
          <span className="text-foreground">{successMessage}</span>
        </div>
      )}

      {polls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-medium text-foreground">No markets found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You haven&apos;t created any markets yet
          </p>
          <button
            onClick={() => router.push('/create')}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors"
          >
            Create Your First Market
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Needs Resolution Section */}
          {needsResolution.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Needs Resolution ({needsResolution.length})</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {needsResolution.map(poll => (
                  <MarketCard
                    key={poll._id}
                    poll={poll}
                    onResolve={setResolveModal}
                    onCancel={setCancelModal}
                    userWallet={user?.wallet?.address}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active Markets */}
          {activePolls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Active Markets ({activePolls.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activePolls.map(poll => (
                  <MarketCard
                    key={poll._id}
                    poll={poll}
                    onResolve={setResolveModal}
                    onCancel={setCancelModal}
                    userWallet={user?.wallet?.address}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resolved Markets */}
          {resolvedPolls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Resolved Markets ({resolvedPolls.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {resolvedPolls.map(poll => (
                  <MarketCard
                    key={poll._id}
                    poll={poll}
                    onResolve={setResolveModal}
                    onCancel={setCancelModal}
                    userWallet={user?.wallet?.address}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Cancelled Markets */}
          {cancelledPolls.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Cancelled Markets ({cancelledPolls.length})</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cancelledPolls.map(poll => (
                  <MarketCard
                    key={poll._id}
                    poll={poll}
                    onResolve={setResolveModal}
                    onCancel={setCancelModal}
                    userWallet={user?.wallet?.address}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {resolveModal && (
        <ResolveModal
          poll={resolveModal}
          onClose={() => setResolveModal(null)}
          onConfirm={handleResolve}
          isLoading={isProcessing}
        />
      )}

      {cancelModal && (
        <CancelModal
          poll={cancelModal}
          onClose={() => setCancelModal(null)}
          onConfirm={handleCancel}
          isLoading={isProcessing}
        />
      )}
    </div>
  );
}
