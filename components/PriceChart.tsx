"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

// Color palette for multiple options (matching mockup style)
const OPTION_COLORS = [
    { color: "#00bf63", bg: "rgba(0, 191, 99, 0.9)", name: "green" },
    { color: "#ee3e3d", bg: "rgba(238, 62, 61, 0.9)", name: "red" },
    { color: "#ffa51f", bg: "rgba(255, 165, 31, 0.9)", name: "orange" }, 
    { color: "#0081cc", bg: "rgba(0, 129, 204, 0.9)", name: "blue" },
];

interface OptionData {
  label: string;
  percentage: number;
}

interface PriceChartProps {
  options: OptionData[];
  marketId?: string;
  height?: number;
  className?: string;
}

type TimePeriod = "1H" | "3H" | "24H" | "7D" | "ALL";

// Storage key for price history
const PRICE_HISTORY_KEY = "prediction_market_price_history";

interface ChartDataPoint {
  time: string;
  fullTime: string;
  timestamp: number;
  [key: string]: string | number;
}

interface StoredPriceHistory {
  [marketId: string]: {
    dataPoints: ChartDataPoint[];
    lastUpdated: number;
  };
}

// Helper functions for localStorage
const getPriceHistory = (marketId: string): ChartDataPoint[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PRICE_HISTORY_KEY);
    if (!stored) return [];
    const history: StoredPriceHistory = JSON.parse(stored);
    return history[marketId]?.dataPoints || [];
  } catch {
    return [];
  }
};

const savePriceHistory = (marketId: string, dataPoints: ChartDataPoint[]) => {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(PRICE_HISTORY_KEY);
    const history: StoredPriceHistory = stored ? JSON.parse(stored) : {};
    history[marketId] = {
      dataPoints,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Ignore storage errors
  }
};

// Check if percentages have changed significantly (more than 0.1%)
const hasPercentageChanged = (
  newPercentages: number[],
  lastPoint: ChartDataPoint | undefined,
  optionCount: number
): boolean => {
  if (!lastPoint) return true;
  for (let i = 0; i < optionCount; i++) {
    const lastValue = lastPoint[`option${i}`] as number;
    if (Math.abs(newPercentages[i] - lastValue) > 0.1) {
      return true;
    }
  }
  return false;
};

// Custom cursor (vertical line)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomCursor = ({ points, height }: { points?: any[]; height?: number }) => {
  if (!points || !points.length) return null;
  const { x } = points[0];

  return (
    <line
      x1={x}
      y1={0}
      x2={x}
      y2={height}
      stroke="var(--foreground)"
      strokeOpacity={0.3}
      strokeWidth={1}
      strokeDasharray="4 4"
    />
  );
};

const PriceChart: React.FC<PriceChartProps> = ({
  options,
  marketId = "default",
  height = 300,
  className,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("ALL");
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(
    new Set(options.map((_, i) => i))
  );
  const [priceHistory, setPriceHistory] = useState<ChartDataPoint[]>([]);
  const [isClient, setIsClient] = useState(false);
  const lastPercentagesRef = useRef<number[]>([]);

  // Set client flag after mount to avoid hydration mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Build chart config dynamically
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    options.forEach((opt, i) => {
      const colorInfo = OPTION_COLORS[i % OPTION_COLORS.length];
      config[`option${i}`] = {
        label: opt.label,
        color: colorInfo.color,
      };
    });
    return config;
  }, [options]);

  // Load price history on mount
  useEffect(() => {
    const stored = getPriceHistory(marketId);
    if (stored.length > 0) {
      setPriceHistory(stored);
      // Set last percentages from the most recent stored point
      const lastPoint = stored[stored.length - 1];
      lastPercentagesRef.current = options.map((_, i) =>
        (lastPoint[`option${i}`] as number) || 0
      );
    }
  }, [marketId]);

  // Add new data point when percentages change
  useEffect(() => {
    const currentPercentages = options.map((opt) => opt.percentage);

    // Check if percentages have changed
    const lastPoint = priceHistory[priceHistory.length - 1];
    if (!hasPercentageChanged(currentPercentages, lastPoint, options.length)) {
      return;
    }

    // Create new data point
    const now = new Date();
    const newPoint: ChartDataPoint = {
      time: `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`,
      fullTime: now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      timestamp: now.getTime(),
    };

    options.forEach((opt, i) => {
      newPoint[`option${i}`] = opt.percentage;
    });

    // Add to history (keep last 100 points max)
    const updatedHistory = [...priceHistory, newPoint].slice(-100);
    setPriceHistory(updatedHistory);
    savePriceHistory(marketId, updatedHistory);
    lastPercentagesRef.current = currentPercentages;
  }, [options, marketId, priceHistory]);

  // Filter chart data based on selected period
  const chartData = useMemo(() => {
    // Return empty data during SSR to avoid hydration mismatch
    if (!isClient) {
      return [];
    }

    const now = Date.now();

    // Time ranges for each period (ALL = 30 days)
    const periodRanges: Record<TimePeriod, number> = {
      "1H": 60 * 60 * 1000,
      "3H": 3 * 60 * 60 * 1000,
      "24H": 24 * 60 * 60 * 1000,
      "7D": 7 * 24 * 60 * 60 * 1000,
      "ALL": 30 * 24 * 60 * 60 * 1000,
    };

    const timeRange = periodRanges[selectedPeriod];
    const startTime = now - timeRange;

    // Filter history based on selected time period
    const filteredHistory = priceHistory.filter(
      (point) => point.timestamp >= startTime
    );

    // Format time label based on period
    const formatTimeLabel = (timestamp: number): string => {
      const date = new Date(timestamp);
      if (selectedPeriod === "1H" || selectedPeriod === "3H") {
        // Show time like "14:30"
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
      } else if (selectedPeriod === "24H") {
        // Show time like "14:00"
        return `${date.getHours()}:00`;
      } else {
        // Show date like "DEC 18" for 7D and ALL
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
      }
    };

    // If we have stored history, use it
    if (filteredHistory.length > 0) {
      return filteredHistory.map((point) => ({
        ...point,
        time: formatTimeLabel(point.timestamp),
      }));
    }

    // If no history yet, show a single point with current values
    const currentPoint: ChartDataPoint = {
      time: formatTimeLabel(now),
      fullTime: new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      timestamp: now,
    };

    options.forEach((opt, i) => {
      currentPoint[`option${i}`] = opt.percentage;
    });

    return [currentPoint];
  }, [isClient, priceHistory, selectedPeriod, options]);

  const periods: TimePeriod[] = ["1H", "3H", "24H", "7D", "ALL"];

  const toggleOption = (index: number) => {
    const newSelected = new Set(selectedOptions);
    if (newSelected.has(index)) {
      if (newSelected.size > 1) {
        newSelected.delete(index);
      }
    } else {
      newSelected.add(index);
    }
    setSelectedOptions(newSelected);
  };

  // Custom tooltip content renderer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltipContent = useCallback(
    (props: { active?: boolean; payload?: any[] }) => {
      const { active, payload } = props;
      if (!active || !payload || !payload.length) return null;

      return (
        <div className="relative">
          {/* Individual option labels positioned at their Y values */}
          {payload.map((entry) => {
            const optionIndex = parseInt(entry.dataKey.replace("option", ""));
            if (!selectedOptions.has(optionIndex)) return null;

            const colorInfo = OPTION_COLORS[optionIndex % OPTION_COLORS.length];
            const opt = options[optionIndex];
            const value = entry.value;

            return (
              <div
                key={entry.dataKey}
                className="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap mb-1"
                style={{
                  backgroundColor: colorInfo.bg,
                  color: "#fff",
                }}
              >
                {opt?.label} • {value?.toFixed(0)}%
              </div>
            );
          })}
        </div>
      );
    },
    [options, selectedOptions]
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-foreground/10 bg-gradient-to-b from-foreground/5 to-foreground/[0.02] backdrop-blur-xl overflow-hidden",
        className
      )}
    >
      {/* Header with Controls */}
      <div className="flex flex-col gap-3 px-4 py-3 border-b border-foreground/5">
        {/* Controls Row */}
        <div className="flex items-center justify-between">
          {/* Option Toggle */}
          <div className="flex gap-1 bg-foreground/5 rounded-lg p-1">
            {options.map((opt, index) => {
              const colorInfo = OPTION_COLORS[index % OPTION_COLORS.length];
              const isSelected = selectedOptions.has(index);
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleOption(index)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-all",
                    isSelected
                      ? "text-foreground"
                      : "text-foreground/40 hover:text-foreground/70"
                  )}
                  style={{
                    backgroundColor: isSelected
                      ? `${colorInfo.color}30`
                      : undefined,
                    color: isSelected ? colorInfo.color : undefined,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            {options.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedOptions(new Set(options.map((_, i) => i)))
                }
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  selectedOptions.size === options.length
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/40 hover:text-foreground/70"
                )}
              >
                All
              </button>
            )}
          </div>

          {/* Time Period Selector */}
          <div className="flex gap-1 bg-foreground/5 rounded-lg p-1">
            {periods.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                  selectedPeriod === period
                    ? "bg-foreground/10 text-foreground"
                    : "text-foreground/40 hover:text-foreground/70"
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="relative px-2 py-4">
        <ChartContainer
          config={chartConfig}
          className="w-full !aspect-auto"
          style={{ height }}
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12, top: 20 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--foreground)"
              strokeOpacity={0.03}
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{
                fill: "var(--foreground)",
                fillOpacity: 0.4,
                fontSize: 10,
              }}
            />
            <YAxis
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{
                fill: "var(--foreground)",
                fillOpacity: 0.4,
                fontSize: 10,
              }}
              tickFormatter={(value) => `${value}%`}
              width={40}
            />
            <Tooltip
              cursor={<CustomCursor />}
              content={renderTooltipContent}
              wrapperStyle={{ outline: "none" }}
              allowEscapeViewBox={{ x: true, y: true }}
              position={{ y: 0 }}
            />
            {options.map((opt, index) => {
              if (!selectedOptions.has(index)) return null;
              const colorInfo = OPTION_COLORS[index % OPTION_COLORS.length];
              return (
                <Line
                  key={index}
                  dataKey={`option${index}`}
                  name={opt.label}
                  type="stepAfter"
                  stroke={colorInfo.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: colorInfo.color,
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              );
            })}
          </LineChart>
        </ChartContainer>

        {/* Legend labels on the chart like the mock */}
        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 text-xs pointer-events-none">
          {options.map((opt, index) => {
            if (!selectedOptions.has(index)) return null;
            const colorInfo = OPTION_COLORS[index % OPTION_COLORS.length];
            // Position based on percentage value
            const topOffset = 100 - opt.percentage;
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md"
                style={{
                  backgroundColor: `${colorInfo.color}20`,
                  position: 'absolute',
                  right: 0,
                  top: `${topOffset}%`,
                  transform: 'translateY(-50%)',
                }}
              >
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: colorInfo.color }}
                />
                <span style={{ color: colorInfo.color }} className="font-semibold">
                  {opt.percentage.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PriceChart;
