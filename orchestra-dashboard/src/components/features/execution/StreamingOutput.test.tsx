import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreamingOutput } from './StreamingOutput.tsx';

describe('StreamingOutput', () => {
  it('renders output lines', () => {
    render(<StreamingOutput lines={['$ npm test', 'All tests passed']} />);
    expect(screen.getByText('$ npm test')).toBeInTheDocument();
    expect(screen.getByText('All tests passed')).toBeInTheDocument();
  });

  it('returns null for empty lines', () => {
    const { container } = render(<StreamingOutput lines={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('colors command lines in blue', () => {
    render(<StreamingOutput lines={['$ npx tsc --noEmit']} />);
    const line = screen.getByText('$ npx tsc --noEmit');
    expect(line.className).toContain('text-accent-blue');
  });

  it('colors PASS lines in green', () => {
    render(<StreamingOutput lines={['PASS src/test.ts']} />);
    const line = screen.getByText('PASS src/test.ts');
    expect(line.className).toContain('text-green-400');
  });

  it('colors FAIL lines in red', () => {
    render(<StreamingOutput lines={['FAIL src/test.ts']} />);
    const line = screen.getByText('FAIL src/test.ts');
    expect(line.className).toContain('text-red-400');
  });
});
