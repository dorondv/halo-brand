'use client';

import { format } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DataPoint = { date: string; engagement: number };

const EMPTY_DATA: DataPoint[] = [];

export function EngagementAreaChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const formattedData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM. dd'),
  }));

  return (
    <div className="h-80 min-h-[20rem] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F50A81" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#F50A81" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#be185d"
            fontSize={12}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => {
              if (value >= 1000) {
                return `${(value / 1000).toFixed(0)}K`;
              }
              return value.toString();
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #fce7f3',
              borderRadius: '12px',
            }}
            formatter={value => [new Intl.NumberFormat('he-IL').format(Number(value)), '']}
          />
          <Area
            type="monotone"
            dataKey="engagement"
            stroke="#F50A81"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorEngagement)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default EngagementAreaChart;
