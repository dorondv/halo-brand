'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const tiers = [
  { name: 'Free', price: '$0', features: ['1 account', '10 posts/mo', 'Basic analytics'] },
  { name: 'Pro', price: '$12', features: ['5 accounts', 'Unlimited posts', 'Advanced analytics'] },
  { name: 'Business', price: '$29', features: ['15 accounts', 'Team access', 'Priority support'] },
];

export default function PricingClient(): React.ReactElement {
  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto max-w-5xl space-y-8">
        <h1 className="text-center text-3xl font-bold">Pricing</h1>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map(tier => (
            <Card key={tier.name} className="rounded-2xl border">
              <CardHeader>
                <CardTitle className="text-center">{tier.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center text-4xl font-extrabold">{tier.price}</div>
                <ul className="space-y-2 text-sm text-gray-600">
                  {tier.features.map(f => (
                    <li key={f}>
                      •
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <Button className="w-full">
                    Choose
                    {tier.name}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
