/**
 * UserMenu Unit Tests
 *
 * Functional tests for user menu dropdown and actions
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { UserMenu } from './user-menu';

// Mock dependencies
const mockMutateAsync = vi.fn();
const mockSetLocation = vi.fn();
const mockToast = vi.fn();

vi.mock('wouter', () => ({
  useLocation: () => ['/', mockSetLocation],
}));

vi.mock('../../hooks/useAuth', () => ({
  useCurrentUser: () => ({
    data: {
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      userName: 'testuser',
    },
  }),
  useLogout: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock('../../hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render user display name', () => {
      renderWithTheme(<UserMenu />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should render user initials in avatar', () => {
      renderWithTheme(<UserMenu />);

      expect(screen.getByText('TU')).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = renderWithTheme(
        <UserMenu className="custom-class" />
      );

      const button = container.querySelector('.custom-class');
      expect(button).toBeInTheDocument();
    });
  });

  describe('Menu Opening', () => {
    it('should open dropdown menu on click', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Menu Items', () => {
    it('should display settings menu item', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      expect(await screen.findByText('Settings')).toBeInTheDocument();
    });

    it('should display copy profile link when userName exists', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      expect(await screen.findByText('Copy Profile Link')).toBeInTheDocument();
    });

    it('should display logout menu item', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      expect(await screen.findByText('Logout')).toBeInTheDocument();
    });
  });

  describe('Menu Actions', () => {
    it('should navigate to settings when settings is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      const settingsItem = await screen.findByText('Settings');
      await user.click(settingsItem);

      expect(mockSetLocation).toHaveBeenCalledWith('/settings');
    });

    it('should call logout when logout is clicked', async () => {
      const user = userEvent.setup();
      renderWithTheme(<UserMenu />);

      const trigger = screen.getByText('Test User');
      await user.click(trigger);

      const logoutItem = await screen.findByText('Logout');
      await user.click(logoutItem);

      expect(mockMutateAsync).toHaveBeenCalledOnce();
    });
  });

  describe('Display Name Priority', () => {
    it('should use firstName + lastName when both available', () => {
      renderWithTheme(<UserMenu />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });
});
