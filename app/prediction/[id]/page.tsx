'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Prediction, PollFromAPI, transformPollToPrediction } from '@/lib/predictions';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Share2,
  Download,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Info,
  Loader2,
  Wallet,
  ExternalLink,
  CheckCircle,
  Trophy,
  Gift,
} from 'lucide-react';
import PriceChart from '@/components/PriceChart';
import { useMarket, useToken, MarketInfo, UserPosition, MarketStatus, formatTokenAmount } from '@/hooks/useContracts';
import { MANTLE_SEPOLIA } from '@/lib/contracts';

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
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [relatedMarkets, setRelatedMarkets] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [rulesExpanded, setRulesExpanded] = useState(true);
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // On-chain state
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isBuying, setIsBuying] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Contract hooks
  const contractAddress = prediction?.contractAddress || '';
  const { getMarketInfo, getUserPosition, buyShares, sellShares, claimWinnings, isLoading: isContractLoading } = useMarket(contractAddress);
  const { getBalance } = useToken();

  // Fetch on-chain data
  const fetchOnChainData = useCallback(async () => {
    if (!contractAddress) return;

    try {
      const info = await getMarketInfo();
      setMarketInfo(info);

      if (user?.wallet?.address) {
        const position = await getUserPosition();
        setUserPosition(position);
        const balance = await getBalance();
        setTokenBalance(balance);
      }
    } catch (err) {
      console.error('Error fetching on-chain data:', err);
    }
  }, [contractAddress, getMarketInfo, getUserPosition, getBalance, user?.wallet?.address]);

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
      setAmount('');
      await fetchOnChainData();
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
      setAmount('');
      await fetchOnChainData();
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
      await fetchOnChainData();
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

  useEffect(() => {
    const fetchPrediction = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/poll/${params.id}`);
        const data = await response.json();

        if (data.success && data.poll) {
          const transformedPoll = transformPollToPrediction(data.poll);
          setPrediction(transformedPoll);

          // Fetch related markets
          const relatedResponse = await fetch(`/api/poll?category=${encodeURIComponent(data.poll.category)}&limit=4`);
          const relatedData = await relatedResponse.json();
          if (relatedData.success && relatedData.polls) {
            const related = relatedData.polls
              .filter((p: PollFromAPI) => p._id !== params.id)
              .slice(0, 3)
              .map((p: PollFromAPI) => transformPollToPrediction(p));
            setRelatedMarkets(related);
          }
        }
      } catch (err) {
        console.error('Error fetching prediction:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchPrediction();
    }
  }, [params.id]);

  useEffect(() => {
    if (contractAddress) {
      fetchOnChainData();
    }
  }, [contractAddress, fetchOnChainData]);

  // Get options from on-chain data or prediction
  const options = marketInfo?.optionLabels || prediction?.options || ['Yes', 'No'];
  const odds = marketInfo?.odds || prediction?.odds || options.map(() => 100 / options.length);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
        <p className="text-muted-foreground text-sm mt-4">Loading market...</p>
      </div>
    );
  }

  if (!prediction) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
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
      </div>
    );
  }

  return (
    <div className="w-[80%] flex flex-col py-6 overflow-y-auto scrollbar-hide">
      {/* Back Navigation */}
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Header */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted shrink-0">
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

            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground leading-tight mb-2">
                {prediction.title}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Share2 className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Download className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <PlusCircle className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Claim Winnings Banner - Shows when market is resolved */}
          {marketInfo?.status === MarketStatus.Resolved && authenticated && (
            <div className={cn(
              'rounded-2xl border p-6',
              userWinningsInfo.hasWinningShares && !userPosition?.hasClaimed
                ? 'bg-primary/15 border-primary/30'
                : userPosition?.hasClaimed
                  ? 'bg-muted border border-border'
                  : 'bg-muted/50 border-border'
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'p-3 rounded-xl',
                    userWinningsInfo.hasWinningShares && !userPosition?.hasClaimed
                      ? 'bg-primary/20'
                      : userPosition?.hasClaimed
                        ? 'bg-muted'
                        : 'bg-muted'
                  )}>
                    {userPosition?.hasClaimed ? (
                      <CheckCircle className="h-6 w-6 text-primary" />
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
                    className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
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
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <span className="text-muted-foreground text-sm">Outcome</span>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground text-sm w-20 text-center">Chance</span>
                <span className="w-28"></span>
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
                    'flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0 transition-colors',
                    isSelected && `${color.bgLight}`,
                    isWinner && marketInfo?.status === MarketStatus.Resolved && 'bg-primary/10'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', color.bgLight)}>
                      <span className={cn('font-bold', color.text)}>{index + 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{label}</span>
                      {isWinner && (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-foreground font-bold text-lg w-20 text-center">
                      {Math.round(optionOdds)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOptionIndex(index);
                        setOrderType('buy');
                      }}
                      className={cn(
                        'w-28 py-2 px-4 rounded-lg text-sm font-semibold transition-all',
                        isSelected
                          ? `${color.bg} text-primary-foreground`
                          : `${color.bgLight} ${color.text} border ${color.border} hover:opacity-80`
                      )}
                    >
                      Buy {Math.round(optionOdds)}%
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
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl">
            <button
              onClick={() => setRulesExpanded(!rulesExpanded)}
              className="w-full flex items-center justify-between p-6"
            >
              <h3 className="text-lg font-semibold text-foreground">Rules summary</h3>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                {rulesExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </button>

            {rulesExpanded && (
              <div className="px-6 pb-6 space-y-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {prediction.description || `This market resolves based on the outcome of: "${prediction.title}". Multiple options can win.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.map((opt, i) => (
                    <span key={i} className="px-3 py-1 rounded-lg bg-muted text-foreground text-sm">
                      {opt}
                    </span>
                  ))}
                </div>
                <p className="text-muted-foreground text-sm">
                  Market end date: <span className="text-foreground">{prediction.endDate}</span>
                </p>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full flex items-center justify-between p-6"
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <h3 className="text-base font-medium text-foreground">Timeline and payout</h3>
              </div>
              {timelineExpanded ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {timelineExpanded && (
              <div className="px-6 pb-6 space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground text-sm">Market closes</span>
                  <span className="text-foreground font-medium">{prediction.endDate}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-border">
                  <span className="text-muted-foreground text-sm">Options</span>
                  <span className="text-foreground font-medium">{options.length} outcomes</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-muted-foreground text-sm">Payout</span>
                  <span className="text-foreground font-medium">Proportional to winning shares</span>
                </div>
              </div>
            )}
          </div>

          {/* Related Markets */}
          {relatedMarkets.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Related markets</h3>
              <div className="space-y-3">
                {relatedMarkets.map((market) => (
                  <div
                    key={market.id}
                    onClick={() => router.push(`/prediction/${market.id}`)}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                      {market.imageUrl ? (
                        <img
                          src={market.imageUrl}
                          alt={market.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-foreground font-medium text-sm truncate">{market.title}</h4>
                      <span className="text-muted-foreground text-xs">{market.volume} Vol</span>
                    </div>
                    <div className="text-right">
                      <span className="text-foreground font-bold">{Math.round(market.odds[0] || 50)}%</span>
                      <span className="text-muted-foreground text-xs block">{market.options[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Order Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/50 backdrop-blur-xl p-6 sticky top-6">
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
                          : `bg-muted text-muted-foreground border border-border hover:bg-muted/80`
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
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted border border-border mb-4">
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
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
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
                      : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {val} MNT
                </button>
              ))}
            </div>

            {/* Potential Return */}
            {amount && (
              <div className="mb-4 p-4 rounded-xl bg-muted border border-border">
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
                <CheckCircle className="h-4 w-4 text-primary" />
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
              <div className="mt-4 p-4 rounded-xl bg-muted border border-border">
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
                    <CheckCircle className="h-4 w-4" />
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
        </div>
      </div>
    </div>
  );
}
