'use client';

import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/theme/theme-context';

type DataPoint = { date: string; growth: number };

const AXIS_LIGHT = '#6b7280';
const AXIS_DARK = '#9ca3af';
const EMPTY_DATA: DataPoint[] = [];

function NetFollowerGrowthChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const { isDark } = useTheme();
  const axisColor = isDark ? AXIS_DARK : AXIS_LIGHT;
  const formattedData = data.map(d => ({
    ...d,
    date: format(new Date(d.date), 'MMM. dd'),
  }));

  return (
    <div className="h-80 min-h-80 w-full min-w-0" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
          <CartesianGrid stroke={axisColor} strokeDasharray="3 3" strokeOpacity={isDark ? 0.4 : 0.2} />
          <XAxis dataKey="date" stroke={axisColor} fontSize={12} />
          <YAxis
            stroke={axisColor}
            fontSize={12}
            tickMargin={10}
            width={70}
            axisLine={false}
            tickLine={false}
            domain={[0, 'auto']}
            tickFormatter={value => new Intl.NumberFormat('he-IL').format(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.9)',
              border: isDark ? '1px solid #4b5563' : '1px solid #fce7f3',
              borderRadius: '12px',
              color: isDark ? '#e5e7eb' : undefined,
            }}
            formatter={value => [new Intl.NumberFormat('he-IL').format(Number(value)), '']}
          />
          <Bar dataKey="growth" radius={[4, 4, 0, 0]}>
            {formattedData.map(entry => (
              <Cell key={`cell-${entry.date}-${entry.growth}`} fill="#FF0083" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default NetFollowerGrowthChart;
