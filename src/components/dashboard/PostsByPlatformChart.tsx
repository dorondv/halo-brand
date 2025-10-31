'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type DataPoint = { platform: string; posts: number };

const EMPTY_DATA: DataPoint[] = [];

function PostsByPlatformChart({ data = EMPTY_DATA }: { data?: DataPoint[] }) {
  const pinkShades = ['#F50A81', '#F973A8', '#FCB5D8', '#FECFE8', '#FFDDF2', '#FFF0F8', '#FFF5FB'];

  return (
    <div className="h-80 min-h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="platform" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#be185d"
            fontSize={12}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #fce7f3',
              borderRadius: '12px',
            }}
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
