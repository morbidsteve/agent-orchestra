import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionConfigBar } from './SessionConfigBar.tsx';
import { MODELS } from '../../../lib/constants.ts';

// Mock the API module — browseFilesystem is used by SetupMode
vi.mock('../../../lib/api.ts', () => ({
  browseFilesystem: vi.fn(),
}));

function defaultProps(overrides?: Record<string, unknown>) {
  return {
    model: 'sonnet',
    githubUrl: '',
    folderPath: '',
    hasConversation: false,
    onModelChange: vi.fn(),
    onGithubUrlChange: vi.fn(),
    onFolderPathChange: vi.fn(),
    ...overrides,
  };
}

// ─── Setup Mode Tests (hasConversation = false) ──────────────────────────────

describe('SessionConfigBar — Setup Mode', () => {
  it('renders all three model pill buttons', () => {
    render(<SessionConfigBar {...defaultProps()} />);
    for (const m of MODELS) {
      const label = m.name.replace('Claude ', '');
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('highlights the currently selected model pill', () => {
    render(<SessionConfigBar {...defaultProps({ model: 'opus' })} />);
    const opusBtn = screen.getByText('Opus 4.6');
    expect(opusBtn.className).toContain('bg-accent-blue');
    expect(opusBtn.className).toContain('text-white');

    // Other pills should NOT be highlighted
    const sonnetBtn = screen.getByText('Sonnet 4.5');
    expect(sonnetBtn.className).not.toContain('bg-accent-blue');
  });

  it('calls onModelChange when a different model pill is clicked', () => {
    const onModelChange = vi.fn();
    render(<SessionConfigBar {...defaultProps({ onModelChange })} />);
    fireEvent.click(screen.getByText('Opus 4.6'));
    expect(onModelChange).toHaveBeenCalledWith('opus');
  });

  it('shows "GitHub URL" and "Local Directory" tabs', () => {
    render(<SessionConfigBar {...defaultProps()} />);
    expect(screen.getByText('GitHub URL')).toBeInTheDocument();
    expect(screen.getByText('Local Directory')).toBeInTheDocument();
  });

  it('defaults to Local Directory tab when githubUrl is empty', () => {
    render(<SessionConfigBar {...defaultProps()} />);
    // When githubUrl is empty, sourceTab defaults to 'local'
    expect(screen.getByPlaceholderText('/path/to/project')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('defaults to GitHub URL tab when githubUrl is provided', () => {
    render(<SessionConfigBar {...defaultProps({ githubUrl: 'https://github.com/foo/bar' })} />);
    const input = screen.getByPlaceholderText('https://github.com/owner/repo');
    expect(input).toBeInTheDocument();
  });

  it('switching to Local Directory tab shows path input and Browse button', () => {
    // Start with githubUrl set so the default tab is GitHub
    render(<SessionConfigBar {...defaultProps({ githubUrl: 'https://github.com/foo/bar' })} />);
    // Switch to Local Directory
    fireEvent.click(screen.getByText('Local Directory'));
    expect(screen.getByPlaceholderText('/path/to/project')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
  });

  it('calls onGithubUrlChange when typing in GitHub URL input', () => {
    const onGithubUrlChange = vi.fn();
    render(<SessionConfigBar {...defaultProps({ onGithubUrlChange })} />);
    // Switch to GitHub URL tab first (default is Local when githubUrl is empty)
    fireEvent.click(screen.getByText('GitHub URL'));
    const input = screen.getByPlaceholderText('https://github.com/owner/repo');
    fireEvent.change(input, { target: { value: 'https://github.com/test/repo' } });
    expect(onGithubUrlChange).toHaveBeenCalledWith('https://github.com/test/repo');
  });

  it('calls onFolderPathChange when typing in folder path input', () => {
    const onFolderPathChange = vi.fn();
    render(<SessionConfigBar {...defaultProps({ onFolderPathChange })} />);
    fireEvent.click(screen.getByText('Local Directory'));
    const input = screen.getByPlaceholderText('/path/to/project');
    fireEvent.change(input, { target: { value: '/home/user/project' } });
    expect(onFolderPathChange).toHaveBeenCalledWith('/home/user/project');
  });

  it('shows hint text about configuration being optional', () => {
    render(<SessionConfigBar {...defaultProps()} />);
    expect(
      screen.getByText('Configuration is optional — defaults work for most tasks'),
    ).toBeInTheDocument();
  });
});

// ─── Compact Mode Tests (hasConversation = true) ─────────────────────────────

describe('SessionConfigBar — Compact Mode', () => {
  it('shows model badge with current model name', () => {
    render(<SessionConfigBar {...defaultProps({ hasConversation: true, model: 'opus' })} />);
    expect(screen.getByText('Opus 4.6')).toBeInTheDocument();
  });

  it('shows project source badge with parsed GitHub URL', () => {
    render(
      <SessionConfigBar
        {...defaultProps({
          hasConversation: true,
          githubUrl: 'https://github.com/acme/widgets',
        })}
      />,
    );
    expect(screen.getByText('acme/widgets')).toBeInTheDocument();
  });

  it('shows "No project" when no githubUrl or folderPath', () => {
    render(<SessionConfigBar {...defaultProps({ hasConversation: true })} />);
    expect(screen.getByText('No project')).toBeInTheDocument();
  });

  it('shows folder name when folderPath is set and no githubUrl', () => {
    render(
      <SessionConfigBar
        {...defaultProps({
          hasConversation: true,
          folderPath: '/home/user/myapp',
        })}
      />,
    );
    expect(screen.getByText('myapp')).toBeInTheDocument();
  });

  it('clicking model badge opens dropdown with model options', () => {
    render(<SessionConfigBar {...defaultProps({ hasConversation: true, model: 'sonnet' })} />);
    // Click the model badge button
    fireEvent.click(screen.getByText('Sonnet 4.5'));

    // All model options should now appear in the dropdown.
    // The dropdown renders model names AND descriptions. Check for descriptions
    // which are unique to the dropdown items.
    for (const m of MODELS) {
      expect(screen.getByText(m.description)).toBeInTheDocument();
    }
  });

  it('selecting a model from dropdown calls onModelChange', () => {
    const onModelChange = vi.fn();
    render(
      <SessionConfigBar
        {...defaultProps({ hasConversation: true, model: 'sonnet', onModelChange })}
      />,
    );
    // Open dropdown
    fireEvent.click(screen.getByText('Sonnet 4.5'));

    // Find the Opus option by its description (unique to dropdown)
    const opusDescription = screen.getByText('Most capable, best for complex tasks');
    // Click the parent button — the description is inside a button
    fireEvent.click(opusDescription.closest('button')!);

    expect(onModelChange).toHaveBeenCalledWith('opus');
  });

  it('does not show GitHub URL or Local Directory tabs', () => {
    render(<SessionConfigBar {...defaultProps({ hasConversation: true })} />);
    expect(screen.queryByText('GitHub URL')).not.toBeInTheDocument();
    expect(screen.queryByText('Local Directory')).not.toBeInTheDocument();
  });

  it('does not show hint text', () => {
    render(<SessionConfigBar {...defaultProps({ hasConversation: true })} />);
    expect(
      screen.queryByText('Configuration is optional — defaults work for most tasks'),
    ).not.toBeInTheDocument();
  });
});
