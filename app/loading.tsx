'use client';

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <motion.div
      className="w-[80%] flex flex-col flex-1 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Featured section skeleton */}
      <div className="px-6 pt-6">
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>

      {/* Category scroll skeleton */}
      <div className="flex gap-3 px-6 py-6 overflow-hidden">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full shrink-0" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="bg-neutral-900 rounded-2xl border border-border p-5"
          >
            {/* Header: Avatar + Username + Time */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>

            {/* Badges Row */}
            <div className="flex items-center gap-2 mb-4">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>

            {/* Content: Image + Title */}
            <div className="flex gap-4 mb-4">
              <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 mb-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 w-12" />
            </div>

            {/* Conviction Bar */}
            <div className="mb-4">
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
        ))}
      </div>
    </motion.div>
  );
}
