import { Check } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface StepInfo {
  label: string;
  key: string;
}

interface SetupStepIndicatorProps {
  steps: StepInfo[];
  currentStep: number;
  completedSteps: number[];
}

export function SetupStepIndicator({ steps, currentStep, completedSteps }: SetupStepIndicatorProps) {
  return (
    <div className="flex items-center justify-center w-full">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index);
        const isCurrent = index === currentStep;

        return (
          <div key={step.key} className="flex items-center">
            {/* Connector line before this step (skip for first step) */}
            {index > 0 && (
              <div
                className={cn(
                  'h-0.5 w-12',
                  completedSteps.includes(index - 1) ? 'bg-green-500' : 'bg-surface-600',
                )}
              />
            )}

            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  isCompleted && 'bg-green-500 text-white',
                  isCurrent && !isCompleted && 'bg-accent-blue text-white',
                  !isCurrent && !isCompleted && 'bg-surface-600 text-gray-400',
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCompleted && 'text-green-400',
                  isCurrent && !isCompleted && 'text-gray-100',
                  !isCurrent && !isCompleted && 'text-gray-500',
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
