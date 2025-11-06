/**
 * BrandBuildingStep Component Tests
 *
 * Tests for the brand building wizard step component including:
 * - Platform selection
 * - Multi-platform workflow
 * - Activity form validation
 * - Screenshot upload handling
 * - State management
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BrandBuildingStep } from './BrandBuildingStep';

// Mock file upload components
vi.mock('../../../../file-upload', () => ({
  FileDropZoneContainer: ({
    onUploadComplete,
  }: {
    onUploadComplete: (file: unknown) => void;
  }) => (
    <div
      data-testid="file-drop-zone"
      onClick={() =>
        onUploadComplete({
          storageKey: 'test-key',
          filename: 'test.png',
          mimeType: 'image/png',
          sizeBytes: 1024,
        })
      }
    >
      Drop Zone
    </div>
  ),
  QuotaDisplay: () => <div data-testid="quota-display">Quota Display</div>,
}));

describe('BrandBuildingStep', () => {
  const defaultProps = {
    data: {
      appliedToJobs: false,
      applicationMaterials: false,
      networking: false,
      brandBuilding: true,
    },
    onNext: vi.fn(),
    onCancel: vi.fn(),
    currentStep: 1,
    totalSteps: 2,
    nodeId: 'test-node-id',
  };

  describe('Platform Selection Screen', () => {
    it('should render platform selection screen initially', () => {
      render(<BrandBuildingStep {...defaultProps} />);

      expect(
        screen.getByText('Select platforms to add activities')
      ).toBeInTheDocument();
      expect(screen.getByText('Add new platform')).toBeInTheDocument();
    });

    it('should detect LinkedIn URL and enable Add button', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');

      expect(screen.getByText('LinkedIn detected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it('should detect X URL and enable Add button', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://x.com/johndoe');

      expect(screen.getByText('X detected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    });

    it('should detect Twitter URL as X platform', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://twitter.com/johndoe');

      expect(screen.getByText('X detected')).toBeInTheDocument();
    });

    it('should show error for invalid URL', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://invalid.com/profile');

      expect(
        screen.getByText('Please enter a valid LinkedIn or X (Twitter) URL')
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('should add platform when Add button clicked', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Platform should appear in "Your platforms" section
      await waitFor(() => {
        expect(screen.getByText('Your platforms')).toBeInTheDocument();
        expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      });
    });

    it('should enable Continue button when platform is selected', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Add a platform first
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      // Select the platform checkbox
      await waitFor(() => {
        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      expect(continueButton).toBeEnabled();
    });

    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      render(<BrandBuildingStep {...defaultProps} onBack={onBack} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe('Activity Entry Screen', () => {
    it('should navigate to activity entry screen after selecting platform', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Add and select a platform
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      const continueButton = screen.getByRole('button', { name: 'Continue' });
      await user.click(continueButton);

      // Should show activity entry screen
      await waitFor(() => {
        expect(
          screen.getByText('Share your LinkedIn activity')
        ).toBeInTheDocument();
      });
    });

    it('should show platform progress indicator', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Add and select two platforms
      let input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.clear(input);
      await user.type(input, 'https://x.com/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getAllByRole('checkbox')).toHaveLength(2);
      });

      // Select both platforms
      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Should show "Platform 1 of 2: LinkedIn"
      await waitFor(() => {
        expect(screen.getByText(/Platform 1 of 2:/)).toBeInTheDocument();
      });
    });

    it('should display QuotaDisplay component', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Navigate to activity entry screen
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      // Should show QuotaDisplay
      await waitFor(() => {
        expect(screen.getByTestId('quota-display')).toBeInTheDocument();
      });
    });

    it('should handle screenshot upload', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Navigate to activity entry screen
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
      });

      // Simulate file upload
      await user.click(screen.getByTestId('file-drop-zone'));

      // Should show uploaded file
      await waitFor(() => {
        expect(screen.getByText('test.png')).toBeInTheDocument();
      });
    });

    it('should disable Complete button when no screenshots uploaded', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Navigate to activity entry screen
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(screen.getByText(/Complete/)).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete/ });
      expect(completeButton).toBeDisabled();
    });

    it('should enable Complete button after uploading screenshot', async () => {
      const user = userEvent.setup();
      render(<BrandBuildingStep {...defaultProps} />);

      // Navigate to activity entry screen and upload file
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('file-drop-zone'));

      await waitFor(() => {
        const completeButton = screen.getByRole('button', { name: /Complete/ });
        expect(completeButton).toBeEnabled();
      });
    });

    it('should call onNext with grouped activities when Complete is clicked', async () => {
      const user = userEvent.setup();
      const onNext = vi.fn();
      render(<BrandBuildingStep {...defaultProps} onNext={onNext} />);

      // Navigate and complete activity
      const input = screen.getByPlaceholderText(
        'Paste your LinkedIn or X profile URL'
      );
      await user.type(input, 'https://linkedin.com/in/johndoe');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        expect(screen.getByRole('checkbox')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Continue' }));

      await waitFor(() => {
        expect(screen.getByTestId('file-drop-zone')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('file-drop-zone'));

      await waitFor(() => {
        const completeButton = screen.getByRole('button', { name: /Complete/ });
        expect(completeButton).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /Complete/ }));

      // Should call onNext with brandBuildingData
      await waitFor(() => {
        expect(onNext).toHaveBeenCalledWith(
          expect.objectContaining({
            brandBuildingData: expect.objectContaining({
              activities: expect.objectContaining({
                LinkedIn: expect.any(Array),
              }),
            }),
          })
        );
      });
    });
  });

  describe('Existing Data Loading', () => {
    it('should load existing platforms from brandBuildingData', () => {
      const dataWithExisting = {
        ...defaultProps.data,
        brandBuildingData: {
          activities: {
            LinkedIn: [
              {
                platform: 'LinkedIn' as const,
                profileUrl: 'https://linkedin.com/in/existing',
                screenshots: [],
                timestamp: new Date().toISOString(),
              },
            ],
            X: [],
          },
        },
      };

      render(<BrandBuildingStep {...defaultProps} data={dataWithExisting} />);

      // Should show existing LinkedIn platform
      expect(screen.getByText('Your platforms')).toBeInTheDocument();
      expect(screen.getByText('LinkedIn')).toBeInTheDocument();
      expect(
        screen.getByText('https://linkedin.com/in/existing')
      ).toBeInTheDocument();
    });
  });
});
