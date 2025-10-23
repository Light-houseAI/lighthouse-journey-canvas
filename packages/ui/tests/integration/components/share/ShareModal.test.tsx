import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShareModal } from '@/components/share/ShareModal';
import { useShareStore } from '@/stores/share-store';
import { createMockShareStore } from '@/test-utils/share-store-mock';

// Mock the share store
vi.mock('@/stores/share-store', () => ({
  useShareStore: vi.fn(),
}));

// Mock the toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('ShareModal Integration Tests', () => {
  const mockCloseModal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    const mockStore = createMockShareStore({
      isModalOpen: true,
      closeModal: mockCloseModal,
      currentPermissions: {
        users: [],
        organizations: [],
        public: null,
      },
      isLoadingPermissions: false,
      userNodes: [],
      config: {
        selectedNodes: [],
        shareAllNodes: false,
        targets: [],
      },
    });
    (useShareStore as any).mockReturnValue(mockStore);
  });

  it('should hide footer buttons when permission view is opened from Networks tab', async () => {
    const user = userEvent.setup();

    render(<ShareModal />);

    // Check that footer buttons are initially visible
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Copy share link/i })
    ).toBeInTheDocument();

    // Click on a network access button
    const syracuseAccessButton = screen.getByTestId(
      'network-access-button-Syracuse University'
    );
    await user.click(syracuseAccessButton);

    // Footer buttons should be hidden
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Close' })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /Copy share link/i })
      ).not.toBeInTheDocument();
    });

    // Permission view should be visible
    expect(screen.getByText(/Journey scope/i)).toBeInTheDocument();
  });

  it('should show footer buttons again when going back from permission view', async () => {
    const user = userEvent.setup();

    render(<ShareModal />);

    // Click on a network access button
    const syracuseAccessButton = screen.getByTestId(
      'network-access-button-Syracuse University'
    );
    await user.click(syracuseAccessButton);

    // Footer should be hidden
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Close' })
      ).not.toBeInTheDocument();
    });

    // Click back button
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Footer buttons should be visible again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /Copy share link/i })
      ).toBeInTheDocument();
    });
  });

  it('should switch between Networks and People tabs correctly', async () => {
    const user = userEvent.setup();

    render(<ShareModal />);

    // Initially Networks tab should be active
    expect(screen.getByText('Syracuse University')).toBeInTheDocument();

    // Click People tab
    const peopleTab = screen.getByRole('button', { name: /People/i });
    await user.click(peopleTab);

    // Should show people search component
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search for people/i)
      ).toBeInTheDocument();
    });

    // Click back to Networks tab
    const networksTab = screen.getByRole('button', { name: /Networks/i });
    await user.click(networksTab);

    // Should show networks again
    await waitFor(() => {
      expect(screen.getByText('Syracuse University')).toBeInTheDocument();
    });
  });
});
