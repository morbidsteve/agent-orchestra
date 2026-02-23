import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input.tsx';

describe('Input', () => {
  it('renders an input element', () => {
    render(<Input id="test" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input id="test" label="Name" />);
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('associates label with input via id', () => {
    render(<Input id="test" label="Name" />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('handles user input', async () => {
    const onChange = vi.fn();
    render(<Input id="test" onChange={onChange} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows placeholder text', () => {
    render(<Input id="test" placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });
});
