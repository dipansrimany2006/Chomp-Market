"use client";

import { useState } from "react";
import CategoryScroll from "@/components/CategoryScroll";
import PredictionsGrid from "@/components/PredictionsGrid";
import TrendingSection from "@/components/TrendingSection";

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | null>("trending");

  return (
    <div className="w-[80%] flex flex-col flex-1 overflow-hidden">
      <CategoryScroll
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />
      {activeCategory === "trending" ? (
        <TrendingSection />
      ) : (
        <PredictionsGrid activeCategory={activeCategory} />
      )}
    </div>
  );
}
