import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { InteractiveHoverButton } from './interactive-hover-button';

describe('InteractiveHoverButton', () => {
  it('should render children', () => {
    render(<InteractiveHoverButton>Test Content</InteractiveHoverButton>);
    expect(screen.getAllByText('Test Content')).toHaveLength(2); // Rendered twice for hover effect
  });

  it('should apply custom className', () => {
    render(
      <InteractiveHoverButton className="custom-class">
        Content
      </InteractiveHoverButton>
    );
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('should render as a button element', () => {
    render(<InteractiveHoverButton>Click me</InteractiveHoverButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should accept button props like onClick', () => {
    const handleClick = vi.fn();
    render(
      <InteractiveHoverButton onClick={handleClick}>
        Click me
      </InteractiveHoverButton>
    );

    const button = screen.getByRole('button');
    button.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should accept disabled prop', () => {
    render(<InteractiveHoverButton disabled>Disabled</InteractiveHoverButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should accept type prop', () => {
    render(
      <InteractiveHoverButton type="submit">Submit</InteractiveHoverButton>
    );
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should accept data attributes', () => {
    render(
      <InteractiveHoverButton data-testid="hover-button">
        Test
      </InteractiveHoverButton>
    );
    expect(screen.getByTestId('hover-button')).toBeInTheDocument();
  });

  it('should render arrow icon', () => {
    const { container } = render(
      <InteractiveHoverButton>Hover me</InteractiveHoverButton>
    );
    // ArrowRight icon is rendered
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should have correct default styles', () => {
    render(<InteractiveHoverButton>Button</InteractiveHoverButton>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('group');
    expect(button).toHaveClass('relative');
    expect(button).toHaveClass('cursor-pointer');
  });

  it('should render children twice for animation effect', () => {
    render(<InteractiveHoverButton>Animate</InteractiveHoverButton>);
    const textElements = screen.getAllByText('Animate');
    expect(textElements).toHaveLength(2); // One visible, one for hover state
  });
});
