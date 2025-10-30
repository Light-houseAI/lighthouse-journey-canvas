/**
 * Tests for ApplicationMaterialsModal component
 *
 * Tests modal rendering, form validation, state management, and save functionality
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { useApplicationMaterialsStore } from '@/stores/application-materials-store';

import { ApplicationMaterialsModal } from './ApplicationMaterialsModal';

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
const mockCareerTransitionId = 'career-transition-123';
const mockExistingMaterials = {
  resumes: {
    items: [
      {
        type: 'general',
        resumeVersion: {
          url: 'https://example.com/resume.pdf',
          lastUpdated: '2024-01-01T00:00:00Z',
          notes: 'General resume',
          editHistory: [
            {
              editedAt: '2024-01-01T00:00:00Z',
              notes: 'Initial upload',
              editedBy: 'user-1',
            },
          ],
        },
      },
    ],
    summary: undefined,
  },
  linkedInProfile: {
    url: 'https://linkedin.com/in/testuser',
    lastUpdated: '2024-01-01T00:00:00Z',
    notes: 'Professional profile',
    editHistory: [
      {
        editedAt: '2024-01-01T00:00:00Z',
        notes: 'Profile updated',
        editedBy: 'user-1',
      },
    ],
  },
};

describe('ApplicationMaterialsModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state before each test
    useApplicationMaterialsStore.getState().resetAll();

    // Setup default MSW handlers for hierarchy API
    server.use(
      // GET node with application materials
      http.get(
        'http://localhost:3000/api/v2/timeline/nodes/:nodeId',
        ({ params }) => {
          return HttpResponse.json({
            id: params.nodeId,
            type: 'career-transition',
            meta: {
              applicationMaterials: mockExistingMaterials,
            },
          });
        }
      ),
      // PATCH node to update application materials
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

  describe('Modal Rendering', () => {
    it('should not render when isOpen is false', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.queryByRole('heading', { name: /application materials/i })
      ).not.toBeInTheDocument();
    });

    it('should render modal with header when isOpen is true', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole('heading', { name: /application materials/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /close/i })
      ).toBeInTheDocument();
    });

    it('should render both tab buttons', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(
        screen.getByRole('button', { name: /^resume$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^linkedin profile$/i })
      ).toBeInTheDocument();
    });

    it('should render resume tab content by default', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/resume type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/resume url/i)).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('should switch to LinkedIn tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/linkedin profile url/i)
        ).toBeInTheDocument();
      });
    });

    it('should switch back to resume tab when clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to LinkedIn tab
      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      // Switch back to resume tab
      const resumeTab = screen.getByRole('button', { name: /^resume$/i });
      await user.click(resumeTab);

      await waitFor(() => {
        expect(screen.getByLabelText(/resume type/i)).toBeInTheDocument();
      });
    });

    it('should apply active styling to selected tab', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const resumeTab = screen.getByRole('button', { name: /^resume$/i });
      expect(resumeTab).toHaveClass('border-teal-600');

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      await waitFor(() => {
        expect(linkedInTab).toHaveClass('border-teal-600');
      });
    });
  });

  describe('Resume Form', () => {
    it('should render all resume form fields', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/resume type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/resume url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes.*optional/i)).toBeInTheDocument();
    });

    it('should show resume type dropdown with options', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const typeSelect = screen.getByLabelText(
        /resume type/i
      ) as HTMLSelectElement;
      expect(typeSelect).toBeInTheDocument();

      const options = within(typeSelect).getAllByRole('option');
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('General');
      expect(options[1]).toHaveTextContent('Product Management');
      expect(options[2]).toHaveTextContent('Business Development');
      expect(options[3]).toHaveTextContent('Custom');
    });

    it('should show custom type name input when "Custom" is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const typeSelect = screen.getByLabelText(/resume type/i);
      await user.selectOptions(typeSelect, 'custom');

      await waitFor(() => {
        expect(
          screen.getByLabelText(/custom resume type name/i)
        ).toBeInTheDocument();
      });
    });

    it('should hide custom type name input when predefined type is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const typeSelect = screen.getByLabelText(/resume type/i);
      await user.selectOptions(typeSelect, 'custom');

      await waitFor(() => {
        expect(
          screen.getByLabelText(/custom resume type name/i)
        ).toBeInTheDocument();
      });

      await user.selectOptions(typeSelect, 'general');

      await waitFor(() => {
        expect(
          screen.queryByLabelText(/custom resume type name/i)
        ).not.toBeInTheDocument();
      });
    });

    it('should update resume URL input value', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i) as HTMLInputElement;
      await user.type(urlInput, 'https://example.com/my-resume.pdf');

      expect(urlInput.value).toBe('https://example.com/my-resume.pdf');
    });

    it('should update notes textarea value', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const notesTextarea = screen.getByLabelText(
        /notes.*optional/i
      ) as HTMLTextAreaElement;
      await user.type(notesTextarea, 'Updated with new skills');

      expect(notesTextarea.value).toBe('Updated with new skills');
    });

    it('should show character count for notes', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('0/500 characters')).toBeInTheDocument();
    });

    it('should update character count as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const notesTextarea = screen.getByLabelText(/notes.*optional/i);
      await user.type(notesTextarea, 'Test note');

      expect(screen.getByText('9/500 characters')).toBeInTheDocument();
    });
  });

  describe('LinkedIn Form', () => {
    it('should render LinkedIn form fields when tab is active', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      await waitFor(() => {
        expect(
          screen.getByLabelText(/linkedin profile url/i)
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/notes.*optional/i)).toBeInTheDocument();
      });
    });

    it('should update LinkedIn URL input value', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      const urlInput = (await screen.findByLabelText(
        /linkedin profile url/i
      )) as HTMLInputElement;

      // Clear existing value first (from loaded data)
      await user.clear(urlInput);
      await user.type(urlInput, 'https://linkedin.com/in/johndoe');

      expect(urlInput.value).toBe('https://linkedin.com/in/johndoe');
    });

    it('should show helper text for LinkedIn URL format', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      await waitFor(() => {
        expect(
          screen.getByText(
            /enter your linkedin profile url.*linkedin\.com\/in\/username/i
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('should not show validation error when saving with empty resume form', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should save successfully without validation errors (empty form is valid)
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error for invalid resume URL format', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'not-a-valid-url');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter a valid url/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error for empty custom resume type name', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const typeSelect = screen.getByLabelText(/resume type/i);
      await user.selectOptions(typeSelect, 'custom');

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter a custom resume type name/i)
        ).toBeInTheDocument();
      });
    });

    it('should not show validation error when saving with empty LinkedIn form', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should save successfully without validation errors (empty form is valid)
      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should show error for non-LinkedIn URL', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      const urlInput = await screen.findByLabelText(/linkedin profile url/i);
      // Clear existing value first (from loaded data)
      await user.clear(urlInput);
      await user.type(urlInput, 'https://example.com/profile');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/must be a linkedin profile url/i)
        ).toBeInTheDocument();
      });
    });

    it('should show error for LinkedIn URL without /in/ path', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      const urlInput = await screen.findByLabelText(/linkedin profile url/i);
      // Clear existing value first (from loaded data)
      await user.clear(urlInput);
      await user.type(urlInput, 'https://linkedin.com/company/test');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(
            /must be a linkedin profile url.*linkedin\.com\/in\/username/i
          )
        ).toBeInTheDocument();
      });
    });

    it('should clear validation errors when input is corrected', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'invalid-url');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter a valid url/i)
        ).toBeInTheDocument();
      });

      await user.clear(urlInput);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      // Validation should clear on next save attempt
      expect(
        screen.queryByText(/please enter a valid url/i)
      ).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should save resume with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const notesTextarea = screen.getByLabelText(/notes.*optional/i);
      await user.type(notesTextarea, 'Updated resume with new skills');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should save LinkedIn profile with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      const urlInput = await screen.findByLabelText(/linkedin profile url/i);
      await user.type(urlInput, 'https://linkedin.com/in/johndoe');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should save custom resume type', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      const typeSelect = screen.getByLabelText(/resume type/i);
      await user.selectOptions(typeSelect, 'custom');

      const customTypeInput = await screen.findByLabelText(
        /custom resume type name/i
      );
      await user.type(customTypeInput, 'Data Science');

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/data-science-resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show saving state during API call', async () => {
      const user = userEvent.setup();

      // Delay the response to see the loading state
      server.use(
        http.patch(
          'http://localhost:3000/api/v2/timeline/nodes/:nodeId',
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              id: mockCareerTransitionId,
              type: 'career-transition',
              meta: {},
            });
          }
        )
      );

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(
        screen.getByRole('button', { name: /saving\.\.\./i })
      ).toBeInTheDocument();
    });

    it('should handle save errors gracefully', async () => {
      const user = userEvent.setup();

      // Mock API error
      server.use(
        http.patch(
          'http://localhost:3000/api/v2/timeline/nodes/:nodeId',
          () => {
            return HttpResponse.json(
              { success: false, error: 'Server error' },
              { status: 500 }
            );
          }
        )
      );

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Modal should remain open on error
      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dirty State and Close Confirmation', () => {
    it('should not show confirmation when closing after loading existing data', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Wait for data to load (which should set isDirty to false)
      await waitFor(() => {
        const linkedInTab = screen.getByRole('button', {
          name: /^linkedin profile$/i,
        });
        expect(linkedInTab).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      // Loading existing data should NOT make the form dirty
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should show confirmation when closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(confirmSpy).toHaveBeenCalledWith(
        'You have unsaved changes. Are you sure you want to close?'
      );
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not close when user cancels confirmation', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should reset form when closing after successful save', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Verify store is reset
      const state = useApplicationMaterialsStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.resumeFormData.url).toBe('');
    });
  });

  describe('Data Loading', () => {
    it('should load existing LinkedIn profile data when modal opens', async () => {
      const user = userEvent.setup();

      const { rerender } = renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      // Open modal
      rerender(
        <QueryClientProvider client={createTestQueryClient()}>
          <ApplicationMaterialsModal
            careerTransitionId={mockCareerTransitionId}
            isOpen={true}
            onClose={mockOnClose}
          />
        </QueryClientProvider>
      );

      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });
      await user.click(linkedInTab);

      // Should load existing data
      await waitFor(() => {
        const urlInput = screen.getByLabelText(
          /linkedin profile url/i
        ) as HTMLInputElement;
        expect(urlInput.value).toBe(mockExistingMaterials.linkedInProfile.url);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByLabelText(/resume type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/resume url/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes.*optional/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation between tabs', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const resumeTab = screen.getByRole('button', { name: /^resume$/i });
      const linkedInTab = screen.getByRole('button', {
        name: /^linkedin profile$/i,
      });

      resumeTab.focus();
      expect(resumeTab).toHaveFocus();

      await user.tab();
      expect(linkedInTab).toHaveFocus();
    });

    it('should disable buttons during save', async () => {
      const user = userEvent.setup();

      // Delay the response
      server.use(
        http.patch(
          'http://localhost:3000/api/v2/timeline/nodes/:nodeId',
          async ({ params }) => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return HttpResponse.json({
              id: params.nodeId,
              type: 'career-transition',
              meta: {},
            });
          }
        )
      );

      renderWithProviders(
        <ApplicationMaterialsModal
          careerTransitionId={mockCareerTransitionId}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlInput = screen.getByLabelText(/resume url/i);
      await user.type(urlInput, 'https://example.com/resume.pdf');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
      expect(saveButton).toBeDisabled();
    });
  });
});
