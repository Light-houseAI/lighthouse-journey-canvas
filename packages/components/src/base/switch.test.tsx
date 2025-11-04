import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Switch } from './switch';

describe('Switch', () => {
  it('should render without crashing', () => {
    const { container } = render(<Switch />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Switch className="custom-switch" />);
    expect(container.firstChild).toHaveClass('custom-switch');
  });

  it('should accept checked prop', () => {
    const { container } = render(<Switch checked={true} />);
    expect(container.firstChild).toHaveAttribute('data-state', 'checked');
  });

  it('should accept disabled prop', () => {
    const { container } = render(<Switch disabled />);
    expect(container.firstChild).toBeDisabled();
  });
});
