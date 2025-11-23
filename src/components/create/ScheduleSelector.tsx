'use client';

import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ScheduleSelectorProps = {
  scheduleMode: 'now' | 'later';
  onScheduleModeChange: (mode: 'now' | 'later') => void;
  scheduledTime: string;
  onScheduledTimeChange: (time: string) => void;
};

export default function ScheduleSelector({
  scheduleMode,
  onScheduleModeChange,
  scheduledTime,
  onScheduledTimeChange,
}: ScheduleSelectorProps) {
  const now = new Date();
  const minDateTime = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
  const minDateTimeString = minDateTime.toISOString().slice(0, 16);

  return (
    <Card className="border-gray-200 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-pink-500" />
          Publishing Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={scheduleMode === 'now' ? 'default' : 'outline'}
            onClick={() => onScheduleModeChange('now')}
            className={
              scheduleMode === 'now'
                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                : 'hover:bg-pink-50'
            }
          >
            <Clock className="mr-2 h-4 w-4" />
            Now
          </Button>
          <Button
            type="button"
            variant={scheduleMode === 'later' ? 'default' : 'outline'}
            onClick={() => onScheduleModeChange('later')}
            className={
              scheduleMode === 'later'
                ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-white'
                : 'hover:bg-pink-50'
            }
          >
            <Calendar className="mr-2 h-4 w-4" />
            Schedule
          </Button>
        </div>

        {scheduleMode === 'later' && (
          <div className="space-y-2">
            <Label htmlFor="scheduled_time" className="text-sm font-medium text-slate-700">
              Select Date & Time
            </Label>
            <Input
              id="scheduled_time"
              type="datetime-local"
              min={minDateTimeString}
              value={scheduledTime}
              onChange={e => onScheduledTimeChange(e.target.value)}
              className="border-gray-200 focus:border-pink-300"
            />
            <p className="text-xs text-slate-500">Posts will be published at the scheduled time</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
