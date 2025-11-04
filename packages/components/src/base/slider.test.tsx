import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Slider } from './slider';

describe('Slider', () => {
  it('should render without crashing', () => {
    const { container } = render(<Slider defaultValue={[50]} max={100} step={1} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Slider defaultValue={[50]} max={100} step={1} className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('should render with different default value', () => {
    const { container } = render(<Slider defaultValue={[75]} max={100} step={1} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
