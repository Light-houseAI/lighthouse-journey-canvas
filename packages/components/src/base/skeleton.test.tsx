import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('should render without crashing', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply base skeleton styles', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('animate-pulse');
    expect(container.firstChild).toHaveClass('rounded-md');
    expect(container.firstChild).toHaveClass('bg-muted');
  });

  it('should apply custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />);
    expect(container.firstChild).toHaveClass('custom-skeleton');
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('should accept style props', () => {
    const { container } = render(<Skeleton style={{ width: '100px', height: '20px' }} />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton.style.width).toBe('100px');
    expect(skeleton.style.height).toBe('20px');
  });
});
