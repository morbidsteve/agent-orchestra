import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card.tsx';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders header when provided', () => {
    render(<Card header={<span>Header</span>}>Body</Card>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(<Card footer={<span>Footer</span>}>Body</Card>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('applies padding by default', () => {
    const { container } = render(<Card>Content</Card>);
    // The content wrapper should have p-5 class
    const contentDiv = container.querySelector('.p-5');
    expect(contentDiv).toBeInTheDocument();
  });

  it('removes padding when noPadding is set', () => {
    const { container } = render(<Card noPadding>Content</Card>);
    const contentDiv = container.querySelector('.p-5');
    expect(contentDiv).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass('custom');
  });
});
