import { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type {
  MarketResearchData,
  CompetitorEntry,
  ICEScoreData,
  RecommendationData,
} from '../../../lib/types.ts';
import { MarketResearchSection } from './MarketResearchSection.tsx';
import { CompetitiveTable } from './CompetitiveTable.tsx';
import { ICEScoreGauge } from './ICEScoreGauge.tsx';
import { RecommendationBadge } from './RecommendationBadge.tsx';
import { EvalSkeleton } from './EvalSkeleton.tsx';

interface BusinessEvalCardProps {
  marketResearch?: MarketResearchData;
  competitiveAnalysis?: CompetitorEntry[];
  iceScore?: ICEScoreData;
  recommendation?: RecommendationData;
  activeSection?: string;
}

interface SectionWrapperProps {
  title: string;
  loaded: boolean;
  skeletonType: 'market-research' | 'competitive-analysis' | 'scoring' | 'recommendation';
  active: boolean;
  children: React.ReactNode;
}

function FadeIn({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="transition-opacity duration-500 ease-out"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {children}
    </div>
  );
}

function SectionWrapper({ title, loaded, skeletonType, active, children }: SectionWrapperProps) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-lg border border-surface-600 p-4',
        active && !loaded && 'border-accent-blue/30',
      )}
    >
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      {loaded ? (
        <FadeIn>{children}</FadeIn>
      ) : (
        <EvalSkeleton section={skeletonType} />
      )}
    </div>
  );
}

export function BusinessEvalCard({
  marketResearch,
  competitiveAnalysis,
  iceScore,
  recommendation,
  activeSection,
}: BusinessEvalCardProps) {
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Briefcase className="h-5 w-5 text-accent-blue" />
        <h2 className="text-base font-semibold text-gray-200">Feature Evaluation</h2>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <SectionWrapper
          title="Market Research"
          loaded={!!marketResearch}
          skeletonType="market-research"
          active={activeSection === 'market-research'}
        >
          {marketResearch && <MarketResearchSection data={marketResearch} />}
        </SectionWrapper>

        <SectionWrapper
          title="Competitive Analysis"
          loaded={!!competitiveAnalysis}
          skeletonType="competitive-analysis"
          active={activeSection === 'competitive-analysis'}
        >
          {competitiveAnalysis && <CompetitiveTable competitors={competitiveAnalysis} />}
        </SectionWrapper>

        <SectionWrapper
          title="ICE Scoring"
          loaded={!!iceScore}
          skeletonType="scoring"
          active={activeSection === 'scoring'}
        >
          {iceScore && <ICEScoreGauge data={iceScore} />}
        </SectionWrapper>

        <SectionWrapper
          title="Recommendation"
          loaded={!!recommendation}
          skeletonType="recommendation"
          active={activeSection === 'recommendation'}
        >
          {recommendation && <RecommendationBadge data={recommendation} />}
        </SectionWrapper>
      </div>
    </div>
  );
}
