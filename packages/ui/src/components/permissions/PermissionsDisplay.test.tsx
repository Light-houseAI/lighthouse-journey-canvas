import { SubjectType } from '@journey/schema';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PermissionsDisplay } from './PermissionsDisplay';

describe('PermissionsDisplay', () => {
  it('should not render when no permissions are shared', () => {
    const { container } = render(<PermissionsDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when empty arrays are provided', () => {
    const { container } = render(<PermissionsDisplay permissions={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('should display public badge when public', () => {
    render(
      <PermissionsDisplay permissions={[{ subjectType: SubjectType.Public }]} />
    );

    expect(screen.getByText('Public')).toBeInTheDocument();
  });

  it('should display only networks when shared with networks', () => {
    render(
      <PermissionsDisplay
        permissions={[
          { subjectType: SubjectType.Organization, subjectId: 1 },
          { subjectType: SubjectType.Organization, subjectId: 2 },
        ]}
      />
    );

    expect(screen.getByText('Shared with 2 networks')).toBeInTheDocument();
  });

  it('should display singular network when shared with one network', () => {
    render(
      <PermissionsDisplay
        permissions={[{ subjectType: SubjectType.Organization, subjectId: 1 }]}
      />
    );

    expect(screen.getByText('Shared with 1 network')).toBeInTheDocument();
  });

  it('should display only individuals when shared with individuals', () => {
    render(
      <PermissionsDisplay
        permissions={[
          { subjectType: SubjectType.User, subjectId: 1 },
          { subjectType: SubjectType.User, subjectId: 2 },
          { subjectType: SubjectType.User, subjectId: 3 },
        ]}
      />
    );

    expect(screen.getByText('Shared with 3 individuals')).toBeInTheDocument();
  });

  it('should display singular individual when shared with one person', () => {
    render(
      <PermissionsDisplay
        permissions={[{ subjectType: SubjectType.User, subjectId: 1 }]}
      />
    );

    expect(screen.getByText('Shared with 1 individual')).toBeInTheDocument();
  });

  it('should display both networks and individuals when shared with both', () => {
    render(
      <PermissionsDisplay
        permissions={[
          { subjectType: SubjectType.Organization, subjectId: 1 },
          { subjectType: SubjectType.Organization, subjectId: 2 },
          { subjectType: SubjectType.User, subjectId: 1 },
        ]}
      />
    );

    expect(
      screen.getByText('Shared with 2 networks and 1 individual')
    ).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <PermissionsDisplay
        permissions={[{ subjectType: SubjectType.Organization, subjectId: 1 }]}
        className="custom-class"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render as badge component', () => {
    const { container } = render(
      <PermissionsDisplay
        permissions={[{ subjectType: SubjectType.Organization, subjectId: 1 }]}
      />
    );

    const badge = container.firstChild as HTMLElement;
    expect(badge.tagName).toBe('SPAN');
    expect(badge).toHaveClass('rounded-full', 'bg-blue-100');
  });
});
