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
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-4 w-28 mb-4" />
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      {/* Section title skeleton */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>

      {/* Market cards skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card/50 p-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <Skeleton className="h-6 w-3/4 mb-3" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2 mb-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>

            {/* Info */}
            <div className="flex gap-4 mb-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Skeleton className="flex-1 h-10 rounded-xl" />
              <Skeleton className="flex-1 h-10 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
