/**
 * InsightCard Unit Tests
 *
 * Functional tests for insight display and interaction
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InsightCard } from './InsightCard';
import { NodeInsight } from '@journey/schema';

// Mock dependencies
vi.mock('../../../hooks/useNodeInsights', () => ({
  useDeleteInsight: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('InsightCard', () => {
  const mockInsight: NodeInsight = {
    id: 1,
    nodeId: 'job-1',
    description: 'This is a short insight',
    resources: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should render insight description', () => {
    render(<InsightCard insight={mockInsight} nodeId="job-1" />);

    expect(screen.getByText('This is a short insight')).toBeInTheDocument();
    expect(screen.getByText('Key Lessons from This Experience')).toBeInTheDocument();
  });

  it('should truncate long descriptions', () => {
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    render(<InsightCard insight={longInsight} nodeId="job-1" />);

    const text = screen.getByText(/A{120}\.\.\./);
    expect(text).toBeInTheDocument();
  });

  it('should show "Show more" button for long descriptions', () => {
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    render(<InsightCard insight={longInsight} nodeId="job-1" />);

    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('should expand description when "Show more" is clicked', async () => {
    const user = userEvent.setup();
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    render(<InsightCard insight={longInsight} nodeId="job-1" />);

    const showMoreButton = screen.getByText('Show more');
    await user.click(showMoreButton);

    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('should display resources when expanded', async () => {
    const user = userEvent.setup();
    const insightWithResources: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
      resources: ['https://example.com', 'Book: Learning TypeScript'],
    };

    render(<InsightCard insight={insightWithResources} nodeId="job-1" />);

    await user.click(screen.getByText('Show more'));

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Book: Learning TypeScript')).toBeInTheDocument();
  });

  it('should render URL resources as links', async () => {
    const user = userEvent.setup();
    const insightWithUrl: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
      resources: ['https://example.com'],
    };

    render(<InsightCard insight={insightWithUrl} nodeId="job-1" />);

    await user.click(screen.getByText('Show more'));

    const link = screen.getByRole('link', { name: /example\.com/ });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should not show edit menu when canEdit is false', () => {
    render(<InsightCard insight={mockInsight} nodeId="job-1" canEdit={false} />);

    expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument();
  });

  it('should show edit menu when canEdit is true', () => {
    const { container } = render(
      <InsightCard insight={mockInsight} nodeId="job-1" canEdit={true} />
    );

    // MoreHorizontal icon button should be present
    const dropdownTrigger = container.querySelector('button[class*="h-8 w-8"]');
    expect(dropdownTrigger).toBeInTheDocument();
  });
});
