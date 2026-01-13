"use client";

import React from "react";
import { Pie, PieChart } from "recharts";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

// Color palette for multiple options
const OPTION_COLORS = [
  "#00bf63", // green
  "#ee3e3d", // red
  "#ffa51f", // orange
  "#0081cc", // blue
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

const PriceChart: React.FC<PriceChartProps> = ({
  options,
  height = 250,
  className,
}) => {
  // Build chart data from options
  const chartData = options.map((opt, index) => ({
    name: opt.label,
    value: opt.percentage,
    fill: OPTION_COLORS[index % OPTION_COLORS.length],
  }));

  // Build chart config dynamically
  const chartConfig: ChartConfig = {
    value: {
      label: "Probability",
    },
    ...options.reduce((acc, opt, index) => {
      const key = opt.label.toLowerCase().replace(/\s+/g, "_");
      acc[key] = {
        label: opt.label,
        color: OPTION_COLORS[index % OPTION_COLORS.length],
      };
      return acc;
    }, {} as ChartConfig),
  };

  // Calculate total for display
  const totalPercentage = options.reduce((sum, opt) => sum + opt.percentage, 0);

  return (
    <Card className={cn("bg-neutral-900 border-border flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-lg">Probability Distribution</CardTitle>
        <CardDescription>Current market odds</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="[&_.recharts-pie-label-text]:fill-foreground mx-auto aspect-square pb-0"
          style={{ maxHeight: height }}
        >
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              label={({ name, value }) => `${name}: ${value.toFixed(0)}%`}
              labelLine={true}
              cx="50%"
              cy="50%"
              outerRadius={80}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 px-4 pb-4">
        {options.map((opt, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: OPTION_COLORS[index % OPTION_COLORS.length] }}
            />
            <span className="text-sm text-muted-foreground">{opt.label}</span>
            <span
              className="text-sm font-bold"
              style={{ color: OPTION_COLORS[index % OPTION_COLORS.length] }}
            >
              {opt.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default PriceChart;
