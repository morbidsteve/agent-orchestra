import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AgentPopup } from './AgentPopup.tsx';
import type { AgentNode, AgentVisualStatus } from '../../../lib/types.ts';

function makeAgent(overrides?: Partial<AgentNode>): AgentNode {
  return {
    role: 'developer',
    name: 'Developer',
    color: '#3b82f6',
    icon: 'Terminal',
    visualStatus: 'idle',
    currentTask: '',
    ...overrides,
  };
}

const defaultProps = {
  agent: makeAgent(),
  output: [] as string[],
  files: [] as string[],
  onClose: vi.fn(),
  position: { x: 30, y: 30 },
};

describe('AgentPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders agent name in header', () => {
    render(<AgentPopup {...defaultProps} agent={makeAgent({ name: 'Developer' })} />);
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('renders agent role badge in header', () => {
    render(<AgentPopup {...defaultProps} agent={makeAgent({ role: 'developer-2' })} />);
    // Role badge replaces dashes with spaces
    expect(screen.getByText('developer 2')).toBeInTheDocument();
  });

  it('renders agent name and role together', () => {
    render(
      <AgentPopup
        {...defaultProps}
        agent={makeAgent({ name: 'DevSecOps', role: 'devsecops' })}
      />,
    );
    expect(screen.getByText('DevSecOps')).toBeInTheDocument();
    expect(screen.getByText('devsecops')).toBeInTheDocument();
  });

  it('shows current task when agent has one', () => {
    render(
      <AgentPopup
        {...defaultProps}
        agent={makeAgent({ currentTask: 'Implementing login flow' })}
      />,
    );
    expect(screen.getByText('Current Task')).toBeInTheDocument();
    expect(screen.getByText('Implementing login flow')).toBeInTheDocument();
  });

  it('shows "Idle" when agent has no current task', () => {
    render(
      <AgentPopup
        {...defaultProps}
        agent={makeAgent({ currentTask: '' })}
      />,
    );
    expect(screen.getByText('Current Task')).toBeInTheDocument();
    // "Idle" appears in both the status badge and the current task section.
    // Verify the task section specifically has the "Idle" text.
    const idleElements = screen.getAllByText('Idle');
    expect(idleElements.length).toBeGreaterThanOrEqual(1);
    // The task section "Idle" is inside a div with class text-xs text-gray-300
    const taskIdleElement = idleElements.find(
      el => el.classList.contains('text-xs') && el.classList.contains('text-gray-300'),
    );
    expect(taskIdleElement).toBeDefined();
  });

  it('displays output lines in the output section', () => {
    const output = ['Building feature...', 'Running tests...', 'All tests passed'];
    render(<AgentPopup {...defaultProps} output={output} />);
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText('Building feature...')).toBeInTheDocument();
    expect(screen.getByText('Running tests...')).toBeInTheDocument();
    expect(screen.getByText('All tests passed')).toBeInTheDocument();
  });

  it('only shows last 10 output lines', () => {
    const output = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`);
    render(<AgentPopup {...defaultProps} output={output} />);
    // Lines 1-5 should NOT be visible (only last 10 shown)
    expect(screen.queryByText('Line 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Line 5')).not.toBeInTheDocument();
    // Lines 6-15 should be visible
    expect(screen.getByText('Line 6')).toBeInTheDocument();
    expect(screen.getByText('Line 15')).toBeInTheDocument();
  });

  it('does not show output section when output is empty', () => {
    render(<AgentPopup {...defaultProps} output={[]} />);
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('shows file list with extracted filenames', () => {
    const files = [
      '/workspace/src/components/Button.tsx',
      '/workspace/src/lib/utils.ts',
    ];
    render(<AgentPopup {...defaultProps} files={files} />);
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
    expect(screen.getByText('utils.ts')).toBeInTheDocument();
  });

  it('truncates file list to 8 items', () => {
    const files = Array.from({ length: 12 }, (_, i) => `/path/to/file${i + 1}.ts`);
    render(<AgentPopup {...defaultProps} files={files} />);
    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('file8.ts')).toBeInTheDocument();
    expect(screen.queryByText('file9.ts')).not.toBeInTheDocument();
    expect(screen.queryByText('file12.ts')).not.toBeInTheDocument();
  });

  it('does not show files section when files array is empty', () => {
    render(<AgentPopup {...defaultProps} files={[]} />);
    expect(screen.queryByText('Files')).not.toBeInTheDocument();
  });

  it('shows full file path as tooltip on file items', () => {
    const files = ['/workspace/src/components/features/Button.tsx'];
    render(<AgentPopup {...defaultProps} files={files} />);
    const fileElement = screen.getByText('Button.tsx');
    // The parent div has the `title` attribute with the full path
    expect(fileElement.closest('[title]')).toHaveAttribute(
      'title',
      '/workspace/src/components/features/Button.tsx',
    );
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<AgentPopup {...defaultProps} onClose={onClose} />);
    const closeButton = screen.getByLabelText('Close popup');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click outside the popup calls onClose after delay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div>
        <div data-testid="outside">Outside area</div>
        <AgentPopup {...defaultProps} onClose={onClose} />
      </div>,
    );

    // The mousedown listener is added after a 50ms setTimeout
    // Advance past the 50ms delay so the listener is registered
    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Click outside the popup
    const outsideElement = container.querySelector('[data-testid="outside"]')!;
    fireEvent.mouseDown(outsideElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('click inside the popup does not call onClose', () => {
    const onClose = vi.fn();
    render(<AgentPopup {...defaultProps} onClose={onClose} />);

    // Advance past the 50ms delay so the listener is registered
    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Click inside the popup — on the agent name text
    const nameElement = screen.getByText('Developer');
    fireEvent.mouseDown(nameElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not trigger outside click before the 50ms delay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <div>
        <div data-testid="outside">Outside area</div>
        <AgentPopup {...defaultProps} onClose={onClose} />
      </div>,
    );

    // Click outside immediately (before 50ms delay elapses)
    const outsideElement = container.querySelector('[data-testid="outside"]')!;
    fireEvent.mouseDown(outsideElement);
    expect(onClose).not.toHaveBeenCalled();
  });

  describe('status badge', () => {
    const statusCases: Array<{
      status: AgentVisualStatus;
      label: string;
    }> = [
      { status: 'working', label: 'Working' },
      { status: 'done', label: 'Done' },
      { status: 'error', label: 'Error' },
      { status: 'idle', label: 'Idle' },
    ];

    for (const { status, label } of statusCases) {
      it(`shows "${label}" badge when status is "${status}"`, () => {
        render(
          <AgentPopup
            {...defaultProps}
            agent={makeAgent({ visualStatus: status })}
          />,
        );
        // Use getAllByText for 'Idle' since it appears in both badge and task section
        const matches = screen.getAllByText(label);
        // At least one of the matches should be the status badge (font-medium class)
        const badgeMatch = matches.find(el =>
          el.classList.contains('font-medium'),
        );
        expect(badgeMatch).toBeDefined();
      });
    }

    it('shows blue-tinted badge for working status', () => {
      render(
        <AgentPopup
          {...defaultProps}
          agent={makeAgent({ visualStatus: 'working' })}
        />,
      );
      const badge = screen.getByText('Working');
      expect(badge).toHaveStyle({ color: '#60a5fa' });
      expect(badge).toHaveStyle({ backgroundColor: 'rgba(59,130,246,0.15)' });
    });

    it('shows green-tinted badge for done status', () => {
      render(
        <AgentPopup
          {...defaultProps}
          agent={makeAgent({ visualStatus: 'done' })}
        />,
      );
      const badge = screen.getByText('Done');
      expect(badge).toHaveStyle({ color: '#22c55e' });
      expect(badge).toHaveStyle({ backgroundColor: 'rgba(34,197,94,0.15)' });
    });

    it('shows red-tinted badge for error status', () => {
      render(
        <AgentPopup
          {...defaultProps}
          agent={makeAgent({ visualStatus: 'error' })}
        />,
      );
      const badge = screen.getByText('Error');
      expect(badge).toHaveStyle({ color: '#ef4444' });
      expect(badge).toHaveStyle({ backgroundColor: 'rgba(239,68,68,0.15)' });
    });

    it('shows gray-tinted badge for idle status', () => {
      render(
        <AgentPopup
          {...defaultProps}
          agent={makeAgent({ visualStatus: 'idle' })}
        />,
      );
      // "Idle" appears in both the status badge and the current task section
      const idleElements = screen.getAllByText('Idle');
      const badge = idleElements.find(el => el.classList.contains('font-medium'))!;
      expect(badge).toHaveStyle({ color: '#6b7280' });
      expect(badge).toHaveStyle({ backgroundColor: 'rgba(107,114,128,0.15)' });
    });
  });

  it('cleans up mousedown listener on unmount', () => {
    const onClose = vi.fn();
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<AgentPopup {...defaultProps} onClose={onClose} />);

    // Advance past the 50ms delay so the listener is registered
    act(() => {
      vi.advanceTimersByTime(60);
    });

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousedown',
      expect.any(Function),
    );
    removeEventListenerSpy.mockRestore();
  });

  it('renders close button with X character', () => {
    render(<AgentPopup {...defaultProps} />);
    const closeButton = screen.getByLabelText('Close popup');
    expect(closeButton).toBeInTheDocument();
    // The close button contains the Unicode multiplication sign (U+2715)
    expect(closeButton.textContent).toBe('\u2715');
  });

  it('renders agent color dot in header', () => {
    const { container } = render(
      <AgentPopup
        {...defaultProps}
        agent={makeAgent({ color: '#f97316' })}
      />,
    );
    const colorDot = container.querySelector('span.rounded-full');
    expect(colorDot).toHaveStyle({ backgroundColor: '#f97316' });
  });
});
