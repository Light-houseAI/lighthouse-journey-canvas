import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('should render children', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  it('should apply default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toHaveClass('bg-primary');
  });

  it('should apply secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(container.firstChild).toHaveClass('bg-secondary');
  });

  it('should apply destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>);
    expect(container.firstChild).toHaveClass('bg-destructive');
  });

  it('should apply outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    expect(container.firstChild).toHaveClass('text-foreground');
  });

  it('should merge custom className', () => {
    const { container } = render(<Badge className="custom-class">Badge</Badge>);
    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveClass('bg-primary');
  });
});
