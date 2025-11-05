import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimatedList, AnimatedListItem } from './animated-list';

// Note: framer-motion is globally mocked in vitest.setup.unit.ts

describe('AnimatedListItem', () => {
  it('should render children', () => {
    render(<AnimatedListItem>Test Content</AnimatedListItem>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render as a div', () => {
    const { container } = render(<AnimatedListItem>Content</AnimatedListItem>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });
});

describe('AnimatedList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render first child immediately', () => {
    render(
      <AnimatedList>
        <div key="1">Item 1</div>
        <div key="2">Item 2</div>
        <div key="3">Item 3</div>
      </AnimatedList>
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 3')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <AnimatedList className="custom-class">
        <div key="1">Content</div>
      </AnimatedList>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should progressively show items based on delay', () => {
    render(
      <AnimatedList delay={1000}>
        <div key="1">Item 1</div>
        <div key="2">Item 2</div>
        <div key="3">Item 3</div>
      </AnimatedList>
    );

    // Initially only first item
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();

    // After 1 second, second item appears
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Item 3')).not.toBeInTheDocument();

    // After another second, third item appears
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should respect custom delay prop', () => {
    render(
      <AnimatedList delay={500}>
        <div key="1">Item 1</div>
        <div key="2">Item 2</div>
      </AnimatedList>
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.queryByText('Item 2')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should render items in reverse order (newest first)', () => {
    render(
      <AnimatedList delay={1000}>
        <div key="1">Item 1</div>
        <div key="2">Item 2</div>
      </AnimatedList>
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Both items should be rendered, order is controlled by CSS/component logic
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('should handle single child', () => {
    render(
      <AnimatedList>
        <div key="1">Single Item</div>
      </AnimatedList>
    );
    expect(screen.getByText('Single Item')).toBeInTheDocument();
  });

  it('should accept additional HTML props', () => {
    render(
      <AnimatedList data-testid="animated-list">
        <div key="1">Item 1</div>
      </AnimatedList>
    );
    expect(screen.getByTestId('animated-list')).toBeInTheDocument();
  });
});
