'use client';

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
  { date: 'Jan 01', followers: 14800 },
  { date: 'Jan 05', followers: 15050 },
  { date: 'Jan 10', followers: 15220 },
  { date: 'Jan 15', followers: 15380 },
  { date: 'Jan 20', followers: 15440 },
  { date: 'Jan 25', followers: 15610 },
  { date: 'Jan 30', followers: 15790 },
];

export function FollowersTrendChart({
  data = sampleData,
}: {
  data?: DataPoint[];
}) {
  // Removed mounted state and useEffect as this is a client component and the check is unnecessary.
  // const [mounted, setMounted] = useState(false);
  // useEffect(() => {
  //   setMounted(true);
  // }, []);
  // if (!mounted) {
  //   return <div className="h-80 min-h-[20rem] w-full min-w-0" />;
  // }
  return (
    <div className="h-80 min-h-[20rem] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
          <YAxis
            stroke="#be185d"
            fontSize={12}
            tickMargin={10}
            axisLine={false}
            tickLine={false}
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
            stroke="#F50A81"
            strokeWidth={3}
            dot={{ r: 3, fill: '#F50A81' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default FollowersTrendChart;
