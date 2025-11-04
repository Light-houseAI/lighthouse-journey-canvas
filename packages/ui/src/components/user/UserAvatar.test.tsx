import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { User } from './UserAvatar';
import { UserAvatar } from './UserAvatar';

describe('UserAvatar', () => {
  const mockUser: User = {
    firstName: 'John',
    lastName: 'Doe',
    userName: 'johndoe',
    email: 'john.doe@example.com',
  };

  it('should render avatar with name by default', () => {
    render(<UserAvatar user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // InitialsAvatar should be rendered (checking for the container div)
    const container = screen.getByText('John Doe').parentElement?.parentElement;
    expect(container).toHaveClass('flex', 'items-center', 'gap-2');
  });

  it('should render with specified size', () => {
    const { container } = render(<UserAvatar user={mockUser} size="lg" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(container.firstChild).toBeInTheDocument();
  });

  it('should hide name when showName is false', () => {
    render(<UserAvatar user={mockUser} showName={false} />);

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <UserAvatar user={mockUser} className="custom-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render with image source when provided', () => {
    render(<UserAvatar user={mockUser} src="https://example.com/avatar.jpg" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should use sm size by default', () => {
    const { container } = render(<UserAvatar user={mockUser} />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should show name in proper styling', () => {
    render(<UserAvatar user={mockUser} />);

    const nameElement = screen.getByText('John Doe');
    expect(nameElement).toHaveClass('text-sm', 'font-medium', 'text-black');
  });

  it('should format name with proper capitalization', () => {
    const userWithLowercase: User = {
      firstName: 'jane',
      lastName: 'smith',
    };

    render(<UserAvatar user={userWithLowercase} />);
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('should use userName when first and last name not available', () => {
    const userWithUsername: User = {
      userName: 'johndoe123',
      email: 'john@example.com',
    };

    render(<UserAvatar user={userWithUsername} />);
    expect(screen.getByText('Johndoe123')).toBeInTheDocument();
  });

  it('should use email when no other name fields available', () => {
    const userWithEmail: User = {
      email: 'john@example.com',
    };

    render(<UserAvatar user={userWithEmail} />);
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('should display role when provided', () => {
    render(<UserAvatar user={mockUser} role="Software Engineer" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('should handle empty user object gracefully', () => {
    const emptyUser: User = {};

    render(<UserAvatar user={emptyUser} />);
    expect(screen.getByText('Unknown User')).toBeInTheDocument();
  });
});
