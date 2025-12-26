'use client';

import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Prediction, PollFromAPI, transformPollToPrediction } from '@/lib/predictions';
import { fetchMarketInfo } from '@/lib/contracts';
import PredictionCard from './PredictionCard';

const TrendingSection: React.FC = () => {
  const [gridPredictions, setGridPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch polls from API
  useEffect(() => {
    const fetchPolls = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/poll?limit=9');
        const data = await response.json();

        if (data.success && data.polls && data.polls.length > 0) {
          const transformedPolls = data.polls.map((poll: PollFromAPI) =>
            transformPollToPrediction(poll)
          );

          // Fetch live odds from blockchain for markets with contract addresses
          const predictionsWithLiveOdds = await Promise.all(
            transformedPolls.map(async (prediction: Prediction) => {
              if (prediction.contractAddress) {
                try {
                  const marketInfo = await fetchMarketInfo(prediction.contractAddress);
                  return {
                    ...prediction,
                    odds: marketInfo.odds,
                    priceChange: marketInfo.odds[0] - (100 / marketInfo.odds.length),
                  };
                } catch (err) {
                  console.warn(`Failed to fetch live odds for ${prediction.id}:`, err);
                  return prediction;
                }
              }
              return prediction;
            })
          );

          setGridPredictions(predictionsWithLiveOdds);
        } else {
          setGridPredictions([]);
        }
      } catch (err) {
        console.error('Error fetching polls:', err);
        setGridPredictions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolls();
  }, []);

  return (
    <div className="w-full px-6 py-4">
      {/* Prediction Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground text-sm">Loading markets...</p>
          </div>
        </div>
      ) : gridPredictions.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-muted-foreground text-sm">No markets available</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {gridPredictions.slice(0, 6).map((prediction) => (
              <PredictionCard key={prediction.id} prediction={prediction} />
            ))}
          </div>

          {/* Second row of cards */}
          {gridPredictions.length > 6 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
              {gridPredictions.slice(6, 9).map((prediction) => (
                <PredictionCard key={prediction.id} prediction={prediction} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TrendingSection;
