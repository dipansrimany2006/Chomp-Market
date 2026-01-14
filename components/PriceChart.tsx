"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Color palette for multiple options
const OPTION_COLORS = [
  { line: "#00bf63", bg: "rgba(0, 191, 99, 0.1)" }, // green
  { line: "#ee3e3d", bg: "rgba(238, 62, 61, 0.1)" }, // red
  { line: "#ffa51f", bg: "rgba(255, 165, 31, 0.1)" }, // orange
  { line: "#0081cc", bg: "rgba(0, 129, 204, 0.1)" }, // blue
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

// Generate simulated historical data points trending to current value
const generateHistoricalData = (currentValue: number, points: number = 12) => {
  const data: number[] = [];
  // Start from a random point between 30-70%
  let value = 30 + Math.random() * 40;

  for (let i = 0; i < points - 1; i++) {
    data.push(Math.round(value * 10) / 10);
    // Gradually trend toward the current value with some noise
    const trend = (currentValue - value) / (points - i);
    const noise = (Math.random() - 0.5) * 10;
    value += trend + noise;
    // Clamp between 0 and 100
    value = Math.max(0, Math.min(100, value));
  }
  // End with the actual current value
  data.push(currentValue);
  return data;
};

// Generate time labels
const generateTimeLabels = (points: number = 12) => {
  const labels: string[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 2 * 60 * 60 * 1000); // 2 hour intervals
    labels.push(date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }));
  }
  return labels;
};

const PriceChart: React.FC<PriceChartProps> = ({
  options,
  marketId,
  height = 250,
  className,
}) => {
  // Generate labels and datasets with memoization based on marketId
  const { labels, datasets } = useMemo(() => {
    const timeLabels = generateTimeLabels(12);

    const chartDatasets = options.map((opt, index) => {
      const colorSet = OPTION_COLORS[index % OPTION_COLORS.length];
      const historicalData = generateHistoricalData(opt.percentage, 12);

      return {
        label: opt.label,
        data: historicalData,
        borderColor: colorSet.line,
        backgroundColor: colorSet.bg,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: colorSet.line,
        pointHoverBorderColor: "#ffffff",
        pointHoverBorderWidth: 2,
        borderWidth: 2,
      };
    });

    return { labels: timeLabels, datasets: chartDatasets };
  }, [marketId, options.map(o => o.percentage).join(",")]);

  const chartData = {
    labels,
    datasets,
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(23, 23, 23, 0.95)",
        titleColor: "#ffffff",
        bodyColor: "#a3a3a3",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context: { dataset: { label?: string }; parsed: { y: number } }) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
          drawBorder: false,
        },
        ticks: {
          color: "#a3a3a3",
          font: {
            size: 11,
          },
          maxRotation: 0,
        },
        border: {
          display: false,
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: "rgba(255, 255, 255, 0.05)",
          drawBorder: false,
        },
        ticks: {
          color: "#a3a3a3",
          font: {
            size: 11,
          },
          callback: (value: number | string) => `${value}%`,
          stepSize: 25,
        },
        border: {
          display: false,
        },
      },
    },
  };

  return (
    <Card className={cn("bg-neutral-900 border-border flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle className="text-lg">Probability Over Time</CardTitle>
        <CardDescription>Market odds history</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-4 pt-4">
        <div style={{ height }}>
          <Line data={chartData} options={chartOptions} />
        </div>
      </CardContent>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 px-4 pb-4">
        {options.map((opt, index) => (
          <div key={index} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: OPTION_COLORS[index % OPTION_COLORS.length].line }}
            />
            <span className="text-sm text-muted-foreground">{opt.label}</span>
            <span
              className="text-sm font-bold"
              style={{ color: OPTION_COLORS[index % OPTION_COLORS.length].line }}
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
