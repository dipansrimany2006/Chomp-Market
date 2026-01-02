'use client';

import { motion } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

const PageLoader = () => {
  return (
    <motion.div
      className="w-full max-w-4xl mx-auto px-4 py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-5 w-32" />
      </div>

      {/* Step indicators skeleton */}
      <div className="flex justify-center mb-10">
        <div className="flex items-center gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center">
              <Skeleton className="w-8 h-8 rounded-full" />
              {i < 5 && <Skeleton className="w-8 h-0.5 ml-3" />}
            </div>
          ))}
        </div>
      </div>

      {/* Title skeleton */}
      <div className="text-center mb-8">
        <Skeleton className="h-8 w-64 mx-auto mb-2" />
      </div>

      {/* Card skeleton */}
      <div className="rounded-2xl border border-border bg-card/40 p-6 mb-6">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-14 w-full mb-3" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Image upload skeleton */}
      <div className="rounded-2xl border border-border bg-card/40 p-6">
        <Skeleton className="h-4 w-24 mb-4" />
        <Skeleton className="h-56 w-full" />
      </div>

      {/* Button skeleton */}
      <div className="flex gap-4 mt-8">
        <Skeleton className="flex-1 h-14 rounded-xl" />
      </div>
    </motion.div>
  );
};

export default PageLoader;
