'use client';

import { format } from 'date-fns';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DataPoint = { date: string; engagement: number };

const EMPTY_DATA: DataPoint[] = [];

function EngagementAreaChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const formattedData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM. dd'),
  }));

  return (
    <div className="h-80 min-h-80 w-full min-w-0" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
          <defs>
            <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FF0083" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#FF0083" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#FF0083"
            fontSize={12}
            tickMargin={10}
            width={70}
            axisLine={false}
            tickLine={false}
            tickFormatter={value => new Intl.NumberFormat('he-IL').format(value)}
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
            stroke="#FF0083"
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
