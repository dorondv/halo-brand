'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@/components/theme/theme-context';
import { RECHARTS_INITIAL_H80 } from '@/libs/rechartsResponsive';

type DataPoint = { platform: string; posts: number };

const AXIS_LIGHT = '#6b7280';
const AXIS_DARK = '#9ca3af';
const EMPTY_DATA: DataPoint[] = [];

function PostsByPlatformChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const { isDark } = useTheme();
  const axisColor = isDark ? AXIS_DARK : AXIS_LIGHT;
  const pinkShades = ['#FF0083', '#FF3399', '#FF66B3', '#FF99CC', '#FFCCE6', '#FFE6F2', '#FFF0F8'];

  return (
    <div className="h-80 min-h-80 w-full min-w-0" dir="ltr">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={RECHARTS_INITIAL_H80}>
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
          <CartesianGrid stroke={axisColor} strokeDasharray="3 3" strokeOpacity={isDark ? 0.4 : 0.2} />
          <XAxis dataKey="platform" stroke={axisColor} fontSize={12} />
          <YAxis
            stroke={axisColor}
            fontSize={12}
            tickMargin={10}
            width={70}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tickFormatter={value => new Intl.NumberFormat('he-IL').format(value)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.9)',
              border: isDark ? '1px solid #4b5563' : '1px solid #fce7f3',
              borderRadius: '12px',
              color: isDark ? '#e5e7eb' : undefined,
            }}
            labelStyle={{ color: isDark ? '#e5e7eb' : '#374151' }}
            itemStyle={{ color: isDark ? '#e5e7eb' : '#374151' }}
            formatter={value => [new Intl.NumberFormat('he-IL').format(Number(value)), '']}
          />
          <Bar dataKey="posts" radius={[4, 4, 0, 0]}>
            {data.map((_entry, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Cell key={`cell-${index}`} fill={pinkShades[index % pinkShades.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PostsByPlatformChart;
