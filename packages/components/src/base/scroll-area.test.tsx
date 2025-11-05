import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScrollArea, ScrollBar } from './scroll-area';

describe('ScrollArea', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <ScrollArea>
        <div>Scrollable content</div>
      </ScrollArea>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <ScrollArea className="custom-scroll">
        <div>Content</div>
      </ScrollArea>
    );
    expect(container.firstChild).toHaveClass('custom-scroll');
  });

  it('should render children', () => {
    render(
      <ScrollArea>
        <div>Scrollable content here</div>
      </ScrollArea>
    );
    expect(screen.getByText('Scrollable content here')).toBeInTheDocument();
  });

  it('should render scroll bar with orientation', () => {
    const { container } = render(
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
        <div>Content</div>
      </ScrollArea>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
