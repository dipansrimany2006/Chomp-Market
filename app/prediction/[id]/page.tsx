'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Share2,
  Download,
  PlusCircle,
  ChevronDown,
  Calendar,
  Info,
  Loader2,
  Wallet,
  ExternalLink,
  BookmarkCheck ,
  Trophy,
  Gift,
  Heart,
  MoreHorizontal,
  AlertCircle,
} from 'lucide-react';
import PriceChart from '@/components/PriceChart';
import { useMarket, MarketStatus, formatTokenAmount } from '@/hooks/useContracts';
import { usePoll, usePollsByCategory, useMarketInfo, useCurrentUserPosition, useUserBalance, useInvalidateMarketData, useComments, useCreateComment, useLikeComment, useActivity, useCreateActivity, useHolders, useIsWatched, useAddToWatchlist, useRemoveFromWatchlist, Comment, ActivityItem, Holder } from '@/hooks/useQueries';
import { MANTLE_SEPOLIA } from '@/lib/contracts';
import PageTransition from '@/components/ui/page-transition';
import { Skeleton } from '@/components/ui/skeleton';
import { transformPollToPrediction, PollFromAPI } from '@/lib/predictions';

// Color palette for multiple options
const OPTION_COLORS = [
  { bg: 'bg-[#00bf63]', bgLight: 'bg-[#00bf63]/20', text: 'text-[#00bf63]', border: 'border-[#00bf63]/30', hex: '#00bf63' },
  { bg: 'bg-[#ee3e3d]', bgLight: 'bg-[#ee3e3d]/20', text: 'text-[#ee3e3d]', border: 'border-[#ee3e3d]/30', hex: '#ee3e3d' },
  { bg: 'bg-[#ffa51f]', bgLight: 'bg-[#ffa51f]/20', text: 'text-[#ffa51f]', border: 'border-[#ffa51f]/30', hex: '#ffa51f' },
  { bg: 'bg-[#0081cc]', bgLight: 'bg-[#0081cc]/20', text: 'text-[#0081cc]', border: 'border-[#0081cc]/30', hex: '#0081cc' },
];

export default function PredictionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'comments' | 'holders' | 'activity'>('comments');
  const [commentText, setCommentText] = useState('');
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest'>('newest');
  const [holdersOnly, setHoldersOnly] = useState(false);

  // React Query hooks for data fetching
  const { data: pollData, isLoading } = usePoll(params.id as string);
  const prediction = pollData?.poll ? transformPollToPrediction(pollData.poll) : null;

  // Related markets query
  const { data: relatedData } = usePollsByCategory(prediction?.category || '');
  const relatedMarkets = (relatedData?.polls || [])
    .filter((p: PollFromAPI) => p._id !== params.id)
    .slice(0, 3)
    .map((p: PollFromAPI) => transformPollToPrediction(p));

  // Contract address and hooks
  const contractAddress = prediction?.contractAddress || '';
  const { buyShares, sellShares, claimWinnings } = useMarket(contractAddress);

  // React Query hooks for blockchain data (with caching + auto-refresh)
  const { data: marketInfo } = useMarketInfo(contractAddress);
  const { data: userPosition } = useCurrentUserPosition(contractAddress);
  const { data: tokenBalance = '0' } = useUserBalance();

  // Cache invalidation helper
  const { invalidateAfterTrade, invalidateAfterClaim } = useInvalidateMarketData();

  // Comments, Activity, and Holders hooks
  const { data: commentsData, isLoading: commentsLoading } = useComments(params.id as string, commentSort);
  const { data: activityData, isLoading: activityLoading } = useActivity(params.id as string);
  const { data: holdersData, isLoading: holdersLoading } = useHolders(params.id as string);
  const createComment = useCreateComment();
  const likeComment = useLikeComment();
  const createActivity = useCreateActivity();

  // Watchlist hooks
  const { data: watchlistData } = useIsWatched(user?.wallet?.address, params.id as string);
  const addToWatchlist = useAddToWatchlist();
  const removeFromWatchlist = useRemoveFromWatchlist();
  const isWatched = watchlistData?.isWatched ?? false;

  // Helper to increment totalTrades count
  const incrementTotalTrades = async () => {
    try {
      // First get current poll data to get current totalTrades
      const currentPoll = await fetch(`/api/poll/${params.id}`).then(res => res.json());
      const currentTrades = currentPoll?.poll?.totalTrades || 0;

      // Increment totalTrades
      await fetch(`/api/poll/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalTrades: currentTrades + 1 }),
      });
    } catch (err) {
      console.error('Failed to increment trade count:', err);
    }
  };

  // Handle buy shares
  const handleBuy = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!contractAddress) {
      alert('This market is not deployed on-chain yet');
      return;
    }

    setIsBuying(true);
    setTxSuccess(null);

    try {
      await buyShares(selectedOptionIndex, amount);
      const optionLabel = marketInfo?.optionLabels[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      setTxSuccess(`Successfully bought ${optionLabel} shares!`);

      // Create activity record
      if (user?.wallet?.address) {
        createActivity.mutate({
          pollId: params.id as string,
          walletAddress: user.wallet.address,
          action: 'bought',
          optionIndex: selectedOptionIndex,
          optionLabel,
          amount,
        });
      }

      setAmount('');
      // Invalidate cached data to trigger refetch
      invalidateAfterTrade(contractAddress);
      // Increment trade count for featured ranking
      incrementTotalTrades();
    } catch (err) {
      console.error('Error buying shares:', err);
      alert(err instanceof Error ? err.message : 'Failed to buy shares');
    } finally {
      setIsBuying(false);
    }
  };

  // Handle sell shares
  const handleSell = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!contractAddress) {
      alert('This market is not deployed on-chain yet');
      return;
    }

    // Check if user has enough shares
    const userShares = userPosition?.shares[selectedOptionIndex];
    if (!userShares || userShares === 0n) {
      const optionLabel = marketInfo?.optionLabels[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      alert(`You don't have any ${optionLabel} shares to sell`);
      return;
    }

    setIsBuying(true);
    setTxSuccess(null);

    try {
      await sellShares(selectedOptionIndex, amount);
      const optionLabel = marketInfo?.optionLabels[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      setTxSuccess(`Successfully sold ${optionLabel} shares!`);

      // Create activity record
      if (user?.wallet?.address) {
        createActivity.mutate({
          pollId: params.id as string,
          walletAddress: user.wallet.address,
          action: 'sold',
          optionIndex: selectedOptionIndex,
          optionLabel,
          amount,
        });
      }

      setAmount('');
      // Invalidate cached data to trigger refetch
      invalidateAfterTrade(contractAddress);
      // Increment trade count for featured ranking
      incrementTotalTrades();
    } catch (err) {
      console.error('Error selling shares:', err);
      alert(err instanceof Error ? err.message : 'Failed to sell shares');
    } finally {
      setIsBuying(false);
    }
  };

  // Handle claim winnings
  const handleClaimWinnings = async () => {
    if (!contractAddress) return;

    setIsClaiming(true);
    try {
      await claimWinnings();
      setTxSuccess('Congratulations! Your winnings have been claimed successfully!');
      // Invalidate cached data to trigger refetch
      invalidateAfterClaim(contractAddress);
    } catch (err) {
      console.error('Error claiming winnings:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim winnings';
      if (errorMsg.includes('NothingToClaim')) {
        alert('You have no winnings to claim. Either you didn\'t bet on the winning option, or you\'ve already claimed.');
      } else if (errorMsg.includes('AlreadyClaimed')) {
        alert('You have already claimed your winnings for this market.');
      } else {
        alert(errorMsg);
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle posting a comment
  const handlePostComment = () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!commentText.trim()) return;

    if (!user?.wallet?.address) {
      alert('Please connect your wallet to comment');
      return;
    }

    createComment.mutate({
      pollId: params.id as string,
      walletAddress: user.wallet.address,
      content: commentText.trim(),
    }, {
      onSuccess: () => {
        setCommentText('');
      },
      onError: (err) => {
        alert(err instanceof Error ? err.message : 'Failed to post comment');
      },
    });
  };

  // Handle liking a comment
  const handleLikeComment = (commentId: string) => {
    if (!authenticated) {
      login();
      return;
    }

    if (!user?.wallet?.address) return;

    const comment = commentsData?.comments?.find((c: Comment) => c._id === commentId);
    const hasLiked = comment?.likes?.includes(user.wallet.address.toLowerCase());

    likeComment.mutate({
      commentId,
      walletAddress: user.wallet.address,
      action: hasLiked ? 'unlike' : 'like',
      pollId: params.id as string,
    });
  };

  // Handle watchlist toggle
  const handleToggleWatchlist = () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!user?.wallet?.address) return;

    const pollId = params.id as string;
    const walletAddress = user.wallet.address;

    if (isWatched) {
      removeFromWatchlist.mutate({ walletAddress, pollId });
    } else {
      addToWatchlist.mutate({ walletAddress, pollId });
    }
  };

  // Handle share - Copy market link to clipboard
  const handleShare = async () => {
    const marketUrl = `${window.location.origin}/prediction/${params.id}`;

    try {
      await navigator.clipboard.writeText(marketUrl);
      toast.success('Link copied to clipboard!', {
        description: 'Share this link to let others view this market.',
      });
    } catch (err) {
      console.error('Failed to copy link:', err);
      toast.error('Failed to copy link', {
        description: marketUrl,
      });
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // Generate avatar gradient based on wallet address
  const getAvatarGradient = (address: string) => {
    const gradients = [
      'from-blue-500 to-purple-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-pink-500 to-purple-600',
      'from-cyan-500 to-blue-600',
      'from-purple-500 to-pink-600',
      'from-yellow-500 to-orange-600',
      'from-red-500 to-rose-600',
    ];
    const index = parseInt(address.slice(-2), 16) % gradients.length;
    return gradients[index];
  };

  // Truncate wallet address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Calculate user's potential winnings
  const calculateUserWinnings = (): { hasWinningShares: boolean; winningShares: bigint; totalWinningShares: bigint; potentialPayout: string } => {
    if (!marketInfo || !userPosition || marketInfo.status !== MarketStatus.Resolved) {
      return { hasWinningShares: false, winningShares: 0n, totalWinningShares: 0n, potentialPayout: '0' };
    }

    let userWinningShares = 0n;
    let totalWinningSharesSum = 0n;

    for (let i = 0; i < marketInfo.winningOptions.length; i++) {
      if (marketInfo.winningOptions[i]) {
        userWinningShares += userPosition.shares[i] || 0n;
        totalWinningSharesSum += marketInfo.totalShares[i] || 0n;
      }
    }

    if (userWinningShares === 0n || totalWinningSharesSum === 0n) {
      return { hasWinningShares: false, winningShares: 0n, totalWinningShares: totalWinningSharesSum, potentialPayout: '0' };
    }

    // Calculate payout: (userWinningShares / totalWinningShares) * totalPool
    const totalPool = marketInfo.totalPool;
    const payout = (userWinningShares * totalPool) / totalWinningSharesSum;

    return {
      hasWinningShares: true,
      winningShares: userWinningShares,
      totalWinningShares: totalWinningSharesSum,
      potentialPayout: formatTokenAmount(payout),
    };
  };

  const userWinningsInfo = calculateUserWinnings();

  // Get options from on-chain data or prediction
  const options = marketInfo?.optionLabels || prediction?.options || ['Yes', 'No'];
  const odds = marketInfo?.odds || prediction?.odds || options.map(() => 100 / options.length);

  if (isLoading) {
    return (
      <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col py-4 sm:py-6">
        {/* Back button skeleton */}
        <Skeleton className="h-5 w-16 mb-6" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Market Header */}
            <div className="flex items-start gap-4">
              <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-7 w-full mb-2" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>

            {/* Options Table */}
            <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
              <div className="px-6 py-3 border-b border-border">
                <Skeleton className="h-4 w-full" />
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-10 w-28 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>

            {/* Price Chart */}
            <Skeleton className="h-72 w-full rounded-2xl" />

            {/* Rules Summary */}
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card/50 p-6">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                <Skeleton className="flex-1 h-10 rounded-lg" />
                <Skeleton className="flex-1 h-10 rounded-lg" />
              </div>
              <div className="space-y-2 mb-4">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </div>
              <Skeleton className="h-20 w-full rounded-xl mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-12 w-full rounded-xl mb-4" />
              <div className="flex gap-2 mb-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="flex-1 h-10 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  if (!prediction) {
    return (
      <PageTransition className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Market Not Found</h1>
          <button
            onClick={() => router.push('/')}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Markets
          </button>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col py-4 sm:py-6 overflow-y-auto scrollbar-hide">
      {/* Back Navigation */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 sm:mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Market Header */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl overflow-hidden bg-muted shrink-0">
              {prediction.imageUrl ? (
                <img
                  src={prediction.imageUrl}
                  alt={prediction.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">
                    {prediction.category.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight mb-2">
                {prediction.title}
              </h1>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Copy market link"
              >
                <Share2 className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={handleToggleWatchlist}
                disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
                className={cn(
                  "p-2 rounded-lg transition-colors disabled:opacity-50",
                  isWatched
                    ? "bg-primary/20 text-primary hover:bg-primary/30"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
                title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
              >
                {isWatched ? (
                  <BookmarkCheck  className="h-5 w-5" fill="currentColor" />
                ) : (
                  <PlusCircle className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Claim Winnings Banner - Shows when market is resolved */}
          {marketInfo?.status === MarketStatus.Resolved && authenticated && (
            <div className={cn(
              'rounded-xl sm:rounded-2xl border p-4 sm:p-6',
              userWinningsInfo.hasWinningShares && !userPosition?.hasClaimed
                ? 'bg-primary/15 border-primary/30'
                : userPosition?.hasClaimed
                  ? 'bg-muted border border-border'
                  : 'bg-muted/50 border-border'
            )}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className={cn(
                    'p-2 sm:p-3 rounded-lg sm:rounded-xl shrink-0',
                    userWinningsInfo.hasWinningShares && !userPosition?.hasClaimed
                      ? 'bg-primary/20'
                      : userPosition?.hasClaimed
                        ? 'bg-muted'
                        : 'bg-muted'
                  )}>
                    {userPosition?.hasClaimed ? (
                      <BookmarkCheck className="h-6 w-6 text-primary" />
                    ) : userWinningsInfo.hasWinningShares ? (
                      <Trophy className="h-6 w-6 text-primary" />
                    ) : (
                      <Gift className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {userPosition?.hasClaimed
                        ? 'Winnings Claimed!'
                        : userWinningsInfo.hasWinningShares
                          ? 'You Won! Claim Your Winnings'
                          : 'Market Resolved'
                      }
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {userPosition?.hasClaimed
                        ? 'You have successfully claimed your winnings from this market.'
                        : userWinningsInfo.hasWinningShares
                          ? `You have winning shares worth approximately ${userWinningsInfo.potentialPayout} MNT`
                          : userPosition && userPosition.shares.some(s => s > 0n)
                            ? 'Unfortunately, you did not bet on the winning outcome.'
                            : 'This market has been resolved. See the winning outcome below.'
                      }
                    </p>
                    {marketInfo.winningOptions.some(w => w) && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="text-muted-foreground text-xs">Winner:</span>
                        {options.map((label, idx) => (
                          marketInfo.winningOptions[idx] && (
                            <span
                              key={idx}
                              className="px-2 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1"
                            >
                              <Trophy className="h-3 w-3" />
                              {label}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {userWinningsInfo.hasWinningShares && !userPosition?.hasClaimed && (
                  <button
                    onClick={handleClaimWinnings}
                    disabled={isClaiming}
                    className="w-full sm:w-auto px-4 sm:px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4" />
                        Claim {userWinningsInfo.potentialPayout} MNT
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options Table - Dynamic */}
          <div className="rounded-xl sm:rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
              <span className="text-muted-foreground text-xs sm:text-sm">Outcome</span>
              <div className="flex items-center gap-2 sm:gap-4">
                <span className="text-muted-foreground text-xs sm:text-sm w-14 sm:w-20 text-center">Chance</span>
                <span className="w-20 sm:w-28"></span>
              </div>
            </div>

            {options.map((label, index) => {
              const color = OPTION_COLORS[index % OPTION_COLORS.length];
              const optionOdds = odds[index] || 0;
              const isSelected = selectedOptionIndex === index;
              const isWinner = marketInfo?.winningOptions[index];

              return (
                <div
                  key={index}
                  className={cn(
                    'flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border last:border-b-0 transition-colors',
                    isSelected && `${color.bgLight}`,
                    isWinner && marketInfo?.status === MarketStatus.Resolved && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={cn('w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center', color.bgLight)}>
                      <span className={cn('font-bold text-sm sm:text-base', color.text)}>{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-foreground font-medium text-sm sm:text-base">{label}</span>
                      {isWinner && (
                        <BookmarkCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4">
                    <span className="text-foreground font-bold text-sm sm:text-lg w-14 sm:w-20 text-center">
                      {Math.round(optionOdds)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOptionIndex(index);
                        setOrderType('buy');
                      }}
                      className={cn(
                        'w-20 sm:w-28 py-1.5 sm:py-2 px-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all',
                        isSelected
                          ? `${color.bg} text-primary-foreground`
                          : `${color.bgLight} ${color.text} border ${color.border} hover:opacity-80`
                      )}
                    >
                      <span className="hidden sm:inline">Buy {Math.round(optionOdds)}%</span>
                      <span className="sm:hidden">Buy</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Price Chart */}
          <PriceChart
            options={options.map((label, i) => ({
              label,
              percentage: odds[i] || 50,
            }))}
            marketId={params.id as string}
            height={280}
            className="rounded-2xl"
          />

          {/* Rules Summary */}
          <div className="rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl overflow-hidden">
            <button
              onClick={() => setRulesExpanded(!rulesExpanded)}
              className="w-full flex items-center justify-between p-6"
            >
              <h3 className="text-lg font-semibold text-foreground">Rules summary</h3>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out",
                    rulesExpanded && "rotate-180"
                  )}
                />
              </div>
            </button>

            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                rulesExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 space-y-4">
                  <p
                    className={cn(
                      "text-muted-foreground text-sm leading-relaxed transition-all duration-300 ease-out",
                      rulesExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    )}
                    style={{ transitionDelay: rulesExpanded ? '100ms' : '0ms' }}
                  >
                    {prediction.description || `This market resolves based on the outcome of: "${prediction.title}". Multiple options can win.`}
                  </p>
                  <div
                    className={cn(
                      "flex flex-wrap gap-2 transition-all duration-300 ease-out",
                      rulesExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    )}
                    style={{ transitionDelay: rulesExpanded ? '200ms' : '0ms' }}
                  >
                    {options.map((opt, i) => (
                      <span
                        key={i}
                        className={cn(
                          "px-3 py-1 rounded-lg bg-neutral-800 text-foreground text-sm transition-all duration-300 ease-out",
                          rulesExpanded ? "opacity-100 scale-100" : "opacity-0 scale-95"
                        )}
                        style={{ transitionDelay: rulesExpanded ? `${250 + i * 50}ms` : '0ms' }}
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                  <p
                    className={cn(
                      "text-muted-foreground text-sm transition-all duration-300 ease-out",
                      rulesExpanded ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
                    )}
                    style={{ transitionDelay: rulesExpanded ? '350ms' : '0ms' }}
                  >
                    Market end date: <span className="text-foreground">{prediction.endDate}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline and Payout */}
          <div className="rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl overflow-hidden">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full flex items-center justify-between p-6"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-base font-medium text-foreground">Timeline and payout</h3>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-300 ease-out",
                  timelineExpanded && "rotate-180"
                )}
              />
            </button>

            <div
              className={cn(
                "grid transition-all duration-300 ease-out",
                timelineExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6">
                  {/* Vertical Timeline */}
                  <div className="relative pl-8 space-y-6">
                    {/* Connecting line - animated */}
                    <div
                      className={cn(
                        "absolute left-[11px] top-3 bottom-3 w-[2px] bg-border origin-top transition-transform duration-500 ease-out delay-100",
                        timelineExpanded ? "scale-y-100" : "scale-y-0"
                      )}
                    />

                    {/* Market open */}
                    <div
                      className={cn(
                        "relative transition-all duration-300 ease-out",
                        timelineExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                      )}
                      style={{ transitionDelay: timelineExpanded ? '100ms' : '0ms' }}
                    >
                      <div className="absolute -left-8 top-0">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full bg-primary flex items-center justify-center transition-transform duration-300 ease-out",
                            timelineExpanded ? "scale-100" : "scale-0"
                          )}
                          style={{ transitionDelay: timelineExpanded ? '150ms' : '0ms' }}
                        >
                          <BookmarkCheck className="h-4 w-4 text-primary-foreground" fill="currentColor" />
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Market open</p>
                        <p className="text-muted-foreground text-sm">
                          {prediction.createdAt ? new Date(prediction.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) + ' · ' + new Date(prediction.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZoneName: 'short'
                          }) : 'Market is live'}
                        </p>
                      </div>
                    </div>

                    {/* Market closes */}
                    <div
                      className={cn(
                        "relative transition-all duration-300 ease-out",
                        timelineExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                      )}
                      style={{ transitionDelay: timelineExpanded ? '200ms' : '0ms' }}
                    >
                      <div className="absolute -left-8 top-0">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center transition-transform duration-300 ease-out",
                            timelineExpanded ? "scale-100" : "scale-0"
                          )}
                          style={{ transitionDelay: timelineExpanded ? '250ms' : '0ms' }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Market closes</p>
                        <p className="text-muted-foreground text-sm">After the outcome occurs</p>
                      </div>
                    </div>

                    {/* Projected payout */}
                    <div
                      className={cn(
                        "relative transition-all duration-300 ease-out",
                        timelineExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                      )}
                      style={{ transitionDelay: timelineExpanded ? '300ms' : '0ms' }}
                    >
                      <div className="absolute -left-8 top-0">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center transition-transform duration-300 ease-out",
                            timelineExpanded ? "scale-100" : "scale-0"
                          )}
                          style={{ transitionDelay: timelineExpanded ? '350ms' : '0ms' }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full bg-neutral-500" />
                        </div>
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Projected payout</p>
                        <p className="text-muted-foreground text-sm">5 minutes after closing</p>
                      </div>
                    </div>
                  </div>

                  {/* Market expiration text */}
                  <p
                    className={cn(
                      "text-muted-foreground text-sm mt-6 pt-4 border-t border-border transition-all duration-300 ease-out",
                      timelineExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                    style={{ transitionDelay: timelineExpanded ? '400ms' : '0ms' }}
                  >
                    This market will close and expire after a winner is declared. Otherwise, it closes by{' '}
                    <span className="text-foreground">{prediction.endDate}</span>.
                  </p>

                  {/* Market metadata */}
                  <div
                    className={cn(
                      "mt-4 space-y-1 text-sm transition-all duration-300 ease-out",
                      timelineExpanded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                    )}
                    style={{ transitionDelay: timelineExpanded ? '450ms' : '0ms' }}
                  >
                    <p>
                      <span className="text-muted-foreground">Category </span>
                      <span className="text-foreground font-medium">{prediction.category}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Market </span>
                      <span className="text-foreground font-medium">{contractAddress ? `${contractAddress.slice(0, 10)}...${contractAddress.slice(-8)}` : prediction.id}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Comments, Holders, Activity Tabs */}
          <div className="rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl overflow-hidden">
            {/* Tab Headers */}
            <div className="relative flex items-center gap-6 px-6 pt-4 border-b border-border">
              <button
                onClick={() => setActiveTab('comments')}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors duration-200",
                  activeTab === 'comments'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Comments
              </button>
              <button
                onClick={() => setActiveTab('holders')}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors duration-200",
                  activeTab === 'holders'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Holders
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={cn(
                  "pb-3 text-sm font-medium transition-colors duration-200",
                  activeTab === 'activity'
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Activity
              </button>
              {/* Animated underline indicator */}
              <div
                className="absolute bottom-0 h-0.5 bg-primary transition-all duration-300 ease-out"
                style={{
                  left: activeTab === 'comments' ? '24px' : activeTab === 'holders' ? '116px' : '184px',
                  width: activeTab === 'comments' ? '72px' : activeTab === 'holders' ? '52px' : '52px',
                }}
              />
            </div>

            {/* Tab Content - Sliding Container */}
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(-${activeTab === 'comments' ? 0 : activeTab === 'holders' ? 100 : 200}%)`
                }}
              >
                {/* Comments Tab */}
                <div className="w-full flex-shrink-0 p-4 sm:p-6">
                  <div className="space-y-4">
                    {/* Add Comment Input */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800 border border-border">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                        placeholder={authenticated ? "Add a comment" : "Connect wallet to comment"}
                        disabled={!authenticated}
                        className="flex-1 bg-transparent text-foreground placeholder-muted-foreground text-sm focus:outline-none disabled:opacity-50"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={!commentText.trim() || createComment.isPending}
                        className="text-primary font-medium text-sm hover:text-primary/80 transition-colors disabled:opacity-50"
                      >
                        {createComment.isPending ? 'Posting...' : 'Post'}
                      </button>
                    </div>

                    {/* Filters */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setCommentSort(commentSort === 'newest' ? 'oldest' : 'newest')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 text-foreground text-sm"
                        >
                          {commentSort === 'newest' ? 'Newest' : 'Oldest'}
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={holdersOnly}
                            onChange={(e) => setHoldersOnly(e.target.checked)}
                            className="rounded border-border bg-neutral-800"
                          />
                          Holders
                        </label>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Beware of external links.</span>
                      </div>
                    </div>

                    {/* Comments List */}
                    <div className="space-y-4">
                      {commentsLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-start gap-3">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-4 w-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : commentsData?.comments && commentsData.comments.length > 0 ? (
                        commentsData.comments.map((comment: Comment) => (
                          <div key={comment._id} className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br shrink-0", getAvatarGradient(comment.walletAddress))} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-foreground font-medium text-sm">
                                    {comment.userName || truncateAddress(comment.walletAddress)}
                                  </span>
                                  <span className="text-muted-foreground text-xs">{formatTimeAgo(comment.createdAt)}</span>
                                  <button className="ml-auto text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </div>
                                <p className="text-foreground text-sm mt-1">
                                  {comment.content}
                                </p>
                                <button
                                  onClick={() => handleLikeComment(comment._id)}
                                  className={cn(
                                    "flex items-center gap-1.5 mt-2 text-sm transition-colors",
                                    comment.likes?.includes(user?.wallet?.address?.toLowerCase() || '')
                                      ? "text-red-500"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <Heart
                                    className="h-4 w-4"
                                    fill={comment.likes?.includes(user?.wallet?.address?.toLowerCase() || '') ? 'currentColor' : 'none'}
                                  />
                                  <span>{comment.likes?.length || 0}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No comments yet. Be the first to comment!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Holders Tab */}
                <div className="w-full flex-shrink-0 p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span>Top holders in this market</span>
                      <span>{holdersData?.totalHolders || 0} holders</span>
                    </div>

                    {/* Holders List */}
                    <div className="space-y-3">
                      {holdersLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                              <Skeleton className="h-4 w-16" />
                            </div>
                          ))}
                        </div>
                      ) : holdersData?.holders && holdersData.holders.length > 0 ? (
                        holdersData.holders.map((holder: Holder, index: number) => (
                          <div
                            key={holder.walletAddress}
                            className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 transition-colors"
                          >
                            <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br shrink-0", getAvatarGradient(holder.walletAddress))} />
                            <div className="flex-1 min-w-0">
                              <span className="text-foreground font-medium text-sm block">
                                {holder.userName || truncateAddress(holder.walletAddress)}
                              </span>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {holder.positions.map((pos, i) => {
                                  const color = OPTION_COLORS[pos.optionIndex % OPTION_COLORS.length];
                                  return (
                                    <span
                                      key={i}
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-xs",
                                        color.bgLight,
                                        color.text
                                      )}
                                    >
                                      {pos.amount.toFixed(2)} {pos.optionLabel}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-foreground font-bold text-sm">{holder.totalValue.toFixed(2)}</span>
                              <span className="text-muted-foreground text-xs block">MNT</span>
                            </div>
                            <div className="text-muted-foreground text-xs shrink-0">
                              #{index + 1}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No holders yet. Be the first to buy shares!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Activity Tab */}
                <div className="w-full flex-shrink-0 p-4 sm:p-6">
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-2">Recent activity</div>

                    {/* Activity List */}
                    <div className="space-y-3">
                      {activityLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50">
                              <Skeleton className="w-10 h-10 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-48" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : activityData?.activities && activityData.activities.length > 0 ? (
                        activityData.activities.map((activity: ActivityItem) => (
                          <div key={activity._id} className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50">
                            <div className={cn("w-10 h-10 rounded-full bg-gradient-to-br shrink-0", getAvatarGradient(activity.walletAddress))} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-foreground font-medium text-sm">
                                  {activity.userName || truncateAddress(activity.walletAddress)}
                                </span>
                                <span className={cn(
                                  "text-sm",
                                  activity.action === 'bought' ? 'text-primary' : activity.action === 'sold' ? 'text-[#ee3e3d]' : 'text-foreground'
                                )}>
                                  {activity.action}
                                </span>
                                <span className="text-foreground text-sm">{activity.amount} MNT</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {activity.optionLabel && (
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs",
                                    activity.optionIndex === 0
                                      ? "bg-primary/20 text-primary"
                                      : "bg-[#ee3e3d]/20 text-[#ee3e3d]"
                                  )}>
                                    {activity.optionLabel}
                                  </span>
                                )}
                                <span className="text-muted-foreground text-xs">{formatTimeAgo(activity.createdAt)}</span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No activity yet. Be the first to trade!</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Order Panel */}
        <div className="space-y-4 order-first lg:order-none">
          <div className="rounded-xl sm:rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl p-4 sm:p-6 lg:sticky lg:top-6">
            {/* Market Summary */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                {prediction.imageUrl ? (
                  <img
                    src={prediction.imageUrl}
                    alt={prediction.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground text-xs truncate">{prediction.title}</p>
                <p className="text-sm">
                  <span className={cn('font-medium', OPTION_COLORS[selectedOptionIndex % OPTION_COLORS.length].text)}>
                    {orderType === 'buy' ? 'Buy' : 'Sell'} {options[selectedOptionIndex]}
                  </span>
                </p>
              </div>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setOrderType('buy')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  orderType === 'buy'
                    ? 'bg-primary/20 text-foreground border border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setOrderType('sell')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                  orderType === 'sell'
                    ? 'bg-muted text-foreground border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                Sell
              </button>
            </div>

            {/* Option Selection */}
            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-2">Select Option</label>
              <div className="space-y-2">
                {options.map((label, index) => {
                  const color = OPTION_COLORS[index % OPTION_COLORS.length];
                  const optionOdds = odds[index] || 0;
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedOptionIndex(index)}
                      className={cn(
                        'w-full py-3 px-4 rounded-lg text-sm font-semibold transition-all text-left flex items-center justify-between',
                        selectedOptionIndex === index
                          ? `${color.bg} text-primary-foreground`
                          : `bg-neutral-800 text-muted-foreground border border-border hover:bg-neutral-800/80`
                      )}
                    >
                      <span>{label}</span>
                      <span>{Math.round(optionOdds)}%</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance Display */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-800 border border-border mb-4">
              <div>
                <p className="text-muted-foreground text-xs">MNT Balance</p>
                <p className="text-foreground text-xs">Native Token</p>
              </div>
              <span className="text-foreground text-2xl font-light">
                {parseFloat(tokenBalance).toFixed(4)}
              </span>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm text-muted-foreground mb-2">Amount (MNT)</label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full bg-neutral-800 border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">MNT</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4">
              {['0.1', '0.5', '1', '5'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val)}
                  className={cn(
                    'flex-1 py-2 text-sm rounded-lg border transition-colors',
                    amount === val
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border bg-neutral-800 text-muted-foreground hover:bg-neutral-800/80'
                  )}
                >
                  {val} MNT
                </button>
              ))}
            </div>

            {/* Potential Return */}
            {amount && (
              <div className="mb-4 p-4 rounded-xl bg-neutral-800 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground text-sm">Shares</span>
                  <span className="text-foreground font-medium">
                    {parseFloat(amount).toFixed(4)} MNT
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Potential return (if wins)</span>
                  <span className="text-foreground font-bold">
                    {((parseFloat(amount) || 0) / (odds[selectedOptionIndex] / 100)).toFixed(4)} MNT
                  </span>
                </div>
              </div>
            )}

            {/* Transaction Success Message */}
            {txSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-primary/20 border border-primary/30 flex items-center gap-2">
                <BookmarkCheck className="h-4 w-4 text-primary" />
                <span className="text-foreground text-sm">{txSuccess}</span>
              </div>
            )}

            {/* Buy/Sell Button */}
            <button
              type="button"
              onClick={orderType === 'buy' ? handleBuy : handleSell}
              disabled={!amount || isBuying || !contractAddress}
              className={cn(
                'w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
                orderType === 'buy'
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/90 text-secondary-foreground'
              )}
            >
              {isBuying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : !authenticated ? (
                'Connect Wallet to Trade'
              ) : !contractAddress ? (
                'Market Not On-Chain'
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {orderType === 'buy' ? 'Buy' : 'Sell'} {options[selectedOptionIndex]}
                </>
              )}
            </button>

            {/* User Position */}
            {userPosition && userPosition.shares.some(s => s > 0n) && (
              <div className="mt-4 p-4 rounded-xl bg-neutral-800 border border-border">
                <p className="text-muted-foreground text-xs mb-2">Your Position</p>
                <div className="space-y-2">
                  {options.map((label, index) => {
                    const shares = userPosition.shares[index];
                    if (!shares || shares === 0n) return null;
                    const color = OPTION_COLORS[index % OPTION_COLORS.length];
                    return (
                      <div key={index} className="flex justify-between">
                        <span className={cn('text-sm', color.text)}>{label}</span>
                        <span className="text-foreground font-medium">{formatTokenAmount(shares)}</span>
                      </div>
                    );
                  })}
                </div>
                {marketInfo?.status === MarketStatus.Resolved && !userPosition.hasClaimed && userWinningsInfo.hasWinningShares && (
                  <button
                    onClick={handleClaimWinnings}
                    disabled={isClaiming}
                    className="w-full mt-3 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4" />
                        Claim {userWinningsInfo.potentialPayout} MNT
                      </>
                    )}
                  </button>
                )}
                {userPosition.hasClaimed && (
                  <div className="mt-3 py-2.5 rounded-lg bg-primary/20 border border-primary/30 text-foreground text-sm font-medium flex items-center justify-center gap-2">
                    <BookmarkCheck className="h-4 w-4" />
                    Winnings Claimed
                  </div>
                )}
              </div>
            )}

            {/* Contract Info */}
            {contractAddress && (
              <div className="mt-4 pt-4 border-t border-border">
                <a
                  href={`${MANTLE_SEPOLIA.blockExplorer}/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground text-xs transition-colors"
                >
                  <span>View on Mantlescan</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>

          {/* Related Markets - Sidebar */}
          {relatedMarkets.length > 0 && (
            <div className="rounded-xl sm:rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl p-4 sm:p-6">
              <h3 className="text-base font-semibold text-foreground mb-4">Related markets</h3>
              <div className="space-y-3">
                {relatedMarkets.map((market) => (
                  <div
                    key={market.id}
                    onClick={() => router.push(`/prediction/${market.id}`)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50 hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                      {market.imageUrl ? (
                        <img
                          src={market.imageUrl}
                          alt={market.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground font-medium text-sm line-clamp-2">{market.title}</h4>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
