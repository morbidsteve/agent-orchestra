import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextArea } from './TextArea.tsx';

describe('TextArea', () => {
  it('renders a textarea element', () => {
    render(<TextArea id="test" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<TextArea id="test" label="Description" />);
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('associates label with textarea via id', () => {
    render(<TextArea id="test" label="Description" />);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('handles user input', async () => {
    const onChange = vi.fn();
    render(<TextArea id="test" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'text');
    expect(onChange).toHaveBeenCalled();
  });
});
