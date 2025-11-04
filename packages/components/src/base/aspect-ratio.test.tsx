import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AspectRatio } from './aspect-ratio';

describe('AspectRatio', () => {
  it('should render without crashing', () => {
    const { container } = render(
      <AspectRatio ratio={16 / 9}>
        <div>Content</div>
      </AspectRatio>
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <AspectRatio ratio={16 / 9}>
        <div>Test Content</div>
      </AspectRatio>
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should accept ratio prop', () => {
    const { container } = render(
      <AspectRatio ratio={1}>
        <div>Square</div>
      </AspectRatio>
    );
    expect(container.firstChild).toBeInTheDocument();
  });
});
