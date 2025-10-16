/**
 * InsightCard Unit Tests
 *
 * Functional tests for insight display and interaction
 */

import { screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { InsightCard } from './InsightCard';
import { NodeInsight } from '@journey/schema';
import { renderWithProviders, http, HttpResponse } from '../../../test/renderWithProviders';

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
    renderWithProviders(<InsightCard insight={mockInsight} nodeId="job-1" />, {
      handlers: [
        http.delete('/api/v2/timeline/insights/:insightId', () => {
          return HttpResponse.json({ success: true });
        }),
      ],
    });

    expect(screen.getByText('This is a short insight')).toBeInTheDocument();
    expect(screen.getByText('Key Lessons from This Experience')).toBeInTheDocument();
  });

  it('should truncate long descriptions', () => {
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    renderWithProviders(<InsightCard insight={longInsight} nodeId="job-1" />);

    const text = screen.getByText(/A{120}\.\.\./);
    expect(text).toBeInTheDocument();
  });

  it('should show "Show more" button for long descriptions', () => {
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    renderWithProviders(<InsightCard insight={longInsight} nodeId="job-1" />);

    expect(screen.getByText('Show more')).toBeInTheDocument();
  });

  it('should expand description when "Show more" is clicked', async () => {
    const longInsight: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
    };

    const { user } = renderWithProviders(<InsightCard insight={longInsight} nodeId="job-1" />);

    const showMoreButton = screen.getByText('Show more');
    await user.click(showMoreButton);

    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('should display resources when expanded', async () => {
    const insightWithResources: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
      resources: ['https://example.com', 'Book: Learning TypeScript'],
    };

    const { user } = renderWithProviders(<InsightCard insight={insightWithResources} nodeId="job-1" />);

    await user.click(screen.getByText('Show more'));

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Book: Learning TypeScript')).toBeInTheDocument();
  });

  it('should render URL resources as links', async () => {
    const insightWithUrl: NodeInsight = {
      ...mockInsight,
      description: 'A'.repeat(150),
      resources: ['https://example.com'],
    };

    const { user } = renderWithProviders(<InsightCard insight={insightWithUrl} nodeId="job-1" />);

    await user.click(screen.getByText('Show more'));

    const link = screen.getByRole('link', { name: /example\.com/ });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('should not show edit menu when canEdit is false', () => {
    renderWithProviders(<InsightCard insight={mockInsight} nodeId="job-1" canEdit={false} />);

    expect(screen.queryByRole('button', { name: /more options/i })).not.toBeInTheDocument();
  });

  it('should show edit menu when canEdit is true', () => {
    const { container } = renderWithProviders(
      <InsightCard insight={mockInsight} nodeId="job-1" canEdit={true} />
    );

    // MoreHorizontal icon button should be present
    const dropdownTrigger = container.querySelector('button[class*="h-8 w-8"]');
    expect(dropdownTrigger).toBeInTheDocument();
  });
});
