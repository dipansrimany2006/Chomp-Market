"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";

// Color palette for multiple options
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
  height?: number;
  className?: string;
}

type TimePeriod = "5m" | "15m" | "1H" | "4H" | "1D";

interface ChartDataPoint {
  time: string;
  fullTime: string;
  timestamp: number;
  [key: string]: string | number;
}

// Custom tooltip that shows labels at each data point
const CustomTooltip = ({
  active,
  payload,
  label,
  coordinate,
  viewBox,
  options,
  selectedOptions,
}: any) => {
  if (!active || !payload || !payload.length) return null;

  const fullTime = payload[0]?.payload?.fullTime || label;

  return (
    <div className="pointer-events-none">
      {/* Date label at top */}
      <div
        className="absolute left-1/2 -translate-x-1/2 px-3 py-1 rounded-md bg-foreground/10 backdrop-blur-sm text-foreground text-xs font-medium whitespace-nowrap"
        style={{ top: -30 }}
      >
        {fullTime}
      </div>

      {/* Individual option labels */}
      {payload.map((entry: any, index: number) => {
        const optionIndex = parseInt(entry.dataKey.replace("option", ""));
        if (!selectedOptions.has(optionIndex)) return null;

        const colorInfo = OPTION_COLORS[optionIndex % OPTION_COLORS.length];
        const opt = options[optionIndex];
        const value = entry.value;

        // Calculate Y position based on value (0-100 scale)
        const chartHeight = viewBox?.height || 200;
        const chartTop = viewBox?.y || 0;
        const yPos = chartTop + chartHeight - (value / 100) * chartHeight;

        return (
          <div
            key={entry.dataKey}
            className="absolute px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transform -translate-x-1/2"
            style={{
              backgroundColor: colorInfo.bg,
              color: "#fff",
              left: coordinate?.x || 0,
              top: yPos - 12,
            }}
          >
            {opt?.label} • {value?.toFixed(0)}%
          </div>
        );
      })}
    </div>
  );
};

// Custom cursor (vertical line)
const CustomCursor = ({ points, height }: any) => {
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
  height = 300,
  className,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1H");
  const [selectedOptions, setSelectedOptions] = useState<Set<number>>(
    new Set(options.map((_, i) => i))
  );

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

  // Generate chart data based on selected period
  const chartData = useMemo(() => {
    const now = Date.now();
    const data: ChartDataPoint[] = [];

    const periodConfig: Record<
      TimePeriod,
      {
        points: number;
        interval: number;
        format: (d: Date) => string;
        fullFormat: (d: Date) => string;
      }
    > = {
      "5m": {
        points: 30,
        interval: 10 * 1000,
        format: (d) =>
          `${d.getMinutes()}:${d.getSeconds().toString().padStart(2, "0")}`,
        fullFormat: (d) =>
          d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
      },
      "15m": {
        points: 30,
        interval: 30 * 1000,
        format: (d) =>
          `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`,
        fullFormat: (d) =>
          d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
      },
      "1H": {
        points: 24,
        interval: 2.5 * 60 * 1000,
        format: (d) =>
          `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`,
        fullFormat: (d) =>
          d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
      },
      "4H": {
        points: 24,
        interval: 10 * 60 * 1000,
        format: (d) =>
          `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`,
        fullFormat: (d) =>
          d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
      },
      "1D": {
        points: 24,
        interval: 60 * 60 * 1000,
        format: (d) => `${d.getHours()}:00`,
        fullFormat: (d) =>
          d.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
      },
    };

    const config = periodConfig[selectedPeriod];

    for (let i = config.points; i >= 0; i--) {
      const timestamp = now - i * config.interval;
      const date = new Date(timestamp);

      const point: ChartDataPoint = {
        time: config.format(date),
        fullTime: config.fullFormat(date),
        timestamp,
      };

      options.forEach((opt, optIndex) => {
        const variance =
          Math.sin(i * 0.5 + optIndex) * 5 + Math.random() * 3 - 1.5;
        const value = Math.max(
          1,
          Math.min(99, opt.percentage + variance * (i / config.points))
        );
        point[`option${optIndex}`] = Number(value.toFixed(1));
      });

      data.push(point);
    }

    // Ensure the last point has the current percentages
    if (data.length > 0) {
      options.forEach((opt, optIndex) => {
        data[data.length - 1][`option${optIndex}`] = opt.percentage;
      });
    }

    return data;
  }, [options, selectedPeriod]);

  const periods: TimePeriod[] = ["5m", "15m", "1H", "4H", "1D"];

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
  const renderTooltipContent = useCallback(
    (props: any) => {
      const { active, payload, coordinate, viewBox } = props;
      if (!active || !payload || !payload.length) return null;

      const fullTime = payload[0]?.payload?.fullTime;

      return (
        <div className="relative">
          {/* Individual option labels positioned at their Y values */}
          {payload.map((entry: any) => {
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
                  type="monotone"
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

        {/* Legend on right side like the mock */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 text-xs">
          {options.map((opt, index) => {
            if (!selectedOptions.has(index)) return null;
            const colorInfo = OPTION_COLORS[index % OPTION_COLORS.length];
            return (
              <div key={index} className="flex items-center gap-2 text-right">
                <span className="text-foreground/50 truncate max-w-[60px]">
                  {opt.label}
                </span>
                <span className="font-bold" style={{ color: colorInfo.color }}>
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
