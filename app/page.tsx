"use client";

import { useState } from "react";
import CategoryScroll from "@/components/CategoryScroll";
import PredictionsGrid from "@/components/PredictionsGrid";
import TrendingSection from "@/components/TrendingSection";
import FeaturedPrediction from "@/components/FeaturedPrediction";
import PageTransition from "@/components/ui/page-transition";
import { useFeaturedPredictions } from "@/hooks/useQueries";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>("trending");

  // Use React Query for featured predictions (cached + auto-refresh)
  const { data: featuredPredictions = [] } = useFeaturedPredictions(5);

  return (
    <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col flex-1 overflow-hidden">
      {/* Featured Prediction Section */}
      {featuredPredictions.length > 0 && (
        <div className="pt-4 sm:pt-6">
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
