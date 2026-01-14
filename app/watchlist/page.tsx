'use client';

import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Trash2,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import PageTransition from '@/components/ui/page-transition';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserWatchlist, useRemoveFromWatchlist, WatchlistItem } from '@/hooks/useQueries';
import { transformPollToPrediction, PollFromAPI } from '@/lib/predictions';

// Color palette for options
const OPTION_COLORS = [
  { bg: 'bg-[#00bf63]', bgLight: 'bg-[#00bf63]/20', text: 'text-[#00bf63]', border: 'border-[#00bf63]/30' },
  { bg: 'bg-[#ee3e3d]', bgLight: 'bg-[#ee3e3d]/20', text: 'text-[#ee3e3d]', border: 'border-[#ee3e3d]/30' },
  { bg: 'bg-[#ffa51f]', bgLight: 'bg-[#ffa51f]/20', text: 'text-[#ffa51f]', border: 'border-[#ffa51f]/30' },
  { bg: 'bg-[#0081cc]', bgLight: 'bg-[#0081cc]/20', text: 'text-[#0081cc]', border: 'border-[#0081cc]/30' },
];

// Watchlist Item Card Component
function WatchlistCard({
  item,
  onRemove,
  isRemoving,
}: {
  item: WatchlistItem;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const router = useRouter();
  const poll = item.poll as PollFromAPI | undefined;

  if (!poll) return null;

  const prediction = transformPollToPrediction(poll);
  const endDate = new Date(prediction.endDate);
  const isEnded = endDate < new Date();

  return (
    <div className="rounded-xl sm:rounded-2xl border border-border bg-neutral-900 backdrop-blur-xl p-4 sm:p-5 hover:border-border/80 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">
          {prediction.imageUrl ? (
            <img
              src={prediction.imageUrl}
              alt={prediction.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">
                {prediction.category.charAt(0)}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className="text-foreground font-semibold text-base sm:text-lg mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-2"
            onClick={() => router.push(`/prediction/${prediction.id}`)}
          >
            {prediction.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {prediction.category}
            </span>
            {isEnded ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                Ended
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Active
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          disabled={isRemoving}
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Remove from watchlist"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Options/Odds */}
      <div className="space-y-2 mb-4">
        {prediction.options.slice(0, 2).map((option, index) => {
          const color = OPTION_COLORS[index % OPTION_COLORS.length];
          const odds = prediction.odds?.[index] || 50;
          return (
            <div
              key={index}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-800"
            >
              <span className="text-sm text-muted-foreground">{option}</span>
              <span className={cn('text-sm font-bold', color.text)}>
                {Math.round(odds)}%
              </span>
            </div>
          );
        })}
        {prediction.options.length > 2 && (
          <p className="text-xs text-muted-foreground text-center">
            +{prediction.options.length - 2} more options
          </p>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>${prediction.volume.toLocaleString()} volume</span>
        </div>
        <span>Ends {endDate.toLocaleDateString()}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push(`/prediction/${prediction.id}`)}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
        >
          View Market
        </button>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const router = useRouter();
  const { authenticated, login, user } = usePrivy();

  // Watchlist data
  const { data: watchlistData, isLoading } = useUserWatchlist(user?.wallet?.address);
  const removeFromWatchlist = useRemoveFromWatchlist();

  const handleRemove = (pollId: string) => {
    if (!user?.wallet?.address) return;
    removeFromWatchlist.mutate({
      walletAddress: user.wallet.address,
      pollId,
    });
  };

  if (!authenticated) {
    return (
      <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col items-center justify-center py-12 sm:py-16">
        <div className="text-center">
          <div className="mb-4 rounded-full bg-muted p-4 inline-block">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Connect Wallet</h1>
          <p className="text-muted-foreground mb-6">Connect your wallet to view your watchlist</p>
          <button
            onClick={login}
            className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </PageTransition>
    );
  }

  if (isLoading) {
    return (
      <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col py-4 sm:py-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Skeleton className="h-4 w-28 mb-4" />
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Market cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-neutral-900 p-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-full mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="flex justify-between mb-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </PageTransition>
    );
  }

  const watchlist = watchlistData?.watchlist || [];

  return (
    <PageTransition className="w-full px-4 sm:px-6 lg:w-[90%] xl:w-[85%] 2xl:w-[80%] flex flex-col py-4 sm:py-6 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-3 sm:mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back to Markets</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20">
              <Bookmark className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Watchlist</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {watchlist.length} {watchlist.length === 1 ? 'market' : 'markets'} saved
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-sm transition-colors"
        >
          Browse Markets
        </button>
      </div>

      {watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Bookmark className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-1 text-lg font-medium text-foreground">No markets saved</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Add markets to your watchlist by clicking the plus icon on any market page to track them here
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm transition-colors"
          >
            Explore Markets
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlist.map((item) => (
            <WatchlistCard
              key={item._id}
              item={item}
              onRemove={() => handleRemove(item.pollId)}
              isRemoving={removeFromWatchlist.isPending}
            />
          ))}
        </div>
      )}
    </PageTransition>
  );
}
