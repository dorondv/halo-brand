'use client';

import { format } from 'date-fns';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DataPoint = { date: string; followers: number };
const sampleData: DataPoint[] = [
  { date: 'Jan 01', followers: 0 },
  { date: 'Jan 05', followers: 2632 },
  { date: 'Jan 10', followers: 5263 },
  { date: 'Jan 15', followers: 7895 },
  { date: 'Jan 20', followers: 10527 },
  { date: 'Jan 25', followers: 13158 },
  { date: 'Jan 30', followers: 15790 },
];

function FollowersTrendChart({
  data = sampleData,
}: {
  data?: DataPoint[];
}) {
  const formattedData = data.map(d => ({
    ...d,
    date: d.date.includes('-') ? format(new Date(d.date), 'MMM. dd') : d.date,
  }));

  return (
    <div className="h-80 min-h-80 w-full min-w-0" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
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
          <Line
            type="monotone"
            dataKey="followers"
            stroke="#FF0083"
            strokeWidth={3}
            dot={{ r: 3, fill: '#FF0083' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default FollowersTrendChart;
