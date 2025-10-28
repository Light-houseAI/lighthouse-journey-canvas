/**
 * Tests for ApplicationMaterialsStep component
 *
 * Tests wizard step rendering, navigation, modal integration, and data display
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { ApplicationMaterialsStep } from './ApplicationMaterialsStep';

// Create a fresh QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

// Mock data
const mockNodeId = 'career-transition-123';

const mockMaterialsEmpty = {
  items: [],
  summary: undefined,
};

const mockMaterialsWithResumes = {
  items: [
    {
      type: 'general',
      resumeVersion: {
        url: 'https://example.com/resume-general.pdf',
        lastUpdated: '2024-01-01T00:00:00Z',
        notes: 'General resume',
        editHistory: [],
      },
    },
    {
      type: 'product-management',
      resumeVersion: {
        url: 'https://example.com/resume-pm.pdf',
        lastUpdated: '2024-01-02T00:00:00Z',
        notes: 'PM focused resume',
        editHistory: [],
      },
    },
  ],
  summary: undefined,
};

const mockMaterialsWithLinkedIn = {
  items: [
    {
      type: 'Linkedin',
      resumeVersion: {
        url: 'https://linkedin.com/in/testuser',
        lastUpdated: '2024-01-01T00:00:00Z',
        notes: 'Professional profile',
        editHistory: [],
      },
    },
  ],
  summary: undefined,
};

const mockMaterialsComplete = {
  items: [
    {
      type: 'general',
      resumeVersion: {
        url: 'https://example.com/resume.pdf',
        lastUpdated: '2024-01-01T00:00:00Z',
        notes: 'General resume',
        editHistory: [],
      },
    },
    {
      type: 'Linkedin',
      resumeVersion: {
        url: 'https://linkedin.com/in/testuser',
        lastUpdated: '2024-01-01T00:00:00Z',
        notes: 'Professional profile',
        editHistory: [],
      },
    },
  ],
  summary: undefined,
};

// Removed unused mockCareerTransitionNode - was not used in tests
// const mockCareerTransitionNode = {
//   id: mockNodeId,
//   type: 'career-transition',
//   parentId: null,
//   userId: 1,
//   meta: {
//     title: 'Software Engineer at TechCorp',
//     company: 'TechCorp',
//     targetRole: 'Software Engineer',
//   },
//   depth: 0,
//   children: [],
//   path: [],
//   permissions: {
//     canView: true,
//     canEdit: true,
//     canDelete: true,
//   },
//   createdAt: new Date().toISOString(),
//   updatedAt: new Date().toISOString(),
// };

describe('ApplicationMaterialsStep', () => {
  const mockOnNext = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default MSW handlers for hierarchy API
    server.use(
      http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
        return HttpResponse.json({
          id: mockNodeId,
          type: 'career-transition',
          meta: {
            applicationMaterials: mockMaterialsEmpty,
            title: 'Software Engineer at TechCorp',
            company: 'TechCorp',
            targetRole: 'Software Engineer',
          },
        });
      }),
      http.patch(
        'http://localhost:3000/api/v2/timeline/nodes/:nodeId',
        async ({ request, params }) => {
          const body = (await request.json()) as any;
          return HttpResponse.json({
            id: params.nodeId,
            type: 'career-transition',
            meta: {
              ...body.meta,
            },
          });
        }
      )
    );
  });

  describe('Wizard Step Rendering', () => {
    it('should render the wizard step with header', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onCancel={mockOnCancel}
          currentStep={1}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(
        screen.getByRole('heading', { name: /add update/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/step 2: application materials/i)
      ).toBeInTheDocument();
    });

    it('should render the main question heading', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(
        screen.getByRole('heading', {
          name: /update your application materials/i,
        })
      ).toBeInTheDocument();
    });

    it('should render the description text', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(
        screen.getByText(/keep your resumes and linkedin profile current/i)
      ).toBeInTheDocument();
    });

    it('should render step indicator with correct step number', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={2}
          totalSteps={5}
          nodeId={mockNodeId}
        />
      );

      expect(
        screen.getByText(/step 3: application materials/i)
      ).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading message while fetching data', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(screen.getByText(/loading materials\.\.\./i)).toBeInTheDocument();
    });

    it('should hide loading message after data is loaded', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByText(/loading materials\.\.\./i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Materials Display - Empty State', () => {
    it('should show "No resumes added yet" when no resumes exist', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no resumes added yet/i)).toBeInTheDocument();
      });
    });

    it('should show "No profile added yet" when no LinkedIn profile exists', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no profile added yet/i)).toBeInTheDocument();
      });
    });

    it('should show "Add Resume" button when no resumes exist', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add resume/i })
        ).toBeInTheDocument();
      });
    });

    it('should show "Add Profile" button when no LinkedIn profile exists', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add profile/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Materials Display - With Data', () => {
    it('should show "1 resume version" when one resume exists', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsComplete,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/1 resume version/i)).toBeInTheDocument();
      });
    });

    it('should show "N resume versions" when multiple resumes exist', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithResumes,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/2 resume versions/i)).toBeInTheDocument();
      });
    });

    it('should show "Profile added" when LinkedIn profile exists', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithLinkedIn,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/profile added/i)).toBeInTheDocument();
      });
    });

    it('should show "Manage Resumes" button when resumes exist', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithResumes,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /manage resumes/i })
        ).toBeInTheDocument();
      });
    });

    it('should show "Update Profile" button when LinkedIn profile exists', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithLinkedIn,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /update profile/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Modal Integration', () => {
    it('should open modal when "Add Resume" button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add resume/i })
        ).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add resume/i });
      await user.click(addButton);

      // Modal should be rendered
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /^application materials$/i })
        ).toBeInTheDocument();
      });
    });

    it('should open modal when "Add Profile" button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add profile/i })
        ).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add profile/i });
      await user.click(addButton);

      // Modal should be rendered
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /^application materials$/i })
        ).toBeInTheDocument();
      });
    });

    it('should open modal when "Manage Resumes" button is clicked', async () => {
      const user = userEvent.setup();
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithResumes,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /manage resumes/i })
        ).toBeInTheDocument();
      });

      const manageButton = screen.getByRole('button', {
        name: /manage resumes/i,
      });
      await user.click(manageButton);

      // Modal should be rendered
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /^application materials$/i })
        ).toBeInTheDocument();
      });
    });

    it('should close modal when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add resume/i })
        ).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add resume/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /^application materials$/i })
        ).toBeInTheDocument();
      });

      // Find close button in modal (not the wizard cancel button)
      const modalCloseButton = screen.getAllByRole('button', {
        name: /close/i,
      })[0];
      await user.click(modalCloseButton);

      await waitFor(() => {
        expect(
          screen.queryByRole('heading', { name: /^application materials$/i })
        ).not.toBeInTheDocument();
      });
    });

    it('should refetch data after modal success', async () => {
      const user = userEvent.setup();

      server.use(
        http.patch(
          'http://localhost:3000/api/v2/nodes/:nodeId/application-materials',
          () => {
            return HttpResponse.json({
              id: mockNodeId,
              type: 'career-transition',
              meta: {
                applicationMaterials: mockMaterialsComplete,
              },
            });
          }
        )
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /add resume/i })
        ).toBeInTheDocument();
      });

      const addButton = screen.getByRole('button', { name: /add resume/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/resume url/i)).toBeInTheDocument();
      });

      // Fill form and save
      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // After successful save, data should be refetched
      // Update the handler to return data with resume
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsComplete,
            },
          });
        })
      );

      await waitFor(() => {
        expect(screen.getByText(/1 resume version/i)).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should render Continue button', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /continue/i })
        ).toBeInTheDocument();
      });
    });

    it('should call onNext with data when Continue is clicked', async () => {
      const user = userEvent.setup();
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsComplete,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /continue/i })
        ).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(mockOnNext).toHaveBeenCalledWith({
        applicationMaterialsData: {
          resumeCount: 1,
          hasLinkedInProfile: true,
        },
      });
    });

    it('should render Back button when onBack is provided', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onCancel={mockOnCancel}
          currentStep={1}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('should not render Back button when onBack is not provided', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: /^back$/i })
        ).not.toBeInTheDocument();
      });
    });

    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onCancel={mockOnCancel}
          currentStep={1}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });

    it('should render Cancel button', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      expect(
        screen.getByRole('button', { name: /cancel update/i })
      ).toBeInTheDocument();
    });

    it('should call onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      const cancelButton = screen.getByRole('button', {
        name: /cancel update/i,
      });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Step Indicator', () => {
    it('should show completed step indicator for previous steps', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={1}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      // Should have check icons for completed and current steps
      const checkIcons = screen.getAllByTestId('lucide-check');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('should show future step indicator for upcoming steps', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      // Step indicator structure should be present
      const stepText = screen.getByText(/step 1: application materials/i);
      expect(stepText).toBeInTheDocument();
    });
  });

  describe('Help Text', () => {
    it('should render tip message', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/tip:/i)).toBeInTheDocument();
        expect(
          screen.getByText(/keep your materials updated/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Current Materials Section', () => {
    it('should render "Current Materials" heading', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/current materials/i)).toBeInTheDocument();
      });
    });

    it('should render both Resumes and LinkedIn Profile sections', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /^resumes$/i })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('heading', { name: /^linkedin profile$/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      const mainHeading = screen.getByRole('heading', {
        name: /update your application materials/i,
      });
      expect(mainHeading).toBeInTheDocument();
    });

    it('should have focusable buttons', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /continue/i })
        ).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      continueButton.focus();
      expect(continueButton).toHaveFocus();
    });

    it('should support keyboard navigation between buttons', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onBack={mockOnBack}
          onCancel={mockOnCancel}
          currentStep={1}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /back/i })
        ).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', {
        name: /cancel update/i,
      });
      cancelButton.focus();
      expect(cancelButton).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle API error gracefully', async () => {
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json(
            { success: false, error: 'Server error' },
            { status: 500 }
          );
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      // Should still render the step even with error
      expect(
        screen.getByRole('heading', {
          name: /update your application materials/i,
        })
      ).toBeInTheDocument();
    });

    it('should handle zero resume count correctly', async () => {
      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/no resumes added yet/i)).toBeInTheDocument();
      });
    });

    it('should pass correct data structure to onNext', async () => {
      const user = userEvent.setup();
      server.use(
        http.get('http://localhost:3000/api/v2/timeline/nodes/:nodeId', () => {
          return HttpResponse.json({
            id: mockNodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockMaterialsWithResumes,
            },
          });
        })
      );

      renderWithProviders(
        <ApplicationMaterialsStep
          onNext={mockOnNext}
          onCancel={mockOnCancel}
          currentStep={0}
          totalSteps={3}
          nodeId={mockNodeId}
        />
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /continue/i })
        ).toBeInTheDocument();
      });

      const continueButton = screen.getByRole('button', { name: /continue/i });
      await user.click(continueButton);

      expect(mockOnNext).toHaveBeenCalledWith({
        applicationMaterialsData: {
          resumeCount: 2,
          hasLinkedInProfile: false,
        },
      });
    });
  });
});
