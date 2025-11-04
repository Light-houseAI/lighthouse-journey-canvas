/**
 * ApplicationMaterialsStep Component Tests
 *
 * Tests the application materials wizard step that manages resumes and LinkedIn profile.
 */

import { LINKEDIN_TYPE } from '@journey/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as applicationMaterialsHooks from '../../../../../hooks/use-application-materials';
import { ApplicationMaterialsStep } from './ApplicationMaterialsStep';

// Mock the hooks
vi.mock('../../../../../hooks/use-application-materials');

// Mock child components to keep tests focused
vi.mock('./ResumesTab', () => ({
  ResumesTab: ({ resumeItems }: any) => (
    <div data-testid="resumes-tab">
      Resumes Tab - {resumeItems.length} resumes
    </div>
  ),
}));

vi.mock('./LinkedInTab', () => ({
  LinkedInTab: ({ linkedInEntry }: any) => (
    <div data-testid="linkedin-tab">
      LinkedIn Tab - {linkedInEntry ? 'Has profile' : 'No profile'}
    </div>
  ),
}));

describe('ApplicationMaterialsStep', () => {
  const mockUseApplicationMaterials = vi.mocked(
    applicationMaterialsHooks.useApplicationMaterials
  );
  const mockUseCareerTransitionNode = vi.mocked(
    applicationMaterialsHooks.useCareerTransitionNode
  );

  const defaultProps = {
    nodeId: 'test-node-id',
    onNext: vi.fn(),
    onBack: vi.fn(),
    onCancel: vi.fn(),
    currentStep: 1,
    totalSteps: 3,
  };

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockUseApplicationMaterials.mockReturnValue({
      data: {
        items: [
          { id: '1', type: 'General', url: 'https://example.com/resume1.pdf' },
          {
            id: '2',
            type: 'Technical',
            url: 'https://example.com/resume2.pdf',
          },
          { id: '3', type: LINKEDIN_TYPE, url: 'https://linkedin.com/in/user' },
        ],
      },
      isLoading: false,
    } as any);

    mockUseCareerTransitionNode.mockReturnValue({
      data: { id: 'test-node-id' },
      isLoading: false,
    } as any);
  });

  describe('Rendering', () => {
    it('renders loading state when data is loading', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Loading materials...')).toBeInTheDocument();
    });

    it('renders step indicator with correct step number', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText(/Step 2: Application materials/i)
      ).toBeInTheDocument();
    });

    it('renders header with title', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Add update')).toBeInTheDocument();
    });

    it('renders main heading', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByText('Update your application materials')
      ).toBeInTheDocument();
    });

    it('renders cancel button', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Cancel update')).toBeInTheDocument();
    });

    it('renders back button when onBack is provided', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('does not render back button when onBack is not provided', () => {
      const propsWithoutBack = { ...defaultProps, onBack: undefined };
      render(<ApplicationMaterialsStep {...propsWithoutBack} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.queryByRole('button', { name: /back/i })
      ).not.toBeInTheDocument();
    });

    it('renders continue button', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(
        screen.getByRole('button', { name: /continue/i })
      ).toBeInTheDocument();
    });
  });

  describe('Tab Rendering', () => {
    it('renders resume count in tab label', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Resumes \(2\)/)).toBeInTheDocument();
    });

    it('renders LinkedIn tab label', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('LinkedIn Profile')).toBeInTheDocument();
    });

    it('shows ResumesTab by default', () => {
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByTestId('resumes-tab')).toBeInTheDocument();
      expect(screen.getByText(/Resumes Tab - 2 resumes/)).toBeInTheDocument();
    });

    it('shows correct resume count when no resumes', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: {
          items: [
            {
              id: '3',
              type: LINKEDIN_TYPE,
              url: 'https://linkedin.com/in/user',
            },
          ],
        },
        isLoading: false,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Resumes \(0\)/)).toBeInTheDocument();
    });
  });

  describe('Tab Switching', () => {
    it('switches to LinkedIn tab when clicked', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Initially shows resumes tab
      expect(screen.getByTestId('resumes-tab')).toBeInTheDocument();

      // Click LinkedIn tab
      const linkedInTabButton = screen.getByText('LinkedIn Profile');
      await user.click(linkedInTabButton);

      // Should show LinkedIn tab
      await waitFor(() => {
        expect(screen.getByTestId('linkedin-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('resumes-tab')).not.toBeInTheDocument();
      });
    });

    it('switches back to resume tab when clicked', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      // Click LinkedIn tab
      const linkedInTabButton = screen.getByText('LinkedIn Profile');
      await user.click(linkedInTabButton);

      await waitFor(() => {
        expect(screen.getByTestId('linkedin-tab')).toBeInTheDocument();
      });

      // Click Resume tab
      const resumeTabButton = screen.getByText(/Resumes \(2\)/);
      await user.click(resumeTabButton);

      // Should show resumes tab again
      await waitFor(() => {
        expect(screen.getByTestId('resumes-tab')).toBeInTheDocument();
        expect(screen.queryByTestId('linkedin-tab')).not.toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('calls onBack when Back button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const cancelButton = screen.getByText('Cancel update');
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onNext with correct data when Continue button is clicked', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(defaultProps.onNext).toHaveBeenCalledWith({
          applicationMaterialsData: {
            resumeCount: 2,
            hasLinkedInProfile: true,
          },
        });
      });
    });
  });

  describe('Data Handling', () => {
    it('counts resumes correctly excluding LinkedIn', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: {
          items: [
            {
              id: '1',
              type: 'General',
              url: 'https://example.com/resume1.pdf',
            },
            {
              id: '2',
              type: 'Technical',
              url: 'https://example.com/resume2.pdf',
            },
            {
              id: '3',
              type: 'Healthcare',
              url: 'https://example.com/resume3.pdf',
            },
            {
              id: '4',
              type: LINKEDIN_TYPE,
              url: 'https://linkedin.com/in/user',
            },
          ],
        },
        isLoading: false,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Resumes \(3\)/)).toBeInTheDocument();
    });

    it('detects LinkedIn profile existence', async () => {
      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(defaultProps.onNext).toHaveBeenCalledWith({
          applicationMaterialsData: {
            resumeCount: 2,
            hasLinkedInProfile: true,
          },
        });
      });
    });

    it('detects when LinkedIn profile does not exist', async () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: {
          items: [
            {
              id: '1',
              type: 'General',
              url: 'https://example.com/resume1.pdf',
            },
          ],
        },
        isLoading: false,
      } as any);

      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(defaultProps.onNext).toHaveBeenCalledWith({
          applicationMaterialsData: {
            resumeCount: 1,
            hasLinkedInProfile: false,
          },
        });
      });
    });

    it('handles empty materials data', async () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: {
          items: [],
        },
        isLoading: false,
      } as any);

      const user = userEvent.setup();
      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      await waitFor(() => {
        expect(defaultProps.onNext).toHaveBeenCalledWith({
          applicationMaterialsData: {
            resumeCount: 0,
            hasLinkedInProfile: false,
          },
        });
      });
    });

    it('handles undefined materials data', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: undefined,
        isLoading: false,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Resumes \(0\)/)).toBeInTheDocument();
    });

    it('handles undefined items array', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: {},
        isLoading: false,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText(/Resumes \(0\)/)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('shows loading when materials are loading', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Loading materials...')).toBeInTheDocument();
      expect(screen.queryByTestId('resumes-tab')).not.toBeInTheDocument();
    });

    it('shows loading when node is loading', () => {
      mockUseCareerTransitionNode.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Loading materials...')).toBeInTheDocument();
    });

    it('shows loading when both are loading', () => {
      mockUseApplicationMaterials.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);
      mockUseCareerTransitionNode.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as any);

      render(<ApplicationMaterialsStep {...defaultProps} />, {
        wrapper: createWrapper(),
      });

      expect(screen.getByText('Loading materials...')).toBeInTheDocument();
    });
  });

  describe('Step Indicators', () => {
    it('shows correct step text when currentStep > 0', () => {
      render(<ApplicationMaterialsStep {...defaultProps} currentStep={1} />, {
        wrapper: createWrapper(),
      });

      // Step 2 because currentStep is 1 (0-indexed), displayed as step 2
      expect(
        screen.getByText(/Step 2: Application materials/i)
      ).toBeInTheDocument();
    });

    it('shows correct step text when currentStep is 0', () => {
      render(
        <ApplicationMaterialsStep
          {...defaultProps}
          currentStep={0}
          totalSteps={3}
        />,
        {
          wrapper: createWrapper(),
        }
      );

      expect(
        screen.getByText(/Step 1: Application materials/i)
      ).toBeInTheDocument();
    });

    it('shows correct step text when on last step', () => {
      render(
        <ApplicationMaterialsStep
          {...defaultProps}
          currentStep={2}
          totalSteps={3}
        />,
        {
          wrapper: createWrapper(),
        }
      );

      expect(
        screen.getByText(/Step 3: Application materials/i)
      ).toBeInTheDocument();
    });
  });
});
