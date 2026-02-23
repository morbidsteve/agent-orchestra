import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from './Select.tsx';

describe('Select', () => {
  it('renders a select element', () => {
    render(
      <Select id="test">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(
      <Select id="test" label="Choose">
        <option value="a">A</option>
      </Select>
    );
    expect(screen.getByText('Choose')).toBeInTheDocument();
  });

  it('renders options', () => {
    render(
      <Select id="test">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
    );
    expect(screen.getByRole('option', { name: 'Option A' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Option B' })).toBeInTheDocument();
  });
});
