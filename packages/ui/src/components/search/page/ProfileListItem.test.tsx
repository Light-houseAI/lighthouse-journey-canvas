/**
 * @vitest-environment jsdom
 * ProfileListItem Component Tests
 *
 * Tests simplified profile card component following SearchPeopleComponent patterns
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ProfileListItem } from './ProfileListItem';

const mockProfile = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  currentRole: 'Software Engineer',
  company: 'Google',
  whyMatched: ['React Developer', 'Full Stack Engineer'],
  matchedNodes: [],
};

describe('ProfileListItem', () => {
  it('should render profile name and role', () => {
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer at Google')).toBeInTheDocument();
  });

  it('should highlight when selected', () => {
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={true}
        onClick={mockOnClick}
      />
    );

    const container = screen.getByRole('button');
    expect(container).toHaveClass('bg-blue-50', 'border-blue-200');
  });

  it('should not highlight when not selected', () => {
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    const container = screen.getByRole('button');
    expect(container).not.toHaveClass('bg-blue-50', 'border-blue-200');
    expect(container).toHaveClass('hover:bg-gray-50');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('should render avatar or initials', () => {
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    // Should show initials when no avatar
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('should handle profile without company', () => {
    const profileWithoutCompany = {
      ...mockProfile,
      company: undefined,
    };
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={profileWithoutCompany}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
  });

  it('should handle profile without role', () => {
    const profileWithoutRole = {
      ...mockProfile,
      currentRole: undefined,
    };
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={profileWithoutRole}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    // Should only show company when no role
    expect(screen.getByText('Google')).toBeInTheDocument();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    const mockOnClick = vi.fn();

    render(
      <ProfileListItem
        profile={mockProfile}
        isSelected={false}
        onClick={mockOnClick}
      />
    );

    const button = screen.getByRole('button');

    // Should be focusable
    button.focus();
    expect(button).toHaveFocus();

    // Should trigger onClick with Enter key
    await user.keyboard('{Enter}');
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});