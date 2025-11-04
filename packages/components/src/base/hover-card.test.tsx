import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from './hover-card';

describe('HoverCard', () => {
  it('should render trigger without crashing', () => {
    render(
      <HoverCard>
        <HoverCardTrigger>Hover me</HoverCardTrigger>
        <HoverCardContent>Tooltip content</HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('should apply custom className to trigger', () => {
    render(
      <HoverCard>
        <HoverCardTrigger className="custom-trigger">
          Hover
        </HoverCardTrigger>
      </HoverCard>
    );
    expect(screen.getByText('Hover')).toHaveClass('custom-trigger');
  });

  it('should render content when open', () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Hover</HoverCardTrigger>
        <HoverCardContent>Detailed information</HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('Detailed information')).toBeInTheDocument();
  });

  it('should apply custom className to content', () => {
    render(
      <HoverCard open>
        <HoverCardTrigger>Hover</HoverCardTrigger>
        <HoverCardContent className="custom-content">
          Content
        </HoverCardContent>
      </HoverCard>
    );
    expect(screen.getByText('Content')).toHaveClass('custom-content');
  });
});
