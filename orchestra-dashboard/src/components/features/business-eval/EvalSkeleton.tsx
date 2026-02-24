import { cn } from '../../../lib/cn.ts';

interface EvalSkeletonProps {
  section: 'market-research' | 'competitive-analysis' | 'scoring' | 'recommendation';
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('bg-surface-600 rounded animate-pulse', className)} />;
}

function MarketResearchSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-4/6" />
      <div className="flex flex-wrap gap-2 pt-1">
        <SkeletonBlock className="h-6 w-20" />
        <SkeletonBlock className="h-6 w-24" />
        <SkeletonBlock className="h-6 w-16" />
        <SkeletonBlock className="h-6 w-28" />
      </div>
    </div>
  );
}

function CompetitiveAnalysisSkeleton() {
  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="grid grid-cols-5 gap-3">
        <SkeletonBlock className="h-4" />
        <SkeletonBlock className="h-4" />
        <SkeletonBlock className="h-4" />
        <SkeletonBlock className="h-4" />
        <SkeletonBlock className="h-4" />
      </div>
      {/* Data rows */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-5 gap-3">
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
          <SkeletonBlock className="h-8" />
        </div>
      ))}
    </div>
  );
}

function ScoringSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between">
            <SkeletonBlock className="h-3 w-16" />
            <SkeletonBlock className="h-3 w-8" />
          </div>
          <SkeletonBlock className="h-3 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonBlock className="h-12 w-40 rounded-lg" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-3/4" />
    </div>
  );
}

const SKELETON_MAP: Record<EvalSkeletonProps['section'], () => React.JSX.Element> = {
  'market-research': MarketResearchSkeleton,
  'competitive-analysis': CompetitiveAnalysisSkeleton,
  scoring: ScoringSkeleton,
  recommendation: RecommendationSkeleton,
};

export function EvalSkeleton({ section }: EvalSkeletonProps) {
  const Skeleton = SKELETON_MAP[section];
  return <Skeleton />;
}
