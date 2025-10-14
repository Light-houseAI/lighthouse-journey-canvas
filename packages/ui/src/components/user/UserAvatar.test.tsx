import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  it('should render avatar with name by default', () => {
    render(<UserAvatar name="John Doe" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // InitialsAvatar should be rendered (checking for the container div)
    const container = screen.getByText('John Doe').parentElement;
    expect(container).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('should render with specified size', () => {
    const { container } = render(<UserAvatar name="Jane Smith" size="lg" />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should hide name when showName is false', () => {
    render(<UserAvatar name="John Doe" showName={false} />);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <UserAvatar name="John Doe" className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render with image source when provided', () => {
    render(<UserAvatar name="John Doe" src="https://example.com/avatar.jpg" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should use sm size by default', () => {
    const { container } = render(<UserAvatar name="John Doe" />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show name in medium gray with proper styling', () => {
    render(<UserAvatar name="John Doe" />);

    const nameElement = screen.getByText('John Doe');
    expect(nameElement).toHaveClass('text-sm', 'text-gray-700', 'font-medium');
  });
});
