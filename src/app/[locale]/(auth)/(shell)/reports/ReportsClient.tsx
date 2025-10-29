'use client';

import { BarChart3, MousePointer, TrendingUp } from 'lucide-react';
import React from 'react';
import FollowersTrendChart from '@/components/dashboard/FollowersTrendChart';
import ImpressionsAreaChart from '@/components/dashboard/ImpressionsAreaChart';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsClient(): React.ReactElement {
  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <h1 className="text-3xl font-bold">Reports</h1>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <MetricCard title="Total Reach" value="32.5k" change={5} icon={TrendingUp} />
          <MetricCard title="Engagement" value="1.8k" change={2} icon={BarChart3} />
          <MetricCard title="Clicks" value="740" change={1} icon={MousePointer} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Followers Trend</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <FollowersTrendChart />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Impressions</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              <ImpressionsAreaChart />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
