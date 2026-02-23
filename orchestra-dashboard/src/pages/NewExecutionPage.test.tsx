import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from '../test/testUtils.tsx';
import { NewExecutionPage } from './NewExecutionPage.tsx';

describe('NewExecutionPage', () => {
  it('renders page title', () => {
    renderWithProviders(<NewExecutionPage />);
    expect(screen.getByText('New Execution')).toBeInTheDocument();
  });

  it('renders workflow selector', () => {
    renderWithProviders(<NewExecutionPage />);
    expect(screen.getByText('Full Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Security Audit')).toBeInTheDocument();
  });

  it('renders model picker', () => {
    renderWithProviders(<NewExecutionPage />);
    expect(screen.getByText('Claude Opus 4.6')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
    expect(screen.getByText('Claude Haiku 4.5')).toBeInTheDocument();
  });

  it('renders task description textarea', () => {
    renderWithProviders(<NewExecutionPage />);
    expect(screen.getByLabelText('Task Description')).toBeInTheDocument();
  });

  it('start button is disabled when task is empty', () => {
    renderWithProviders(<NewExecutionPage />);
    expect(screen.getByRole('button', { name: /Start Execution/ })).toBeDisabled();
  });

  it('start button is enabled when task has text', async () => {
    renderWithProviders(<NewExecutionPage />);
    await userEvent.type(screen.getByLabelText('Task Description'), 'Fix the login bug');
    expect(screen.getByRole('button', { name: /Start Execution/ })).toBeEnabled();
  });
});
