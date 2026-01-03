'use client';

import React from 'react';
import { motion } from 'framer-motion';
import PredictionCard from './PredictionCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrendingPredictions } from '@/hooks/useQueries';

const TrendingSection: React.FC = () => {
  // Use React Query for trending predictions (cached + auto-refresh)
  const { data: gridPredictions = [], isLoading } = useTrendingPredictions(9);

  return (
    <div className="w-full px-4 sm:px-6 py-3 sm:py-4">
      {/* Prediction Cards Grid */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-neutral-900 rounded-2xl border border-border p-5"
              >
                {/* Header: Avatar + Username + Time */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-16" />
                </div>

                {/* Badges Row */}
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>

                {/* Content: Image + Title */}
                <div className="flex gap-4 mb-4">
                  <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-5 w-3/4" />
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-12" />
                </div>

                {/* Conviction Bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-10" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>

                {/* Option Buttons */}
                <div className="flex gap-3">
                  <Skeleton className="flex-1 h-12 rounded-xl" />
                  <Skeleton className="flex-1 h-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
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
