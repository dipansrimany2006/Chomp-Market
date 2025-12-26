'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronDown, BarChart3, Clock, Sparkles } from 'lucide-react';
import { Prediction } from '@/lib/predictions';

// Color palette for multiple options
const OPTION_COLORS = [
  { bg: 'bg-[#00bf63]', text: 'text-[#00bf63]', hex: '#00bf63' },
  { bg: 'bg-[#ee3e3d]', text: 'text-[#ee3e3d]', hex: '#ee3e3d' },
  { bg: 'bg-[#ffa51f]', text: 'text-[#ffa51f]', hex: '#ffa51f' },
  { bg: 'bg-[#0081cc]', text: 'text-[#0081cc]', hex: '#0081cc' },
];

// Colors for Yes/No markets
const YES_COLOR = { bg: 'bg-[#00bf63]', text: 'text-[#00bf63]', hex: '#00bf63' };
const NO_COLOR = { bg: 'bg-[#ee3e3d]', text: 'text-[#ee3e3d]', hex: '#ee3e3d' };

interface PredictionCardProps {
  prediction: Prediction;
  className?: string;
}

// Helper to format wallet address as username
const formatAddress = (address?: string): string => {
  if (!address) return '@anonymous';
  return `@${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper to get relative time
const getRelativeTime = (dateString?: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
};

// Check if options are Yes/No type
const isYesNoMarket = (options: string[]): boolean => {
  if (options.length !== 2) return false;
  const normalized = options.map(o => o.toLowerCase().trim());
  return (normalized.includes('yes') && normalized.includes('no'));
};

// Dropdown Portal Component
interface DropdownPortalProps {
  isOpen: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  options: string[];
  odds: number[];
  selectedOption: number;
  onSelect: (e: React.MouseEvent, index: number) => void;
}

const DropdownPortal: React.FC<DropdownPortalProps> = ({
  isOpen,
  buttonRef,
  options,
  odds,
  selectedOption,
  onSelect,
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen, buttonRef]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed bg-card rounded-xl overflow-hidden shadow-2xl border border-border"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 9999,
      }}
    >
      {options.map((option, index) => (
        <button
          type="button"
          key={index}
          onClick={(e) => onSelect(e, index)}
          className={cn(
            'w-full px-4 py-3.5 text-sm text-left transition-colors flex items-center justify-between',
            selectedOption === index
              ? 'bg-primary/20 text-foreground'
              : 'text-foreground hover:bg-muted'
          )}
        >
          <span className="truncate">{option}</span>
          <span className={cn(
            'text-sm font-medium ml-2',
            selectedOption === index ? 'text-primary' : 'text-muted-foreground'
          )}>{Math.round(odds[index])}%</span>
        </button>
      ))}
    </div>,
    document.body
  );
};

const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, className }) => {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const options = prediction.options || ['Yes', 'No'];
  const odds = prediction.odds || options.map(() => 100 / options.length);
  const isYesNo = isYesNoMarket(options);

  // Calculate conviction (highest odds percentage)
  const conviction = Math.max(...odds);

  // Get status display - prioritize blockchain isOpen field if available
  const getStatusDisplay = () => {
    // If we have blockchain data, use it as the source of truth
    if (prediction.isOpen !== undefined) {
      if (prediction.status === 'resolved') return 'Resolved';
      if (prediction.status === 'cancelled') return 'Cancelled';
      return prediction.isOpen ? 'Active' : 'Closed';
    }
    // Fallback to API status and date logic
    if (prediction.status === 'resolved') return 'Resolved';
    if (prediction.status === 'cancelled') return 'Cancelled';
    const endDate = new Date(prediction.endDate);
    if (endDate < new Date()) return 'Closed';
    return 'Active';
  };

  const statusDisplay = getStatusDisplay();
  const isMarketClosed = statusDisplay !== 'Active';

  const handleCardClick = () => {
    router.push(`/prediction/${prediction.id}`);
  };

  const handleOptionClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    router.push(`/prediction/${prediction.id}?option=${index}`);
  };

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleOptionSelect = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedOption(index);
    setIsDropdownOpen(false);
    router.push(`/prediction/${prediction.id}?option=${index}`);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDropdownOpen && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'bg-neutral-900 backdrop-blur-xl rounded-2xl border border-border p-5 hover:border-primary/40 transition-all cursor-pointer',
        className
      )}
    >
      {/* Header: Creator + Timestamp */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center overflow-hidden">
            <span className="text-primary-foreground text-xs font-medium">
              {prediction.creatorAddress ? prediction.creatorAddress.slice(2, 4).toUpperCase() : 'AN'}
            </span>
          </div>
          <span className="text-foreground/90 text-sm font-medium">
            {formatAddress(prediction.creatorAddress)}
          </span>
        </div>
        <span className="text-muted-foreground text-xs">
          {getRelativeTime(prediction.createdAt)}
        </span>
      </div>

      {/* Badges Row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Status Badge */}
        <span className={cn(
          'px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1',
          isMarketClosed
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary/20 text-primary'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isMarketClosed ? 'bg-muted-foreground' : 'bg-primary'
          )} />
          {statusDisplay}
        </span>

        {/* USDC Badge */}
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.2"/>
            <path d="M12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4ZM12.5 6.5V7.5C14.0569 7.74835 15.25 9.09337 15.25 10.7C15.25 10.9761 15.0261 11.2 14.75 11.2C14.4739 11.2 14.25 10.9761 14.25 10.7C14.25 9.5402 13.3598 8.6 12.2 8.5V11.4L12.5 11.5C14.0569 11.7484 15.25 13.0934 15.25 14.7C15.25 16.3066 14.0569 17.6516 12.5 17.9V18.5C12.5 18.7761 12.2761 19 12 19C11.7239 19 11.5 18.7761 11.5 18.5V17.9C9.94315 17.6516 8.75 16.3066 8.75 14.7C8.75 14.4239 8.97386 14.2 9.25 14.2C9.52614 14.2 9.75 14.4239 9.75 14.7C9.75 15.8598 10.6402 16.8 11.8 16.9V13.6L11.5 13.5C9.94315 13.2516 8.75 11.9066 8.75 10.3C8.75 8.69337 9.94315 7.34835 11.5 7.1V6.5C11.5 6.22386 11.7239 6 12 6C12.2761 6 12.5 6.22386 12.5 6.5Z" fill="currentColor"/>
          </svg>
          MNT
        </span>

        {/* Category Badge */}
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary">
          {prediction.category}
        </span>
      </div>

      {/* Content: Image + Title */}
      <div className="flex gap-4 mb-4">
        {/* Image */}
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
          {prediction.imageUrl ? (
            <img
              src={prediction.imageUrl}
              alt={prediction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
        </div>

        {/* Title */}
        <h4 className="text-base font-semibold text-foreground leading-snug line-clamp-2 flex-1">
          {prediction.title}
        </h4>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{prediction.volume}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{statusDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5 text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{Math.abs(prediction.priceChange).toFixed(1)}%</span>
        </div>
      </div>

      {/* Conviction Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-sm">Conviction</span>
          <span className="text-foreground font-semibold text-sm">{Math.round(conviction)}%</span>
        </div>
        <div className="flex h-2 rounded-full bg-muted overflow-hidden">
          {odds.map((odd, index) => {
            // Use Yes/No colors for binary markets, otherwise use OPTION_COLORS
            let bgColor: string;
            if (isYesNo) {
              const isYes = options[index].toLowerCase() === 'yes';
              bgColor = isYes ? YES_COLOR.hex : NO_COLOR.hex;
            } else {
              bgColor = OPTION_COLORS[index % OPTION_COLORS.length].hex;
            }
            return (
              <div
                key={index}
                className="transition-all duration-300"
                style={{ width: `${odd}%`, backgroundColor: bgColor }}
              />
            );
          })}
        </div>
      </div>

      {/* Options Section */}
      {isYesNo ? (
        /* Yes/No Button Layout */
        <div className="flex gap-3">
          {options.map((option, index) => {
            const isYes = option.toLowerCase() === 'yes';
            const color = isYes ? YES_COLOR : NO_COLOR;
            return (
              <button
                type="button"
                key={index}
                onClick={(e) => handleOptionClick(e, index)}
                className={cn(
                  'flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all',
                  color.bg,
                  'text-white hover:opacity-90 border border-white/10'
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        /* Multi-Option Dropdown Layout */
        <div className="relative">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleDropdownToggle}
            className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-muted text-foreground border border-border hover:bg-muted/80 transition-all flex items-center justify-between"
          >
            <span className="truncate">{options[selectedOption]}</span>
            <ChevronDown className={cn(
              'w-5 h-5 transition-transform shrink-0 ml-2',
              isDropdownOpen && 'rotate-180'
            )} />
          </button>

          <DropdownPortal
            isOpen={isDropdownOpen}
            buttonRef={buttonRef}
            options={options}
            odds={odds}
            selectedOption={selectedOption}
            onSelect={handleOptionSelect}
          />
        </div>
      )}
    </div>
  );
};

export default PredictionCard;
