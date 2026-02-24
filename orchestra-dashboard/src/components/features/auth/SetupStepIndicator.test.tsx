import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SetupStepIndicator } from './SetupStepIndicator.tsx';

const steps = [
  { label: 'Claude', key: 'claude' },
  { label: 'GitHub', key: 'github' },
];

describe('SetupStepIndicator', () => {
  it('renders all step labels', () => {
    render(
      <SetupStepIndicator steps={steps} currentStep={0} completedSteps={[]} />,
    );
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('shows step numbers for pending steps', () => {
    render(
      <SetupStepIndicator steps={steps} currentStep={0} completedSteps={[]} />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows check icon instead of number for completed steps', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={1} completedSteps={[0]} />,
    );
    // Step 1 is completed, so the number "1" should not be rendered
    expect(screen.queryByText('1')).not.toBeInTheDocument();
    // Step 2 is current, so "2" is rendered
    expect(screen.getByText('2')).toBeInTheDocument();
    // The check icon svg should be present for the completed step
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it('applies current-step styling to the active step', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={0} completedSteps={[]} />,
    );
    // The first step circle should have the accent-blue class
    const circles = container.querySelectorAll('.rounded-full');
    expect(circles[0]?.className).toContain('bg-accent-blue');
    // The second step circle should have surface-600 (pending)
    expect(circles[1]?.className).toContain('bg-surface-600');
  });

  it('applies completed styling when step is completed', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={1} completedSteps={[0]} />,
    );
    const circles = container.querySelectorAll('.rounded-full');
    expect(circles[0]?.className).toContain('bg-green-500');
  });

  it('renders connector lines between steps', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={0} completedSteps={[]} />,
    );
    // There should be a connector line (the w-12 div) between steps
    const connectors = container.querySelectorAll('.w-12');
    expect(connectors.length).toBe(1);
  });

  it('applies green connector when the preceding step is completed', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={1} completedSteps={[0]} />,
    );
    const connectors = container.querySelectorAll('.w-12');
    expect(connectors[0]?.className).toContain('bg-green-500');
  });

  it('applies gray connector when the preceding step is not completed', () => {
    const { container } = render(
      <SetupStepIndicator steps={steps} currentStep={0} completedSteps={[]} />,
    );
    const connectors = container.querySelectorAll('.w-12');
    expect(connectors[0]?.className).toContain('bg-surface-600');
  });
});
