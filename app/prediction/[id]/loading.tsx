'use client';

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <motion.div
      className="w-[80%] flex flex-col py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Back button skeleton */}
      <Skeleton className="h-5 w-16 mb-6" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Header */}
          <div className="flex items-start gap-4">
            <Skeleton className="w-16 h-16 rounded-2xl shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-7 w-full mb-2" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="w-10 h-10 rounded-lg" />
              <Skeleton className="w-10 h-10 rounded-lg" />
            </div>
          </div>

          {/* Options Table */}
          <div className="rounded-2xl border border-border bg-card/50 overflow-hidden">
            <div className="px-6 py-3 border-b border-border">
              <Skeleton className="h-4 w-full" />
            </div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-border last:border-b-0">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <Skeleton className="h-5 w-24" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Price Chart */}
          <Skeleton className="h-72 w-full rounded-2xl" />

          {/* Rules Summary */}
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-16 rounded-lg" />
              <Skeleton className="h-8 w-16 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/50 p-6">
            {/* Market Summary */}
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
              <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>

            {/* Buy/Sell Toggle */}
            <div className="flex gap-2 mb-4">
              <Skeleton className="flex-1 h-10 rounded-lg" />
              <Skeleton className="flex-1 h-10 rounded-lg" />
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>

            {/* Balance */}
            <Skeleton className="h-20 w-full rounded-xl mb-4" />

            {/* Amount Input */}
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-12 w-full rounded-xl mb-4" />

            {/* Quick amounts */}
            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="flex-1 h-10 rounded-lg" />
              ))}
            </div>

            {/* Buy Button */}
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
