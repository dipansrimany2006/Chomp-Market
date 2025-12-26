'use client';

import React, { useState, useEffect } from 'react';
import PredictionCard from './PredictionCard';
import { Prediction, PollFromAPI, transformPollToPrediction } from '@/lib/predictions';
import { fetchMarketInfo, MarketStatus } from '@/lib/contracts';
import { Loader2 } from 'lucide-react';

interface PredictionsGridProps {
  activeCategory: string | null;
}

const PredictionsGrid: React.FC<PredictionsGridProps> = ({ activeCategory }) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPolls = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const categoryParam = activeCategory && activeCategory !== 'trending' && activeCategory !== 'new'
          ? `?category=${encodeURIComponent(activeCategory)}`
          : '';

        const response = await fetch(`/api/poll${categoryParam}`);
        const data = await response.json();

        if (data.success && data.polls) {
          const transformedPolls = data.polls.map((poll: PollFromAPI) =>
            transformPollToPrediction(poll)
          );

          // Fetch live odds from blockchain for markets with contract addresses
          const predictionsWithLiveOdds = await Promise.all(
            transformedPolls.map(async (prediction: Prediction) => {
              if (prediction.contractAddress) {
                try {
                  const marketInfo = await fetchMarketInfo(prediction.contractAddress);
                  // Convert blockchain status to prediction status
                  const statusMap: Record<MarketStatus, 'active' | 'resolved' | 'cancelled'> = {
                    [MarketStatus.Active]: 'active',
                    [MarketStatus.Resolved]: 'resolved',
                    [MarketStatus.Cancelled]: 'cancelled',
                  };
                  return {
                    ...prediction,
                    odds: marketInfo.odds,
                    // Recalculate price change based on live odds
                    priceChange: marketInfo.odds[0] - (100 / marketInfo.odds.length),
                    // Use blockchain status for accurate market state
                    status: statusMap[marketInfo.status],
                    isOpen: marketInfo.isOpen,
                  };
                } catch (err) {
                  console.warn(`Failed to fetch live odds for ${prediction.id}:`, err);
                  return prediction;
                }
              }
              return prediction;
            })
          );

          setPredictions(predictionsWithLiveOdds);
        } else {
          throw new Error('Failed to fetch polls');
        }
      } catch (err) {
        console.error('Error fetching polls:', err);
        setError('Failed to load markets');
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolls();
  }, [activeCategory]);

  const getHeaderText = () => {
    if (!activeCategory) return 'Popular Markets';
    if (activeCategory === 'trending') return 'Trending Markets';
    if (activeCategory === 'new') return 'New Markets';
    return `${activeCategory} Markets`;
  };

  if (isLoading) {
    return (
      <div className="w-full flex-1 flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 text-[#fffaf3]/50 animate-spin" />
          <p className="text-[#fffaf3]/50 text-sm">Loading markets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 overflow-y-auto scrollbar-hide px-6 py-6">
      {/* Section header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#fffaf3]">{getHeaderText()}</h2>
          <p className="mt-1 text-sm text-[#fffaf3]/50">
            {predictions.length} market{predictions.length !== 1 ? 's' : ''} available
          </p>
        </div>
        {activeCategory && (
          <button
            type="button"
            className="rounded-full border border-[#fffaf3]/20 bg-[#fffaf3]/5 px-4 py-2 text-sm font-medium text-[#fffaf3]/70 transition-all hover:border-[#fffaf3]/30 hover:bg-[#fffaf3]/10 hover:text-[#fffaf3]"
          >
            View All
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 rounded-lg bg-[#fffaf3]/10 border border-[#fffaf3]/20 px-4 py-3">
          <p className="text-sm text-[#fffaf3]/70">{error}</p>
        </div>
      )}

      {/* Grid of prediction cards */}
      {predictions.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {predictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-[#fffaf3]/5 p-4">
            <svg
              className="h-8 w-8 text-[#fffaf3]/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-medium text-[#fffaf3]/70">No markets found</h3>
          <p className="text-sm text-[#fffaf3]/50">
            There are no markets in this category yet
          </p>
        </div>
      )}

      {/* Load more button */}
      {/* {predictions.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="group relative overflow-hidden rounded-full border border-[#fffaf3]/20 bg-[#fffaf3]/5 px-8 py-3 text-sm font-medium text-[#fffaf3]/70 transition-all hover:border-[#fffaf3]/50 hover:text-[#fffaf3]"
          >
            <span className="relative z-10">Load More Markets</span>
            <div className="absolute inset-0 -translate-x-full bg-[#fffaf3]/20 transition-transform duration-300 group-hover:translate-x-0" />
          </button>
        </div>
      )} */}
    </div>
  );
};

export default PredictionsGrid;
