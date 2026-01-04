"use client";

import { useState } from "react";
import CategoryScroll from "@/components/CategoryScroll";
import PredictionsGrid from "@/components/PredictionsGrid";
import TrendingSection from "@/components/TrendingSection";
import FeaturedPrediction from "@/components/FeaturedPrediction";
import PageTransition from "@/components/ui/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { useFeaturedPredictions } from "@/hooks/useQueries";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>("trending");

  // Use React Query for featured predictions (cached + auto-refresh)
  const { data: featuredPredictions = [], isLoading: isFeaturedLoading } = useFeaturedPredictions(5);

  return (
    <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col flex-1 overflow-hidden">
      {/* Featured Prediction Section */}
      {isFeaturedLoading ? (
        <div className="pt-4 sm:pt-6 px-4 sm:px-6">
          <div className="relative w-full h-[350px] md:h-[500px] rounded-xl md:rounded-2xl overflow-hidden bg-neutral-900 border border-border">
            {/* Left content area */}
            <div className="h-full w-full md:w-1/2 p-4 md:p-6 flex flex-col justify-between">
              {/* Top Section */}
              <div>
                {/* Status + Category Badges */}
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                {/* Creator Info */}
                <div className="flex items-center gap-2">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>

              {/* Bottom Section */}
              <div>
                {/* Meta Badges Row */}
                <div className="flex items-center gap-1.5 md:gap-2 mb-3 md:mb-4 flex-wrap">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-14 rounded-full" />
                </div>

                {/* Title */}
                <Skeleton className="h-8 md:h-10 w-full mb-2" />
                <Skeleton className="h-8 md:h-10 w-3/4 mb-3" />

                {/* Description - Hidden on mobile */}
                <div className="hidden md:block mb-4">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6 mb-2" />
                  <Skeleton className="h-4 w-4/6" />
                </div>

                {/* Conviction Bar */}
                <div className="mb-4 mt-4">
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
            </div>

            {/* Right side gradient placeholder */}
            <div className="absolute top-0 right-0 w-1/2 h-full hidden md:block">
              <div className="w-full h-full bg-gradient-to-l from-neutral-800/50 to-transparent" />
            </div>

            {/* Carousel Dots */}
            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex items-center gap-1.5 md:gap-2">
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
            </div>
          </div>
        </div>
      ) : featuredPredictions.length > 0 ? (
        <div className="pt-4 sm:pt-6">
          <FeaturedPrediction predictions={featuredPredictions} />
        </div>
      ) : null}

      <CategoryScroll
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      {activeCategory === "trending" ? (
        <TrendingSection />
      ) : (
        <PredictionsGrid activeCategory={activeCategory} />
      )}
    </PageTransition>
  );
}
