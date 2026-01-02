"use client";

import { useState, useEffect } from "react";
import CategoryScroll from "@/components/CategoryScroll";
import PredictionsGrid from "@/components/PredictionsGrid";
import TrendingSection from "@/components/TrendingSection";
import FeaturedPrediction from "@/components/FeaturedPrediction";
import PageTransition from "@/components/ui/page-transition";
import { Prediction, PollFromAPI, transformPollToPrediction } from "@/lib/predictions";
import { fetchMarketInfo } from "@/lib/contracts";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>("trending");
  const [featuredPredictions, setFeaturedPredictions] = useState<Prediction[]>([]);

  // Fetch featured predictions (most traded markets)
  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        // Fetch most traded active markets for featured section
        const response = await fetch('/api/poll?limit=5&sortBy=totalVolume&sortOrder=desc&status=active');
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
                    isOpen: marketInfo.isOpen,
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

          setFeaturedPredictions(predictionsWithLiveOdds);
        }
      } catch (err) {
        console.error('Error fetching featured predictions:', err);
      }
    };

    fetchFeatured();
  }, []);

  return (
    <PageTransition className="w-[80%] flex flex-col flex-1 overflow-hidden">
      {/* Featured Prediction Section */}
      {featuredPredictions.length > 0 && (
        <div className="px-6 pt-6">
          <FeaturedPrediction predictions={featuredPredictions} />
        </div>
      )}

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
