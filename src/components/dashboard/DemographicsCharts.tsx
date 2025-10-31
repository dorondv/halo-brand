'use client';

import { Globe, Users } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type CountryData = { name: string; value: number };
type GenderData = { name: string; value: number };
type AgeData = { name: string; value: number };

const pinkShades = ['#F50A81', '#F973A8', '#FCB5D8', '#FECFE8', '#FFF0F8'];
const grayShade = '#9CA3AF';

type DemographicsChartsProps = {
  countries?: CountryData[];
  genders?: GenderData[];
  ages?: AgeData[];
  countriesTitle?: string;
  genderTitle?: string;
  ageTitle?: string;
  isRTL?: boolean;
};

const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) {
    return null;
  } // Don't show label for small slices

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={14}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function DemographicsCharts({
  countries = [],
  genders = [],
  ages = [],
  countriesTitle = 'Countries Mix',
  genderTitle = 'Gender Mix',
  ageTitle = 'Age Mix',
  isRTL = false,
}: DemographicsChartsProps) {
  // Order for LTR: Countries, Gender, Age
  // Order for RTL: Age, Gender, Countries (reversed)
  const charts = [
    <Card key="countries" className="rounded-lg border border-gray-200 bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
          <Globe className="h-5 w-5 text-pink-500" />
          {countriesTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={countries}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {countries.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index < pinkShades.length ? pinkShades[index] : grayShade}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={value => [`${Number(value).toFixed(0)}%`, '']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #fce7f3',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {countries.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    index < pinkShades.length ? pinkShades[index] : grayShade,
                }}
              />
              <span className="text-xs text-gray-700">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>,
    <Card key="gender" className="rounded-lg border border-gray-200 bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
          <Users className="h-5 w-5 text-pink-500" />
          {genderTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genders}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                innerRadius={40}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {genders.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === 0 ? pinkShades[0] : grayShade}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={value => [`${Number(value).toFixed(0)}%`, '']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #fce7f3',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {genders.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: index === 0 ? pinkShades[0] : grayShade,
                }}
              />
              <span className="text-xs text-gray-700">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>,
    <Card key="age" className="rounded-lg border border-gray-200 bg-white shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
          <Users className="h-5 w-5 text-pink-500" />
          {ageTitle}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ages}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                innerRadius={40}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {ages.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index < pinkShades.length ? pinkShades[index] : grayShade}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={value => [`${Number(value).toFixed(0)}%`, '']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid #fce7f3',
                  borderRadius: '12px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {ages.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor:
                    index < pinkShades.length ? pinkShades[index] : grayShade,
                }}
              />
              <span className="text-xs text-gray-700">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>,
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {isRTL ? [...charts].reverse() : charts}
    </div>
  );
}

export default DemographicsCharts;
