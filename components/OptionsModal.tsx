'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Prediction } from '@/lib/predictions';
import { cn } from '@/lib/utils';
import {
  Wallet,
  Loader2,
  CheckCircle,
  ExternalLink,
  Gift,
} from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useMarket, useToken, MarketInfo, UserPosition, MarketStatus, formatTokenAmount } from '@/hooks/useContracts';
import { MANTLE_SEPOLIA } from '@/lib/contracts';

// Color palette for multiple options
const OPTION_COLORS = [
  { bg: 'bg-[#00bf63]', bgLight: 'bg-[#00bf63]/20', text: 'text-[#00bf63]', border: 'border-[#00bf63]/30', hex: '#00bf63' },
  { bg: 'bg-[#ee3e3d]', bgLight: 'bg-[#ee3e3d]/20', text: 'text-[#ee3e3d]', border: 'border-[#ee3e3d]/30', hex: '#ee3e3d' },
  { bg: 'bg-[#ffa51f]', bgLight: 'bg-[#ffa51f]/20', text: 'text-[#ffa51f]', border: 'border-[#ffa51f]/30', hex: '#ffa51f' },
  { bg: 'bg-[#0081cc]', bgLight: 'bg-[#0081cc]/20', text: 'text-[#0081cc]', border: 'border-[#0081cc]/30', hex: '#0081cc' },
];

interface OptionsModalProps {
  prediction: Prediction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOptionIndex?: number;
}

const OptionsModal: React.FC<OptionsModalProps> = ({
  prediction,
  open,
  onOpenChange,
  initialOptionIndex = 0,
}) => {
  const { authenticated, login, user } = usePrivy();
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(initialOptionIndex);
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');

  // On-chain state
  const [marketInfo, setMarketInfo] = useState<MarketInfo | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isProcessing, setIsProcessing] = useState(false);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  // Contract hooks
  const contractAddress = prediction?.contractAddress || '';
  const { getMarketInfo, getUserPosition, buyShares, sellShares } = useMarket(contractAddress);
  const { getBalance } = useToken();

  // Reset state when modal opens with new option
  useEffect(() => {
    if (open) {
      setSelectedOptionIndex(initialOptionIndex);
      setAmount('');
      setTxSuccess(null);
    }
  }, [open, initialOptionIndex]);

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

  useEffect(() => {
    if (open && contractAddress) {
      fetchOnChainData();
    }
  }, [open, contractAddress, fetchOnChainData]);

  if (!prediction) return null;

  // Get options from on-chain data or prediction
  const options = marketInfo?.optionLabels || prediction.options || ['Yes', 'No'];
  const odds = marketInfo?.odds || prediction.odds || options.map(() => 100 / options.length);

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

    setIsProcessing(true);
    setTxSuccess(null);

    try {
      await buyShares(selectedOptionIndex, amount);
      const optionLabel = options[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      setTxSuccess(`Successfully bought ${optionLabel} shares!`);
      setAmount('');
      await fetchOnChainData();
    } catch (err) {
      console.error('Error buying shares:', err);
      alert(err instanceof Error ? err.message : 'Failed to buy shares');
    } finally {
      setIsProcessing(false);
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
      const optionLabel = options[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      alert(`You don't have any ${optionLabel} shares to sell`);
      return;
    }

    setIsProcessing(true);
    setTxSuccess(null);

    try {
      await sellShares(selectedOptionIndex, amount);
      const optionLabel = options[selectedOptionIndex] || `Option ${selectedOptionIndex + 1}`;
      setTxSuccess(`Successfully sold ${optionLabel} shares!`);
      setAmount('');
      await fetchOnChainData();
    } catch (err) {
      console.error('Error selling shares:', err);
      alert(err instanceof Error ? err.message : 'Failed to sell shares');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedColor = OPTION_COLORS[selectedOptionIndex % OPTION_COLORS.length];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogOverlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            </DialogOverlay>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%] max-w-md w-full border border-border bg-neutral-900 backdrop-blur-xl text-foreground p-0 gap-0 overflow-hidden rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <DialogClose className="absolute top-4 right-4 z-10 p-1 rounded-full hover:bg-neutral-800 transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </DialogClose>

              {/* Header */}
              <DialogHeader className="p-6 pb-4 pr-14 border-b border-border">
                <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-neutral-800 shrink-0">
              {prediction.imageUrl ? (
                <img
                  src={prediction.imageUrl}
                  alt={prediction.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                  <span className="text-lg font-bold text-muted-foreground">
                    {prediction.category.charAt(0)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold text-foreground leading-tight line-clamp-2">
                {prediction.title}
              </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{prediction.category}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{prediction.volume} Vol</span>
                  </div>
                </div>
              </div>
              </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType('buy')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                orderType === 'buy'
                  ? 'bg-primary/20 text-foreground border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-neutral-700 border border-transparent'
              )}
            >
              Buy
            </button>
            <button
              onClick={() => setOrderType('sell')}
              className={cn(
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-all',
                orderType === 'sell'
                  ? 'bg-primary/20 text-foreground border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-neutral-700 border border-transparent'
              )}
            >
              Sell
            </button>
          </div>

          {/* Option Selection */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Select Option</label>
            <div className="grid grid-cols-2 gap-2">
              {options.map((label, index) => {
                const color = OPTION_COLORS[index % OPTION_COLORS.length];
                const optionOdds = odds[index] || 0;
                return (
                  <button
                    key={index}
                    onClick={() => setSelectedOptionIndex(index)}
                    className={cn(
                      'py-3 px-3 rounded-xl text-sm font-semibold transition-all text-left flex items-center justify-between',
                      selectedOptionIndex === index
                        ? `${color.bg} text-white`
                        : `bg-neutral-800 text-muted-foreground border border-border hover:bg-neutral-700`
                    )}
                  >
                    <span className="truncate">{label}</span>
                    <span className={cn(
                      'text-xs ml-1',
                      selectedOptionIndex === index ? 'text-white/80' : 'text-muted-foreground'
                    )}>
                      {Math.round(optionOdds)}%
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Balance Display */}
          {authenticated && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 border border-border">
              <div>
                <p className="text-muted-foreground text-xs">MNT Balance</p>
              </div>
              <span className="text-foreground text-lg font-medium">
                {parseFloat(tokenBalance).toFixed(4)}
              </span>
            </div>
          )}

          {/* Amount Input */}
          <div>
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
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">MNT</span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-2">
            {['0.1', '0.5', '1', '5'].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val)}
                className={cn(
                  'flex-1 py-2 text-sm rounded-xl border transition-colors',
                  amount === val
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-neutral-800 text-muted-foreground hover:bg-neutral-700'
                )}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Potential Return */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 rounded-xl bg-neutral-800 border border-border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-muted-foreground text-sm">Amount</span>
                <span className="text-foreground font-medium">
                  {parseFloat(amount).toFixed(4)} MNT
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Potential return</span>
                <span className={cn('font-bold', selectedColor.text)}>
                  {((parseFloat(amount) || 0) / (odds[selectedOptionIndex] / 100)).toFixed(4)} MNT
                </span>
              </div>
            </div>
          )}

          {/* Transaction Success Message */}
          {txSuccess && (
            <div className="p-3 rounded-xl bg-primary/20 border border-primary/30 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
              <span className="text-foreground text-sm">{txSuccess}</span>
            </div>
          )}

          {/* Buy/Sell Button */}
          <button
            type="button"
            onClick={orderType === 'buy' ? handleBuy : handleSell}
            disabled={!amount || isProcessing || !contractAddress}
            className={cn(
              'w-full py-4 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
              orderType === 'buy'
                ? `${selectedColor.bg} hover:opacity-90 text-white`
                : 'bg-neutral-800 hover:bg-neutral-700 text-foreground border border-border'
            )}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing...
              </>
            ) : !authenticated ? (
              <>
                <Wallet className="h-4 w-4" />
                Connect Wallet to Trade
              </>
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
            <div className="p-3 rounded-xl bg-neutral-800 border border-border">
              <p className="text-muted-foreground text-xs mb-2">Your Position</p>
              <div className="space-y-1">
                {options.map((label, index) => {
                  const shares = userPosition.shares[index];
                  if (!shares || shares === 0n) return null;
                  const color = OPTION_COLORS[index % OPTION_COLORS.length];
                  return (
                    <div key={index} className="flex justify-between">
                      <span className={cn('text-sm', color.text)}>{label}</span>
                      <span className="text-foreground font-medium text-sm">{formatTokenAmount(shares)} shares</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contract Info */}
          {contractAddress && (
            <div className="pt-2 border-t border-border">
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
            </motion.div>
          </DialogPortal>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export default OptionsModal;
