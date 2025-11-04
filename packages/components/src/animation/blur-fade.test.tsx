import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BlurFade } from './blur-fade';

// Note: framer-motion is globally mocked in vitest.setup.unit.ts

describe('BlurFade', () => {
  it('should render children', () => {
    render(<BlurFade>Test Content</BlurFade>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<BlurFade className="custom-class">Content</BlurFade>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should accept animation props', () => {
    const { container } = render(
      <BlurFade duration={0.5} delay={0.2}>
        Content
      </BlurFade>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept direction prop', () => {
    const { container } = render(
      <BlurFade direction="up">Content</BlurFade>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept all direction values', () => {
    const directions: Array<'up' | 'down' | 'left' | 'right'> = [
      'up',
      'down',
      'left',
      'right',
    ];

    directions.forEach((direction) => {
      const { container } = render(
        <BlurFade direction={direction}>Content {direction}</BlurFade>
      );
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  it('should accept offset prop', () => {
    const { container } = render(<BlurFade offset={12}>Content</BlurFade>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept blur prop', () => {
    const { container } = render(<BlurFade blur="10px">Content</BlurFade>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept inView prop', () => {
    const { container } = render(<BlurFade inView={true}>Content</BlurFade>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept inViewMargin prop', () => {
    const { container } = render(
      <BlurFade inViewMargin="-100px">Content</BlurFade>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept custom variant prop', () => {
    const customVariant = {
      hidden: { y: 20 },
      visible: { y: 0 },
    };
    const { container } = render(
      <BlurFade variant={customVariant}>Content</BlurFade>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should accept additional motion props', () => {
    const { container } = render(
      <BlurFade data-testid="blur-fade" style={{ padding: '10px' }}>
        Content
      </BlurFade>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render with default props', () => {
    const { container } = render(<BlurFade>Default Content</BlurFade>);
    expect(screen.getByText('Default Content')).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    render(
      <BlurFade>
        <div>Child 1</div>
        <div>Child 2</div>
      </BlurFade>
    );
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });
});
