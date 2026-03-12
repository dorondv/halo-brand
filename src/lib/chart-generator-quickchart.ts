// QuickChart.io API-based chart generator - perfect for Vercel/serverless
// No native dependencies required - uses HTTP API

import { Buffer } from 'node:buffer';

const QUICKCHART_API_URL = 'https://quickchart.io/chart';

const brandColors = {
  primary: '#FF0083',
  primaryLight: '#FF3399',
  primaryLighter: '#FF66B3',
  grid: 'rgba(107, 114, 128, 0.2)',
  text: '#6b7280',
};

type ChartConfig = {
  type: string;
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string | string[];
      borderColor?: string;
      fill?: boolean;
      tension?: number;
      borderWidth?: number;
      borderRadius?: number;
      pointRadius?: number;
    }>;
  };
  options: {
    plugins: {
      title: {
        display: boolean;
        text: string;
        font: { size: number; weight: string };
        color: string;
      };
      legend: { display: boolean };
    };
    scales?: {
      x: {
        grid: { color: string };
        ticks: { color: string };
      };
      y: {
        grid: { color: string };
        ticks: { color: string; callback?: (value: any) => string; stepSize?: number };
      };
    };
  };
};

async function generateChartImage(chartConfig: ChartConfig): Promise<Buffer> {
  const response = await fetch(QUICKCHART_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chart: chartConfig,
      width: 800,
      height: 400,
      backgroundColor: 'transparent',
    }),
  });

  if (!response.ok) {
    throw new Error(`QuickChart API error: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateEngagementChart(
  data: Array<{ date: string; engagement: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const chartConfig: ChartConfig = {
    type: 'line',
    data: {
      labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Engagement',
          data: data.map(d => d.engagement),
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Engagement Over Time',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            callback(value: any) {
              return new Intl.NumberFormat('en-US').format(Number(value));
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}

export async function generateImpressionsChart(
  data: Array<{ date: string; impressions: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const chartConfig: ChartConfig = {
    type: 'line',
    data: {
      labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Impressions',
          data: data.map(d => d.impressions),
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Impressions Over Time',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            callback(value: any) {
              return new Intl.NumberFormat('en-US').format(Number(value));
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}

export async function generateFollowersTrendChart(
  data: Array<{ date: string; followers: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const chartConfig: ChartConfig = {
    type: 'line',
    data: {
      labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Followers',
          data: data.map(d => d.followers),
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Followers Trend',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            callback(value: any) {
              return new Intl.NumberFormat('en-US').format(Number(value));
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}

export async function generateNetFollowerGrowthChart(
  data: Array<{ date: string; growth: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const chartConfig: ChartConfig = {
    type: 'bar',
    data: {
      labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Growth',
          data: data.map(d => d.growth),
          backgroundColor: brandColors.primary,
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Net Follower Growth',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            callback(value: any) {
              return new Intl.NumberFormat('en-US').format(Number(value));
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}

export async function generatePostsByPlatformChart(
  data: Array<{ platform: string; posts: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const pinkShades = [
    brandColors.primary,
    brandColors.primaryLight,
    brandColors.primaryLighter,
    '#FF99CC',
    '#FFCCE6',
    '#FFE6F2',
    '#FFF0F8',
  ];

  const chartConfig: ChartConfig = {
    type: 'bar',
    data: {
      labels: data.map(d => d.platform),
      datasets: [
        {
          label: 'Posts',
          data: data.map(d => d.posts),
          backgroundColor: data.map((_, index) => pinkShades[index % pinkShades.length]!) as string[],
          borderRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Posts by Platform',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            stepSize: 1,
            callback(value: any) {
              return new Intl.NumberFormat('en-US').format(Number(value));
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}

export async function generateEngagementRateChart(
  data: Array<{ date: string; rate: number }>,
): Promise<Buffer> {
  if (data.length === 0) {
    throw new Error('No data provided');
  }

  const chartConfig: ChartConfig = {
    type: 'line',
    data: {
      labels: data.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [
        {
          label: 'Engagement Rate',
          data: data.map(d => d.rate),
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary,
          fill: false,
          tension: 0.4,
          borderWidth: 3,
          pointRadius: 4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Engagement Rate',
          font: { size: 16, weight: 'bold' },
          color: brandColors.text,
        },
      },
      scales: {
        x: {
          grid: { color: brandColors.grid },
          ticks: { color: brandColors.text },
        },
        y: {
          grid: { color: brandColors.grid },
          ticks: {
            color: brandColors.text,
            callback(value: any) {
              return `${Number(value).toFixed(1)}%`;
            },
          },
        },
      },
    },
  };

  return generateChartImage(chartConfig);
}
