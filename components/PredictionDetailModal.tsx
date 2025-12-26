'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Prediction } from '@/lib/predictions';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  Users,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';
import PriceChart from './PriceChart';

// Color palette for multiple options
const OPTION_COLORS = [
  { text: 'text-[#00bf63]', bg: 'bg-[#00bf63]', border: 'border-[#00bf63]/50', bgLight: 'bg-[#00bf63]/10' },
  { text: 'text-[#ee3e3d]', bg: 'bg-[#ee3e3d]', border: 'border-[#ee3e3d]/50', bgLight: 'bg-[#ee3e3d]/10' },
  { text: 'text-[#ffa51f]', bg: 'bg-[#ffa51f]', border: 'border-[#ffa51f]/50', bgLight: 'bg-[#ffa51f]/10' },
  { text: 'text-[#0081cc]', bg: 'bg-[#0081cc]', border: 'border-[#0081cc]/50', bgLight: 'bg-[#0081cc]/10' },
];

interface PredictionDetailModalProps {
  prediction: Prediction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const PredictionDetailModal: React.FC<PredictionDetailModalProps> = ({
  prediction,
  open,
  onOpenChange,
}) => {
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [amount, setAmount] = useState('');

  if (!prediction) return null;

  const options = prediction.options || ['Yes', 'No'];
  const odds = prediction.odds || options.map(() => 100 / options.length);

  const handleBuy = () => {
    // Handle buy logic here
    console.log(`Buying option ${selectedOptionIndex} (${options[selectedOptionIndex]}) for ${amount}`);
  };

  const selectedOdds = odds[selectedOptionIndex] || 50;
  const selectedColor = OPTION_COLORS[selectedOptionIndex % OPTION_COLORS.length];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-[#fffaf3]/10 bg-[#000]/95 backdrop-blur-xl text-[#fffaf3] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-[#fffaf3]/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-full border border-[#fffaf3]/20 bg-[#fffaf3]/5 px-2.5 py-0.5 text-xs font-medium text-[#fffaf3]/70">
                  {prediction.category}
                </span>
                {prediction.isHot && (
                  <span className="flex items-center gap-1 rounded-full bg-[#fffaf3]/20 px-2 py-0.5 text-xs font-medium text-[#fffaf3]">
                    <Zap className="h-3 w-3" />
                    Hot
                  </span>
                )}
              </div>
              <DialogTitle className="text-xl font-bold text-[#fffaf3] leading-tight">
                {prediction.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Probability Display - Dynamic Options */}
          <div className={cn(
            'grid gap-3',
            options.length === 2 ? 'grid-cols-2' : options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          )}>
            {options.map((option, index) => {
              const color = OPTION_COLORS[index % OPTION_COLORS.length];
              const optionOdds = odds[index] || 0;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedOptionIndex(index)}
                  className={cn(
                    'relative overflow-hidden rounded-xl p-4 transition-all border',
                    selectedOptionIndex === index
                      ? `${color.border} ${color.bgLight}`
                      : 'border-[#fffaf3]/10 bg-[#fffaf3]/5 hover:border-[#fffaf3]/20'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#fffaf3]/70 truncate">{option}</span>
                    <ArrowUpRight className={cn('h-4 w-4', color.text)} />
                  </div>
                  <div className={cn('text-3xl font-bold', color.text)}>
                    {Math.round(optionOdds)}%
                  </div>
                  <div className="text-xs text-[#fffaf3]/50 mt-1">
                    {(optionOdds / 100).toFixed(2)} MNT per share
                  </div>
                </button>
              );
            })}
          </div>

          {/* Price Chart */}
          <PriceChart
            options={options.map((label, i) => ({
              label,
              percentage: odds[i] || 50,
            }))}
            height={160}
            className="bg-[#fffaf3]/5"
          />

          {/* Buy Section */}
          <div className="rounded-xl border border-[#fffaf3]/10 bg-[#fffaf3]/5 p-4">
            <div className="text-sm font-medium text-[#fffaf3]/70 mb-3">
              Place Order - {options[selectedOptionIndex]}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-[#000]/50 border border-[#fffaf3]/20 rounded-lg px-3 py-2.5 pr-14 text-[#fffaf3] placeholder-[#fffaf3]/30 focus:outline-none focus:border-[#fffaf3]/40 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fffaf3]/50 text-sm">
                    MNT
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBuy}
                disabled={!amount}
                className={cn(
                  'px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white',
                  selectedColor.bg,
                  `hover:opacity-90`
                )}
              >
                Buy {options[selectedOptionIndex]}
              </button>
            </div>
            {amount && (
              <div className="mt-3 text-xs text-[#fffaf3]/50">
                Potential return:{' '}
                <span className={selectedColor.text}>
                  {((parseFloat(amount) || 0) / selectedOdds * 100).toFixed(4)} MNT
                </span>{' '}
                if {options[selectedOptionIndex]} wins
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#fffaf3]/10 bg-[#fffaf3]/5 p-3 text-center">
              <Users className="h-4 w-4 mx-auto mb-1 text-[#fffaf3]/50" />
              <div className="text-lg font-bold text-[#fffaf3]">{prediction.volume}</div>
              <div className="text-xs text-[#fffaf3]/50">Volume</div>
            </div>
            <div className="rounded-xl border border-[#fffaf3]/10 bg-[#fffaf3]/5 p-3 text-center">
              <Calendar className="h-4 w-4 mx-auto mb-1 text-[#fffaf3]/50" />
              <div className="text-lg font-bold text-[#fffaf3]">{prediction.endDate}</div>
              <div className="text-xs text-[#fffaf3]/50">End Date</div>
            </div>
            <div className="rounded-xl border border-[#fffaf3]/10 bg-[#fffaf3]/5 p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-[#fffaf3]/50" />
              <div className="text-lg font-bold text-[#fffaf3]">+2.3%</div>
              <div className="text-xs text-[#fffaf3]/50">24h Change</div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PredictionDetailModal;
