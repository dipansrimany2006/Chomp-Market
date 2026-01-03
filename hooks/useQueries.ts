'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import {
  fetchMarketInfo,
  fetchUserPosition,
  fetchAllMarkets,
  fetchActiveMarkets,
  formatTokenAmount,
  MANTLE_SEPOLIA,
  MarketInfo,
  UserPosition,
  MarketStatus,
} from '@/lib/contracts';

// ============================================
// Query Keys - Centralized for easy invalidation
// ============================================
export const queryKeys = {
  // API queries
  polls: {
    all: ['polls'] as const,
    list: (filters: Record<string, string | number | undefined>) => ['polls', 'list', filters] as const,
    detail: (id: string) => ['polls', 'detail', id] as const,
    featured: (limit: number) => ['polls', 'featured', limit] as const,
    byCategory: (category: string) => ['polls', 'category', category] as const,
    byCreator: (address: string) => ['polls', 'creator', address] as const,
  },
  categories: {
    all: ['categories'] as const,
  },
  // Blockchain queries
  markets: {
    all: ['markets'] as const,
    active: ['markets', 'active'] as const,
    info: (address: string) => ['markets', 'info', address] as const,
  },
  positions: {
    user: (marketAddress: string, userAddress: string) =>
      ['positions', marketAddress, userAddress] as const,
  },
  balance: {
    user: (address: string) => ['balance', address] as const,
  },
};

// ============================================
// API Query Hooks
// ============================================

import { Prediction, PollFromAPI, transformPollToPrediction } from '@/lib/predictions';

interface PollsResponse {
  success?: boolean;
  polls: PollFromAPI[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
  };
}

interface SinglePollResponse {
  success?: boolean;
  poll: PollFromAPI;
}

interface CategoriesResponse {
  success?: boolean;
  categories: string[];
}

// Fetch polls with filters
export function usePolls(filters: {
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  category?: string;
} = {}) {
  const queryString = new URLSearchParams(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString();

  return useQuery({
    queryKey: queryKeys.polls.list(filters),
    queryFn: async (): Promise<PollsResponse> => {
      const res = await fetch(`/api/poll?${queryString}`);
      if (!res.ok) throw new Error('Failed to fetch polls');
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Fetch featured polls (top by volume)
export function useFeaturedPolls(limit: number = 5) {
  return useQuery({
    queryKey: queryKeys.polls.featured(limit),
    queryFn: async (): Promise<PollsResponse> => {
      const res = await fetch(
        `/api/poll?limit=${limit}&sortBy=totalVolume&sortOrder=desc&status=active`
      );
      if (!res.ok) throw new Error('Failed to fetch featured polls');
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute - featured polls don't change often
  });
}

// Fetch polls by category
export function usePollsByCategory(category: string) {
  return useQuery({
    queryKey: queryKeys.polls.byCategory(category),
    queryFn: async (): Promise<PollsResponse> => {
      const url = category === 'All'
        ? '/api/poll'
        : `/api/poll?category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch polls');
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}

// Fetch single poll by ID
export function usePoll(id: string) {
  return useQuery({
    queryKey: queryKeys.polls.detail(id),
    queryFn: async (): Promise<SinglePollResponse> => {
      const res = await fetch(`/api/poll/${id}`);
      if (!res.ok) throw new Error('Failed to fetch poll');
      return res.json();
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// Fetch polls by creator wallet address
export function usePollsByCreator(walletAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.polls.byCreator(walletAddress || ''),
    queryFn: async (): Promise<PollsResponse> => {
      const res = await fetch(`/api/poll?creatorWalletAddress=${walletAddress}`);
      if (!res.ok) throw new Error('Failed to fetch user polls');
      return res.json();
    },
    enabled: !!walletAddress,
    staleTime: 30 * 1000,
  });
}

// Fetch all categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async (): Promise<CategoriesResponse> => {
      const res = await fetch('/api/category');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - categories rarely change
  });
}

// ============================================
// Blockchain Query Hooks
// ============================================

// Fetch all markets from factory
export function useAllMarkets() {
  return useQuery({
    queryKey: queryKeys.markets.all,
    queryFn: fetchAllMarkets,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Fetch active markets from factory
export function useActiveMarkets() {
  return useQuery({
    queryKey: queryKeys.markets.active,
    queryFn: fetchActiveMarkets,
    staleTime: 30 * 1000,
  });
}

// Fetch market info from blockchain
export function useMarketInfo(marketAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.markets.info(marketAddress || ''),
    queryFn: () => fetchMarketInfo(marketAddress!),
    enabled: !!marketAddress,
    staleTime: 15 * 1000, // 15 seconds - odds change frequently
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

// Fetch user position from blockchain
export function useUserPosition(marketAddress: string | undefined, userAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.positions.user(marketAddress || '', userAddress || ''),
    queryFn: () => fetchUserPosition(marketAddress!, userAddress!),
    enabled: !!marketAddress && !!userAddress,
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Fetch user's MNT balance
export function useBalance(userAddress: string | undefined) {
  return useQuery({
    queryKey: queryKeys.balance.user(userAddress || ''),
    queryFn: async (): Promise<string> => {
      if (!userAddress) return '0';
      const provider = new ethers.JsonRpcProvider(MANTLE_SEPOLIA.rpcUrl);
      const balance = await provider.getBalance(userAddress);
      return formatTokenAmount(balance);
    },
    enabled: !!userAddress,
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
  });
}

// Convenience hook that uses Privy user
export function useUserBalance() {
  const { user } = usePrivy();
  return useBalance(user?.wallet?.address);
}

// Convenience hook that uses Privy user for position
export function useCurrentUserPosition(marketAddress: string | undefined) {
  const { user } = usePrivy();
  return useUserPosition(marketAddress, user?.wallet?.address);
}

// ============================================
// Cache Invalidation Helpers
// ============================================

export function useInvalidateMarketData() {
  const queryClient = useQueryClient();
  const { user } = usePrivy();

  return {
    // Invalidate after buy/sell
    invalidateAfterTrade: (marketAddress: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.markets.info(marketAddress) });
      if (user?.wallet?.address) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.positions.user(marketAddress, user.wallet.address)
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balance.user(user.wallet.address)
        });
      }
    },

    // Invalidate after claim
    invalidateAfterClaim: (marketAddress: string) => {
      if (user?.wallet?.address) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.positions.user(marketAddress, user.wallet.address)
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.balance.user(user.wallet.address)
        });
      }
    },

    // Invalidate after market resolution
    invalidateAfterResolve: (marketAddress: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.markets.info(marketAddress) });
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
    },

    // Invalidate after market creation
    invalidateAfterCreate: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.markets.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.markets.active });
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all });
    },

    // Invalidate all market-related data
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  };
}

// ============================================
// Prefetch Helpers
// ============================================

export function usePrefetchMarketInfo() {
  const queryClient = useQueryClient();

  return (marketAddress: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.markets.info(marketAddress),
      queryFn: () => fetchMarketInfo(marketAddress),
      staleTime: 15 * 1000,
    });
  };
}

// ============================================
// Combined Hooks (API + Blockchain)
// ============================================

// Status map for converting blockchain status to prediction status
const statusMap: Record<MarketStatus, 'active' | 'resolved' | 'cancelled'> = {
  [MarketStatus.Active]: 'active',
  [MarketStatus.Resolved]: 'resolved',
  [MarketStatus.Cancelled]: 'cancelled',
};

// Helper to enrich predictions with live blockchain data
async function enrichPredictionsWithLiveOdds(predictions: Prediction[]): Promise<Prediction[]> {
  return Promise.all(
    predictions.map(async (prediction) => {
      if (prediction.contractAddress) {
        try {
          const marketInfo = await fetchMarketInfo(prediction.contractAddress);
          return {
            ...prediction,
            odds: marketInfo.odds,
            priceChange: marketInfo.odds[0] - (100 / marketInfo.odds.length),
            status: statusMap[marketInfo.status],
            isOpen: marketInfo.isOpen,
          };
        } catch (err) {
          console.warn(`Failed to fetch live odds for ${prediction.id}:`, err);
          return prediction;
        }
      }
      return prediction;
    })
  );
}

// Hook for fetching featured predictions with live blockchain odds
export function useFeaturedPredictions(limit: number = 5) {
  return useQuery({
    queryKey: ['predictions', 'featured', limit],
    queryFn: async (): Promise<Prediction[]> => {
      const res = await fetch(
        `/api/poll?limit=${limit}&sortBy=totalVolume&sortOrder=desc&status=active`
      );
      if (!res.ok) throw new Error('Failed to fetch featured polls');
      const data = await res.json();

      if (!data.success || !data.polls) return [];

      const predictions = data.polls.map((poll: PollFromAPI) =>
        transformPollToPrediction(poll)
      );

      return enrichPredictionsWithLiveOdds(predictions);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

// Hook for fetching trending predictions with live blockchain odds
export function useTrendingPredictions(limit: number = 9) {
  return useQuery({
    queryKey: ['predictions', 'trending', limit],
    queryFn: async (): Promise<Prediction[]> => {
      const res = await fetch(`/api/poll?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch polls');
      const data = await res.json();

      if (!data.success || !data.polls) return [];

      const predictions = data.polls.map((poll: PollFromAPI) =>
        transformPollToPrediction(poll)
      );

      return enrichPredictionsWithLiveOdds(predictions);
    },
    staleTime: 30 * 1000,
  });
}

// Hook for fetching predictions by category with live blockchain odds
export function usePredictionsByCategory(category: string | null) {
  return useQuery({
    queryKey: ['predictions', 'category', category],
    queryFn: async (): Promise<Prediction[]> => {
      const categoryParam = category && category !== 'trending' && category !== 'new'
        ? `?category=${encodeURIComponent(category)}`
        : '';

      const res = await fetch(`/api/poll${categoryParam}`);
      if (!res.ok) throw new Error('Failed to fetch polls');
      const data = await res.json();

      if (!data.success || !data.polls) return [];

      const predictions = data.polls.map((poll: PollFromAPI) =>
        transformPollToPrediction(poll)
      );

      return enrichPredictionsWithLiveOdds(predictions);
    },
    staleTime: 30 * 1000,
  });
}
