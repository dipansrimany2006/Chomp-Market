'use client';

import React, { useRef, useState } from 'react';
import { TrendingUp, Sparkles, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCategories } from '@/hooks/useQueries';

interface CategoryScrollProps {
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const CategoryScroll: React.FC<CategoryScrollProps> = ({ activeCategory, onCategoryChange }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  // Use React Query for categories (cached for 5 minutes)
  const { data: categoriesData } = useCategories();
  const categories = categoriesData?.categories || [];

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleCategoryClick = (category: string) => {
    onCategoryChange(activeCategory === category ? null : category);
  };

  return (
    <div className="w-full px-4 sm:px-6">
      <div className="flex items-center gap-1.5 sm:gap-2 backdrop-blur-lg rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 mt-3 sm:mt-4">
        {/* Fixed Left Section - All, Trending & New */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all',
              activeCategory === null
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            All
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('trending')}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all',
              activeCategory === 'trending'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Trending</span>
            <span className="sm:hidden">Hot</span>
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('new')}
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all',
              activeCategory === 'new'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            New
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border shrink-0" />

        {/* Scrollable Middle Section */}
        <div className="relative flex-1 flex items-center min-w-0">
          {/* Left Scroll Arrow */}
          {showLeftArrow && (
            <button
              type="button"
              onClick={() => scroll('left')}
              className="absolute left-0 z-10 w-8 h-8 flex items-center justify-center bg-gradient-to-r from-background/80 to-transparent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth px-1"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className={cn(
                  'px-2 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all',
                  activeCategory === category
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Right Scroll Arrow */}
          {showRightArrow && (
            <button
              type="button"
              onClick={() => scroll('right')}
              className="absolute right-0 z-10 w-8 h-8 flex items-center justify-center bg-gradient-to-l from-background/80 to-transparent text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategoryScroll;
