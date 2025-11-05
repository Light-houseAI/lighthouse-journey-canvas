import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MagicCard } from './magic-card';

describe('MagicCard', () => {
  it('should render children', () => {
    render(<MagicCard>Test Content</MagicCard>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <MagicCard className="custom-class">Content</MagicCard>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('should render as a div', () => {
    const { container } = render(<MagicCard>Content</MagicCard>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('should have default styling classes', () => {
    const { container } = render(<MagicCard>Content</MagicCard>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('relative');
    expect(card).toHaveClass('rounded-lg');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('bg-background');
  });

  it('should render without children', () => {
    const { container } = render(<MagicCard />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept gradient props without errors', () => {
    const { container } = render(
      <MagicCard
        gradientSize={200}
        gradientColor="#ff0000"
        gradientOpacity={0.5}
        gradientFrom="#000000"
        gradientTo="#ffffff"
      >
        Content
      </MagicCard>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render multiple children', () => {
    render(
      <MagicCard>
        <div>Child 1</div>
        <div>Child 2</div>
      </MagicCard>
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('should merge custom className with default classes', () => {
    const { container } = render(
      <MagicCard className="p-4 shadow-lg">Content</MagicCard>
    );
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('relative');
    expect(card).toHaveClass('p-4');
    expect(card).toHaveClass('shadow-lg');
  });
});
