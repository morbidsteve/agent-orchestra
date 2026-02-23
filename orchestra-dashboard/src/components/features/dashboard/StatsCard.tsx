import { cn } from '../../../lib/cn.ts';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  iconColor?: string;
  iconBg?: string;
}

export function StatsCard({ icon: Icon, label, value, subtitle, iconColor = 'text-accent-blue', iconBg = 'bg-accent-blue/10' }: StatsCardProps) {
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-5">
      <div className="flex items-center gap-4">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-6 w-6', iconColor)} />
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
