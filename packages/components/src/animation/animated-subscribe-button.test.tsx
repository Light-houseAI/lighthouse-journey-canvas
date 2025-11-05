import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnimatedSubscribeButton } from './animated-subscribe-button';

// Note: framer-motion is globally mocked in vitest.setup.unit.ts

describe('AnimatedSubscribeButton', () => {
  it('should throw error if not exactly two span children', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <AnimatedSubscribeButton>
          <span>Only one</span>
        </AnimatedSubscribeButton>
      );
    }).toThrow('AnimatedSubscribeButton expects two children');

    consoleError.mockRestore();
  });

  it('should throw error if children are not span elements', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <AnimatedSubscribeButton>
          <div>Not a span</div>
          <span>Valid span</span>
        </AnimatedSubscribeButton>
      );
    }).toThrow('AnimatedSubscribeButton expects two children');

    consoleError.mockRestore();
  });

  it('should render with unsubscribed state by default', () => {
    render(
      <AnimatedSubscribeButton>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );
    expect(screen.getByText('Subscribe')).toBeInTheDocument();
    expect(screen.queryByText('Subscribed')).not.toBeInTheDocument();
  });

  it('should toggle to subscribed state on click (uncontrolled)', () => {
    render(
      <AnimatedSubscribeButton>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.queryByText('Subscribe')).not.toBeInTheDocument();
  });

  it('should toggle back to unsubscribed state on second click (uncontrolled)', () => {
    const { rerender } = render(
      <AnimatedSubscribeButton>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    // First click - subscribe
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
    expect(screen.queryByText('Subscribe')).not.toBeInTheDocument();

    // Get the button again after state change
    const button = screen.getByRole('button');

    // Second click - unsubscribe
    fireEvent.click(button);

    // Wait for AnimatePresence to complete the transition
    expect(screen.getByText('Subscribe')).toBeInTheDocument();
    expect(screen.queryByText('Subscribed')).not.toBeInTheDocument();
  });

  it('should respect controlled subscribeStatus prop', () => {
    const { rerender } = render(
      <AnimatedSubscribeButton subscribeStatus={false}>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    expect(screen.getByText('Subscribe')).toBeInTheDocument();

    // Change to subscribed
    rerender(
      <AnimatedSubscribeButton subscribeStatus={true}>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    expect(screen.getByText('Subscribed')).toBeInTheDocument();
  });

  it('should call onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <AnimatedSubscribeButton onClick={handleClick}>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not change state in controlled mode on click', () => {
    const handleClick = vi.fn();
    render(
      <AnimatedSubscribeButton subscribeStatus={false} onClick={handleClick}>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should still show Subscribe (controlled)
    expect(screen.getByText('Subscribe')).toBeInTheDocument();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className', () => {
    render(
      <AnimatedSubscribeButton className="custom-class">
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('should accept additional button props', () => {
    render(
      <AnimatedSubscribeButton data-testid="subscribe-btn" disabled>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );
    const button = screen.getByTestId('subscribe-btn');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('should render initially subscribed when subscribeStatus is true', () => {
    render(
      <AnimatedSubscribeButton subscribeStatus={true}>
        <span>Subscribe</span>
        <span>Subscribed</span>
      </AnimatedSubscribeButton>
    );
    expect(screen.getByText('Subscribed')).toBeInTheDocument();
  });
});
