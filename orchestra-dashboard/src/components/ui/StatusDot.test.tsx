import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatusDot } from './StatusDot.tsx';

describe('StatusDot', () => {
  it('renders idle status with gray color', () => {
    const { container } = render(<StatusDot status="idle" />);
    const dot = container.querySelector('.bg-gray-400');
    expect(dot).toBeInTheDocument();
  });

  it('renders busy status with green color', () => {
    const { container } = render(<StatusDot status="busy" />);
    const dot = container.querySelector('.bg-green-400');
    expect(dot).toBeInTheDocument();
  });

  it('renders offline status with red color', () => {
    const { container } = render(<StatusDot status="offline" />);
    const dot = container.querySelector('.bg-red-400');
    expect(dot).toBeInTheDocument();
  });

  it('shows ping animation for busy status', () => {
    const { container } = render(<StatusDot status="busy" />);
    const ping = container.querySelector('.animate-ping');
    expect(ping).toBeInTheDocument();
  });

  it('does not show ping animation for idle status', () => {
    const { container } = render(<StatusDot status="idle" />);
    const ping = container.querySelector('.animate-ping');
    expect(ping).toBeNull();
  });

  it('applies small size', () => {
    const { container } = render(<StatusDot status="idle" size="sm" />);
    const dot = container.querySelector('.h-2');
    expect(dot).toBeInTheDocument();
  });

  it('applies medium size by default', () => {
    const { container } = render(<StatusDot status="idle" />);
    const dot = container.querySelector('.h-3');
    expect(dot).toBeInTheDocument();
  });
});
