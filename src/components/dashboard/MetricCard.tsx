import { Card } from '@/components/ui/card';
import { cn } from '@/libs/cn';
import { TrendingUp } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    change: number; // percentage diff vs last month
    icon: React.ElementType;
}

export function MetricCard({ title, value, change, icon: Icon }: MetricCardProps) {
    const positive = change >= 0;
    return (
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200 hover:border-pink-400 hover:shadow-xl hover:shadow-pink-500/10 transition-all duration-300 overflow-hidden group rounded-lg hover:-translate-y-1">
            <div className="p-6 relative">
                <div className="flex items-start justify-between">
                    <div className="space-y-3">
                        <p className="text-sm font-medium text-gray-600">{title}</p>
                        <p className="text-3xl font-bold text-gray-900">
                            {typeof value === 'number'
                                ? new Intl.NumberFormat('en-US').format(value)
                                : value}
                        </p>
                        <div className="flex items-center gap-2">
                            <TrendingUp className={cn('w-4 h-4', positive ? 'text-pink-500' : 'text-red-500')} />
                            <span className={cn('text-sm font-semibold', positive ? 'text-pink-500' : 'text-red-500')}>
                                {change}%{positive ? '+' : ''}
                            </span>
                            <span className="text-xs text-gray-500">vs last month</span>
                        </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <Icon className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>
        </div>
    );
}
