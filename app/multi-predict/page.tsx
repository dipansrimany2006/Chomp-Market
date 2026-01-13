'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle,
  Wallet,
  Search,
  Plus,
  Minus,
  Trash2,
  BarChart3,
  Clock,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import PageTransition from '@/components/ui/page-transition';
import { Prediction, PollFromAPI, transformPollToPrediction } from '@/lib/predictions';
import { useUserBalance, useCategories } from '@/hooks/useQueries';
import { MANTLE_SEPOLIA, CONTRACTS, getMarketContract } from '@/lib/contracts';
import { useBatchPrediction } from '@/hooks/useContracts';
import { toast } from "sonner";
// Color palette for options
const OPTION_COLORS = [
  { bg: 'bg-[#00bf63]', bgLight: 'bg-[#00bf63]/20', text: 'text-[#00bf63]', hex: '#00bf63' },
  { bg: 'bg-[#ee3e3d]', bgLight: 'bg-[#ee3e3d]/20', text: 'text-[#ee3e3d]', hex: '#ee3e3d' },
  { bg: 'bg-[#ffa51f]', bgLight: 'bg-[#ffa51f]/20', text: 'text-[#ffa51f]', hex: '#ffa51f' },
  { bg: 'bg-[#0081cc]', bgLight: 'bg-[#0081cc]/20', text: 'text-[#0081cc]', hex: '#0081cc' },
];

const STEPS = [
  { id: 1, title: 'Deposit' },
  { id: 2, title: 'Select Markets' },
  { id: 3, title: 'Review' },
];

interface SelectedMarket {
  prediction: Prediction;
  selectedOptionIndex: number;
  allocationPercent: number;
}

export default function MultiPredictPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();
  const { data: balance, isLoading: isBalanceLoading } = useUserBalance();
  const { data: categoriesData } = useCategories();
  const { executeBatchPrediction } = useBatchPrediction();

  const [currentStep, setCurrentStep] = useState(1);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedMarkets, setSelectedMarkets] = useState<SelectedMarket[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<Prediction[]>([]);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const categories = ['All', ...(categoriesData?.categories || [])];

  // Fetch available markets
  const fetchMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    try {
      const categoryParam = selectedCategory !== 'All'
        ? `?category=${encodeURIComponent(selectedCategory)}&status=active`
        : '?status=active';
      const res = await fetch(`/api/poll${categoryParam}`);
      const data = await res.json();

      if (data.success && data.polls) {
        const predictions = data.polls.map((poll: PollFromAPI) => transformPollToPrediction(poll));
        setAvailableMarkets(predictions);
      }
    } catch (err) {
      console.error('Error fetching markets:', err);
    } finally {
      setIsLoadingMarkets(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  // Calculate totals
  const totalAllocatedPercent = selectedMarkets.reduce((sum, m) => sum + m.allocationPercent, 0);
  const remainingPercent = 100 - totalAllocatedPercent;
  const depositValue = parseFloat(depositAmount) || 0;

  // Filter markets based on search, exclude already selected, and require contractAddress
  const filteredMarkets = availableMarkets.filter(market => {
    const isSelected = selectedMarkets.some(sm => sm.prediction.id === market.id);
    const matchesSearch = market.title.toLowerCase().includes(searchQuery.toLowerCase());
    const hasContract = !!market.contractAddress;
    return !isSelected && matchesSearch && hasContract;
  });

  // Check if a market is open on-chain with detailed info
  const checkMarketOpen = async (contractAddress: string): Promise<boolean> => {
    try {
      const market = getMarketContract(contractAddress);
      const [isOpen, endTime, status, optionCount] = await Promise.all([
        market.isOpenForBetting(),
        market.endTime(),
        market.marketStatus(),
        market.optionCount(),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const endTimeNum = Number(endTime);

      console.log('Market check:', {
        contractAddress,
        isOpen,
        status: Number(status),
        optionCount: Number(optionCount),
        endTime: endTimeNum,
        now,
        timeRemaining: endTimeNum - now,
        isExpired: now >= endTimeNum,
      });

      return isOpen;
    } catch (err) {
      console.error('Error checking market:', contractAddress, err);
      return false;
    }
  };

  // Validate option index for a market
  const validateOptionIndex = async (contractAddress: string, optionIndex: number): Promise<boolean> => {
    try {
      const market = getMarketContract(contractAddress);
      const optionCount = await market.optionCount();
      const isValid = optionIndex < Number(optionCount);
      console.log('Option validation:', { contractAddress, optionIndex, optionCount: Number(optionCount), isValid });
      return isValid;
    } catch (err) {
      console.error('Error validating option:', err);
      return false;
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!depositAmount || parseFloat(depositAmount) <= 0) {
          toast.error('Please enter a valid deposit amount');
          return false;
        }
        if (balance && parseFloat(depositAmount) > parseFloat(balance)) {
          toast.error('Insufficient balance');
          return false;
        }
        return true;
      case 2:
        if (selectedMarkets.length === 0) {
          toast.error('Please select at least one market');
          return false;
        }
        if (totalAllocatedPercent === 0) {
          toast.error('Please allocate some percentage to your predictions');
          return false;
        }
        if (totalAllocatedPercent > 100) {
          toast.error('Total allocation cannot exceed 100%');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const goToStep = (step: number) => {
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const [isCheckingMarket, setIsCheckingMarket] = useState<string | null>(null);

  const handleAddMarket = async (prediction: Prediction) => {
    if (!prediction.contractAddress) {
      toast.error('This market does not have an on-chain contract');
      return;
    }

    setIsCheckingMarket(prediction.id);

    try {
      const isOpen = await checkMarketOpen(prediction.contractAddress);
      if (!isOpen) {
        toast.error('This market is not open for betting (expired or resolved)');
        return;
      }

      setSelectedMarkets(prev => [
        ...prev,
        {
          prediction,
          selectedOptionIndex: 0,
          allocationPercent: 0,
        }
      ]);
    } catch (err) {
      toast.error('Failed to verify market status');
      console.error(err);
    } finally {
      setIsCheckingMarket(null);
    }
  };

  const handleRemoveMarket = (predictionId: string) => {
    setSelectedMarkets(prev => prev.filter(m => m.prediction.id !== predictionId));
  };

  const handleOptionChange = (predictionId: string, optionIndex: number) => {
    setSelectedMarkets(prev => prev.map(m =>
      m.prediction.id === predictionId
        ? { ...m, selectedOptionIndex: optionIndex }
        : m
    ));
  };

  const handleAllocationChange = (predictionId: string, percent: number) => {
    const clampedPercent = Math.max(0, Math.min(percent, 100));
    setSelectedMarkets(prev => prev.map(m =>
      m.prediction.id === predictionId
        ? { ...m, allocationPercent: clampedPercent }
        : m
    ));
  };

  const handleSubmit = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!user?.wallet?.address) {
      toast.error('Please connect your wallet');
      return;
    }

    // Check if batch prediction contract is deployed
    if (!CONTRACTS.BATCH_PREDICTION) {
      toast.error('BatchPrediction contract not deployed. Please deploy the contract first and add its address to lib/contracts.ts');
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare the batch prediction data - filter markets with valid contract addresses and allocation > 0
      const validMarkets = selectedMarkets.filter(
        m => m.allocationPercent > 0 && m.prediction.contractAddress
      );

      if (validMarkets.length === 0) {
        toast.error('No valid markets selected. Markets must have contract addresses and allocation > 0.');
        setIsSubmitting(false);
        return;
      }

      // Verify all markets are still open for betting
      console.log('Verifying markets are open...');
      const openChecks = await Promise.all(
        validMarkets.map(m => checkMarketOpen(m.prediction.contractAddress!))
      );

      const closedMarkets = validMarkets.filter((_, i) => !openChecks[i]);
      if (closedMarkets.length > 0) {
        const closedNames = closedMarkets.map(m => m.prediction.title).join(', ');
        toast.error(`These markets are no longer open for betting: ${closedNames}`);
        setIsSubmitting(false);
        return;
      }

      // Verify option indices are valid
      console.log('Verifying option indices...');
      const optionChecks = await Promise.all(
        validMarkets.map(m =>
          validateOptionIndex(m.prediction.contractAddress!, m.selectedOptionIndex)
        )
      );

      const invalidOptionMarkets = validMarkets.filter((_, i) => !optionChecks[i]);
      if (invalidOptionMarkets.length > 0) {
        const invalidNames = invalidOptionMarkets.map(m => m.prediction.title).join(', ');
        toast.error(`Invalid option selected for: ${invalidNames}`);
        setIsSubmitting(false);
        return;
      }

      const batchData = validMarkets.map(m => ({
        marketAddress: m.prediction.contractAddress!,
        optionIndex: m.selectedOptionIndex,
        amount: ((depositValue * m.allocationPercent) / 100).toFixed(6),
      }));

      console.log('Batch prediction data:', batchData);
      console.log('Total value:', batchData.reduce((sum, d) => sum + parseFloat(d.amount), 0), 'MNT');

      // Execute batch prediction using the smart contract
      const hash = await executeBatchPrediction(batchData);

      setTxHash(hash);
      setIsSuccess(true);
      toast.success('Predictions submitted successfully!');

      // Increment totalTrades for all markets in the batch
      await Promise.all(
        validMarkets.map(async (m) => {
          try {
            const pollRes = await fetch(`/api/poll/${m.prediction.id}`).then(res => res.json());
            const currentTrades = pollRes?.poll?.totalTrades || 0;
            await fetch(`/api/poll/${m.prediction.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ totalTrades: currentTrades + 1 }),
            });
          } catch (err) {
            console.error(`Failed to increment trade count for ${m.prediction.id}:`, err);
          }
        })
      );

      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: unknown) {
      console.error('Error submitting predictions:', err);

      // Parse different error types for better messages
      let errorMessage = 'Failed to submit predictions';

      if (err && typeof err === 'object') {
        const error = err as Record<string, unknown>;

        // Check for common error patterns
        if (error.reason) {
          errorMessage = String(error.reason);
        } else if (error.message) {
          const msg = String(error.message);

          // Parse common contract errors
          if (msg.includes('MarketEnded') || msg.includes('Market ended')) {
            errorMessage = 'One or more markets have ended and are no longer accepting bets';
          } else if (msg.includes('MarketNotActive')) {
            errorMessage = 'One or more markets are not active';
          } else if (msg.includes('InvalidOption')) {
            errorMessage = 'Invalid option selected for one or more markets';
          } else if (msg.includes('insufficient funds') || msg.includes('Insufficient')) {
            errorMessage = 'Insufficient balance to complete this transaction';
          } else if (msg.includes('user rejected') || msg.includes('User denied')) {
            errorMessage = 'Transaction was rejected by user';
          } else if (msg.includes('All predictions failed')) {
            errorMessage = 'All selected markets failed validation. They may be closed or expired.';
          } else if (msg.includes('missing revert data')) {
            errorMessage = 'Transaction would fail. The markets may be expired or have other issues. Please check the console for details.';
          } else {
            // Show truncated message for other errors
            errorMessage = msg.length > 150 ? msg.substring(0, 150) + '...' : msg;
          }
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen
  if (isSuccess) {
    return (
      <PageTransition className="min-h-[80vh] flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6 animate-pulse">
            <CheckCircle className="h-12 w-12 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Predictions Submitted!</h1>
          <p className="text-muted-foreground mb-6">
            Your multi-market predictions have been submitted successfully.
          </p>
          {txHash && (
            <div className="mb-6 p-4 rounded-xl bg-card border border-border">
              <p className="text-muted-foreground text-xs mb-2">Transaction Hash</p>
              <a
                href={`${MANTLE_SEPOLIA.blockExplorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 text-sm font-mono break-all"
              >
                {txHash}
              </a>
            </div>
          )}
          <p className="text-muted-foreground text-sm animate-pulse">Redirecting to home...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => currentStep === 1 ? router.push('/') : handleBack()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">
            {currentStep === 1 ? 'Back to Markets' : 'Previous Step'}
          </span>
        </button>
      </div>

      {/* Page Title */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Multi-Market Prediction
        </h1>
        <p className="text-muted-foreground">
          Predict on multiple markets in a single transaction
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center mb-8 overflow-x-auto">
        <div className="flex items-center gap-2 sm:gap-4">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isClickable = step.id <= currentStep;

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => goToStep(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && 'bg-green-500 text-white',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                    isClickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-current/20 flex items-center justify-center text-xs">
                      {step.id}
                    </span>
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-8 sm:w-12 h-0.5 mx-2',
                      step.id < currentStep ? 'bg-green-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {/* Step 1: Deposit Amount */}
        {currentStep === 1 && (
          <div className="max-w-lg mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Deposit Funds</h2>
                <p className="text-muted-foreground text-sm">
                  Enter the total amount you want to allocate across predictions
                </p>
              </div>

              {/* Balance Display */}
              {authenticated && (
                <div className="mb-6 p-4 rounded-xl bg-neutral-800 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">Your Balance</span>
                    <span className="text-foreground font-semibold text-lg">
                      {isBalanceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `${parseFloat(balance || '0').toFixed(4)} MNT`
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">
                  Amount to Deposit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-neutral-800 border border-border rounded-xl px-4 py-4 text-xl text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors pr-16"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    MNT
                  </span>
                </div>

                {/* Quick Select */}
                <div className="flex gap-2">
                  {['25%', '50%', '75%', 'Max'].map((label) => {
                    const percent = label === 'Max' ? 100 : parseInt(label);
                    const value = balance ? ((parseFloat(balance) * percent) / 100).toFixed(4) : '0';
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setDepositAmount(value)}
                        disabled={!balance || parseFloat(balance) === 0}
                        className="flex-1 py-2 text-sm rounded-xl border border-border bg-neutral-800 text-muted-foreground hover:bg-primary/10 hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Warning */}
              <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground">
                    This amount will be locked until predictions resolve. Only deposit what you can afford to lose.
                  </p>
                </div>
              </div>
            </div>

            {/* Connect Wallet Prompt */}
            {!authenticated && (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 flex items-center gap-3">
                <Wallet className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-foreground font-medium">Connect your wallet</p>
                  <p className="text-muted-foreground text-sm">Required to make predictions</p>
                </div>
                <button
                  onClick={() => login()}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                >
                  Connect
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Select Markets & Allocate */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Allocation Summary Bar */}
            <div className="rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl p-5 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-foreground font-semibold">Deposited: </span>
                  <span className="text-primary font-bold">{depositValue.toFixed(4)} MNT</span>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground">Allocated: </span>
                  <span className={cn(
                    'font-semibold',
                    totalAllocatedPercent > 100 ? 'text-red-500' : 'text-green-500'
                  )}>
                    {totalAllocatedPercent}%
                  </span>
                  <span className="text-muted-foreground"> | Remaining: </span>
                  <span className="text-foreground font-semibold">{Math.max(0, remainingPercent)}%</span>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-300',
                    totalAllocatedPercent > 100 ? 'bg-red-500' : 'bg-green-500'
                  )}
                  style={{ width: `${Math.min(totalAllocatedPercent, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
              {/* Selected Markets */}
              <div className="space-y-5">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  Selected Markets ({selectedMarkets.length})
                </h3>

                {selectedMarkets.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
                    <p className="text-muted-foreground text-lg">No markets selected yet</p>
                    <p className="text-muted-foreground text-sm mt-2">Add markets from the right panel</p>
                  </div>
                ) : (
                  <div className="space-y-5 max-h-[550px] overflow-y-auto pr-3">
                    {selectedMarkets.map((market) => {
                      const options = market.prediction.options || ['Yes', 'No'];
                      const odds = market.prediction.odds || options.map(() => 100 / options.length);
                      const allocatedAmount = (depositValue * market.allocationPercent) / 100;

                      return (
                        <div
                          key={market.prediction.id}
                          className="rounded-2xl border border-border bg-neutral-900 p-5"
                        >
                          {/* Market Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              {market.prediction.imageUrl && (
                                <img
                                  src={market.prediction.imageUrl}
                                  alt=""
                                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                                />
                              )}
                              <div className="min-w-0">
                                <h4 className="text-base font-semibold text-foreground line-clamp-2">
                                  {market.prediction.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {market.prediction.category}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveMarket(market.prediction.id)}
                              className="p-2.5 rounded-xl hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>

                          {/* Option Selection */}
                          <div className="mb-4">
                            <p className="text-sm text-muted-foreground mb-3">Select Option</p>
                            <div className="flex flex-wrap gap-3">
                              {options.map((option, index) => {
                                const color = OPTION_COLORS[index % OPTION_COLORS.length];
                                const isSelected = market.selectedOptionIndex === index;
                                return (
                                  <button
                                    key={index}
                                    onClick={() => handleOptionChange(market.prediction.id, index)}
                                    className={cn(
                                      'px-4 py-2 rounded-xl text-sm font-medium transition-all',
                                      isSelected
                                        ? `${color.bg} text-white`
                                        : 'bg-neutral-800 text-muted-foreground hover:bg-neutral-700'
                                    )}
                                  >
                                    {option} ({Math.round(odds[index])}%)
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Allocation Slider */}
                          <div className="pt-4 border-t border-border/50">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm text-muted-foreground">Allocation</p>
                              <p className="text-base font-semibold text-foreground">
                                {market.allocationPercent}% = {allocatedAmount.toFixed(4)} MNT
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => handleAllocationChange(market.prediction.id, market.allocationPercent - 5)}
                                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-foreground transition-colors"
                              >
                                <Minus className="h-5 w-5" />
                              </button>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={market.allocationPercent}
                                onChange={(e) => handleAllocationChange(market.prediction.id, parseInt(e.target.value))}
                                className="flex-1 accent-primary h-2"
                              />
                              <button
                                onClick={() => handleAllocationChange(market.prediction.id, market.allocationPercent + 5)}
                                className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-foreground transition-colors"
                              >
                                <Plus className="h-5 w-5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Available Markets */}
              <div className="space-y-5">
                <h3 className="text-xl font-semibold text-foreground flex items-center gap-3">
                  <Plus className="h-6 w-6 text-primary" />
                  Add Markets
                </h3>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search markets..."
                    className="w-full bg-neutral-800 border border-border rounded-2xl pl-12 pr-4 py-3.5 text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        'px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors',
                        selectedCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-neutral-800 text-muted-foreground hover:bg-neutral-700'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Markets List */}
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-3">
                  {isLoadingMarkets ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : filteredMarkets.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-2">No on-chain markets available</p>
                      <p className="text-xs text-muted-foreground/70">
                        Only markets with deployed smart contracts can be used for batch predictions
                      </p>
                    </div>
                  ) : (
                    filteredMarkets.map((market) => (
                      <div
                        key={market.id}
                        className="rounded-2xl border border-border bg-neutral-900 p-4 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          {market.imageUrl && (
                            <img
                              src={market.imageUrl}
                              alt=""
                              className="w-14 h-14 rounded-xl object-cover shrink-0"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-medium text-foreground line-clamp-2">
                              {market.title}
                            </h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <BarChart3 className="h-4 w-4" />
                                {market.volume}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" />
                                {market.endDate}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddMarket(market)}
                            disabled={isCheckingMarket === market.id}
                            className="px-4 py-2 rounded-xl bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-wait"
                          >
                            {isCheckingMarket === market.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              '+ Add'
                            )}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Summary Card */}
            <div className="rounded-2xl border border-primary/30 bg-neutral-900 backdrop-blur-xl p-6">
              <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Prediction Summary
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-xl bg-neutral-800">
                  <p className="text-xs text-muted-foreground">Total Deposit</p>
                  <p className="text-lg font-bold text-foreground">{depositValue.toFixed(4)} MNT</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-800">
                  <p className="text-xs text-muted-foreground">Markets</p>
                  <p className="text-lg font-bold text-foreground">{selectedMarkets.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-800">
                  <p className="text-xs text-muted-foreground">Allocated</p>
                  <p className="text-lg font-bold text-green-500">
                    {((depositValue * totalAllocatedPercent) / 100).toFixed(4)} MNT
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-neutral-800">
                  <p className="text-xs text-muted-foreground">Unallocated</p>
                  <p className="text-lg font-bold text-foreground">
                    {((depositValue * remainingPercent) / 100).toFixed(4)} MNT
                  </p>
                </div>
              </div>

              {remainingPercent > 0 && (
                <div className="mb-6 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    {((depositValue * remainingPercent) / 100).toFixed(4)} MNT ({remainingPercent}%) will be returned to your wallet
                  </p>
                </div>
              )}
            </div>

            {/* Prediction Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Prediction Breakdown</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedMarkets.filter(m => m.allocationPercent > 0).map((market) => {
                  const options = market.prediction.options || ['Yes', 'No'];
                  const odds = market.prediction.odds || options.map(() => 100 / options.length);
                  const selectedOption = options[market.selectedOptionIndex];
                  const selectedOdds = odds[market.selectedOptionIndex];
                  const allocatedAmount = (depositValue * market.allocationPercent) / 100;
                  const color = OPTION_COLORS[market.selectedOptionIndex % OPTION_COLORS.length];

                  // Helper to format wallet address as username
                  const formatAddress = (address?: string): string => {
                    if (!address) return '@anonymous';
                    return `@${address.slice(0, 6)}...${address.slice(-4)}`;
                  };

                  // Helper to get relative time
                  const getRelativeTime = (dateString?: string): string => {
                    if (!dateString) return '';
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    if (diffDays === 0) return 'today';
                    if (diffDays === 1) return 'yesterday';
                    if (diffDays < 7) return `${diffDays} days ago`;
                    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
                    return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
                  };

                  return (
                    <div
                      key={market.prediction.id}
                      className="bg-neutral-900 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-border p-4 sm:p-5"
                    >
                      {/* Header: Creator + Timestamp */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden">
                            <span className="text-primary-foreground text-xs font-medium">
                              {market.prediction.creatorAddress ? market.prediction.creatorAddress.slice(2, 4).toUpperCase() : 'AN'}
                            </span>
                          </div>
                          <span className="text-foreground/90 text-sm font-medium">
                            {formatAddress(market.prediction.creatorAddress)}
                          </span>
                        </div>
                        <span className="text-muted-foreground text-xs">
                          {getRelativeTime(market.prediction.createdAt)}
                        </span>
                      </div>

                      {/* Badges Row */}
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Active
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          MNT
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
                          {market.prediction.category}
                        </span>
                      </div>

                      {/* Content: Image + Title */}
                      <div className="flex gap-4 mb-4">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                          {market.prediction.imageUrl ? (
                            <img
                              src={market.prediction.imageUrl}
                              alt={market.prediction.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>
                        <h4 className="text-base font-semibold text-foreground leading-snug line-clamp-2 flex-1">
                          {market.prediction.title}
                        </h4>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mb-4 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>{market.prediction.volume}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-primary">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{Math.abs(market.prediction.priceChange || 0).toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Amount Bar (instead of Conviction) */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-muted-foreground text-sm">Amount</span>
                          <span className="text-foreground font-semibold text-sm">
                            {market.allocationPercent}% ({allocatedAmount.toFixed(4)} MNT)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full transition-all duration-300 bg-primary"
                            style={{ width: `${market.allocationPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Selected Option Display */}
                      <div
                        className={cn(
                          'w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white text-center',
                          color.bg
                        )}
                      >
                        {selectedOption} ({Math.round(selectedOdds)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit Warning */}
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground font-medium">Important</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    By clicking Submit, you will sign ONE transaction that executes all predictions.
                    This action cannot be undone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-4 mt-8 max-w-4xl mx-auto">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-4 rounded-xl font-semibold border border-border text-foreground hover:bg-muted transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            Back
          </button>
        )}

        {currentStep < STEPS.length ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!authenticated && currentStep === 1}
            className="flex-1 py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Continue
            <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !authenticated || selectedMarkets.filter(m => m.allocationPercent > 0).length === 0}
            className="flex-1 py-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Submitting Predictions...
              </>
            ) : (
              <>
                <Rocket className="h-5 w-5" />
                Submit Predictions
              </>
            )}
          </button>
        )}
      </div>

      {/* Footer Note */}
      <p className="text-center text-xs text-muted-foreground mt-6 max-w-4xl mx-auto">
        All predictions are executed in a single transaction on Mantle Sepolia testnet.
      </p>
    </PageTransition>
  );
}
