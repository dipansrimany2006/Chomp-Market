'use client';

import React, { useRef, useState } from 'react';
import { ChevronDown, Check, TrendingUp, Sparkles, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

const mainCategories: string[] = [];

const moreCategories: { value: string; label: string }[] = [];

interface CategoryScrollProps {
  activeCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

const CategoryScroll: React.FC<CategoryScrollProps> = ({ activeCategory, onCategoryChange }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

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
    <div className="w-full px-6">
      <div className="flex items-center gap-2 backdrop-blur-lg border-b border-t border-border px-2 py-1.5">
        {/* Fixed Left Section - All, Trending & New */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onCategoryChange(null)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              activeCategory === null
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            All
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('trending')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              activeCategory === 'trending'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <TrendingUp className="w-4 h-4" />
            Trending
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('new')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
              activeCategory === 'new'
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Sparkles className="w-4 h-4" />
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
            {mainCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
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

        {/* Divider */}
        <div className="w-px h-6 bg-border shrink-0" />

        {/* Fixed Right Section - More Combobox */}
        <div className="shrink-0">
          <Popover open={open} onOpenChange={setOpen}>

            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                  selectedCategory
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {selectedCategory
                  ? moreCategories.find((cat) => cat.value === selectedCategory)?.label
                  : 'More'}
                <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[200px] p-0 bg-card/90 border-border backdrop-blur-xl"
              align="end"
            >
              <Command className="bg-transparent">
                <CommandInput
                  placeholder="Search categories..."
                  className="text-foreground placeholder:text-muted-foreground"
                />
                <CommandList>
                  <CommandEmpty className="text-muted-foreground">No category found.</CommandEmpty>
                  <CommandGroup>
                    {moreCategories.map((category) => (
                      <CommandItem
                        key={category.value}
                        value={category.value}
                        onSelect={(currentValue) => {
                          const newValue = currentValue === selectedCategory ? null : currentValue;
                          setSelectedCategory(newValue);
                          onCategoryChange(newValue ? category.label : null);
                          setOpen(false);
                        }}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedCategory === category.value ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {category.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
};

export default CategoryScroll;
