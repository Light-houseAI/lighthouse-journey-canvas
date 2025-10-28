/**
 * Tests for ResumeModal component
 *
 * Tests modal rendering, form validation, URL/file upload modes,
 * file cleanup, and edit history preservation
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../mocks/server';
import { ResumeModal } from './ResumeModal';

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
const mockExistingResumes = [
  {
    type: 'General',
    resumeVersion: {
      url: 'https://example.com/resume.pdf',
      lastUpdated: '2024-01-01T00:00:00Z',
      notes: 'General resume',
      editHistory: [
        {
          editedAt: '2024-01-01T00:00:00Z',
          notes: 'Initial upload',
          editedBy: '1',
        },
      ],
    },
  },
  {
    type: 'Technical',
    resumeVersion: {
      url: 'https://example.com/tech-resume.pdf',
      storageKey: 'old-file-storage-key',
      filename: 'old-resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      lastUpdated: '2024-01-01T00:00:00Z',
      notes: 'Technical resume with uploaded file',
      editHistory: [
        {
          editedAt: '2024-01-01T00:00:00Z',
          notes: 'File uploaded',
          editedBy: '1',
        },
      ],
    },
  },
];

describe('ResumeModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock GET /api/v2/career-transitions/:id/application-materials
    server.use(
      http.get(
        `/api/v2/career-transitions/${mockCareerTransitionId}/application-materials`,
        () => {
          return HttpResponse.json({
            success: true,
            data: {
              items: mockExistingResumes,
            },
          });
        }
      )
    );

    // Mock PUT /api/v2/career-transitions/:id/application-materials
    server.use(
      http.put(
        `/api/v2/career-transitions/${mockCareerTransitionId}/application-materials`,
        async ({ request }) => {
          const body = await request.json();
          return HttpResponse.json({
            success: true,
            data: body,
          });
        }
      )
    );

    // Mock file download URL endpoint
    server.use(
      http.get('/api/v2/files/:storageKey/download-url', () => {
        return HttpResponse.json({
          success: true,
          data: {
            downloadUrl: 'https://example.com/download/resume.pdf',
          },
        });
      })
    );

    // Mock file delete endpoint
    server.use(
      http.delete('/api/v2/files/:storageKey', () => {
        return HttpResponse.json({
          success: true,
          data: { deleted: true },
        });
      })
    );

    // Mock current user
    server.use(
      http.get('/api/v2/users/me', () => {
        return HttpResponse.json({
          success: true,
          data: {
            id: 1,
            email: 'test@example.com',
          },
        });
      })
    );

    // Mock quota endpoint
    server.use(
      http.get('/api/v2/files/quota', () => {
        return HttpResponse.json({
          success: true,
          data: {
            used: 1024,
            total: 10485760,
            percentage: 0.01,
          },
        });
      })
    );
  });

  describe('Rendering and Basic Behavior', () => {
    it('should render modal when open', () => {
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Add new resume')).toBeInTheDocument();
      expect(screen.getByLabelText(/Resume type/i)).toBeInTheDocument();
      expect(screen.getByText('Upload file')).toBeInTheDocument();
      expect(screen.getByText('Add URL')).toBeInTheDocument();
    });

    it('should not render when closed', () => {
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={false}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByText('Add new resume')).not.toBeInTheDocument();
    });

    it('should show edit mode title when editing existing resume', () => {
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={mockExistingResumes[0]}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Edit Resume')).toBeInTheDocument();
    });
  });

  describe('Upload Mode Toggle', () => {
    it('should default to upload mode for new resumes', () => {
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const uploadTab = screen.getByText('Upload file');
      expect(uploadTab.closest('button')).toHaveClass('bg-gray-900');
    });

    it('should default to URL mode when editing existing resume', () => {
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={mockExistingResumes[0]}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      const urlTab = screen.getByText('Add URL');
      expect(urlTab.closest('button')).toHaveClass('bg-gray-900');
    });

    it('should switch between upload and URL modes', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Start in upload mode
      expect(screen.getByText('Upload file').closest('button')).toHaveClass(
        'bg-gray-900'
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      expect(screen.getByText('Add URL').closest('button')).toHaveClass(
        'bg-gray-900'
      );
      expect(
        screen.getByPlaceholderText('https://example.com/my-resume.pdf')
      ).toBeInTheDocument();
    });

    it('should clear URL when switching to upload mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to URL mode and enter URL
      await user.click(screen.getByText('Add URL'));
      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.type(urlInput, 'https://example.com/test.pdf');

      // Switch back to upload mode
      await user.click(screen.getByText('Upload file'));

      // Switch to URL mode again - should be cleared
      await user.click(screen.getByText('Add URL'));
      expect(urlInput).toHaveValue('');
    });
  });

  describe('Validation', () => {
    it('should validate required resume type', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Try to save without type
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(screen.getByText('Resume type is required')).toBeInTheDocument();
      });
    });

    it('should validate required URL in URL mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      // Enter type but no URL
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'New Type');

      // Enter notes
      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Test notes');

      // Try to save
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(screen.getByText('Resume URL is required')).toBeInTheDocument();
      });
    });

    it('should validate URL format', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      // Enter invalid URL
      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.type(urlInput, 'not-a-valid-url');

      // Enter type
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'New Type');

      // Enter notes
      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Test notes');

      // Try to save
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(
          screen.getByText('Please enter a valid URL')
        ).toBeInTheDocument();
      });
    });

    it('should validate required notes', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      // Enter type and URL but no notes
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'New Type');

      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.type(urlInput, 'https://example.com/test.pdf');

      // Try to save
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(screen.getByText('Notes are required')).toBeInTheDocument();
      });
    });

    it('should prevent duplicate resume types', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      // Try to use existing type (case-insensitive)
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'general');

      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.type(urlInput, 'https://example.com/test.pdf');

      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Test notes');

      // Try to save
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(
          screen.getByText(/A resume of this type already exists/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('Saving Resume - URL Mode', () => {
    it('should save new resume with URL', async () => {
      const user = userEvent.setup();
      let savedData: any = null;

      server.use(
        http.put(
          `/api/v2/career-transitions/${mockCareerTransitionId}/application-materials`,
          async ({ request }) => {
            savedData = await request.json();
            return HttpResponse.json({
              success: true,
              data: savedData,
            });
          }
        )
      );

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Switch to URL mode
      await user.click(screen.getByText('Add URL'));

      // Fill form
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'Data Science');

      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.type(urlInput, 'https://example.com/data-science.pdf');

      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Updated for data science roles');

      // Save
      await user.click(screen.getByText('+ Add new resume'));

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
      });

      // Verify saved data
      expect(savedData.items).toHaveLength(mockExistingResumes.length + 1);
      const newResume = savedData.items[savedData.items.length - 1];
      expect(newResume.type).toBe('Data Science');
      expect(newResume.resumeVersion.url).toBe(
        'https://example.com/data-science.pdf'
      );
      expect(newResume.resumeVersion.notes).toBe(
        'Updated for data science roles'
      );
      expect(newResume.resumeVersion.storageKey).toBeUndefined();
      expect(newResume.resumeVersion.filename).toBeUndefined();
    });
  });

  describe('File Cleanup Scenarios', () => {
    it('should delete old file when switching from file upload to URL', async () => {
      const user = userEvent.setup();
      let deletedStorageKey: string | null = null;

      server.use(
        http.delete('/api/v2/files/:storageKey', ({ params }) => {
          deletedStorageKey = params.storageKey as string;
          return HttpResponse.json({
            success: true,
            data: { deleted: true },
          });
        })
      );

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={mockExistingResumes[1]} // Technical resume with file
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Should be in URL mode by default for editing
      expect(screen.getByText('Add URL').closest('button')).toHaveClass(
        'bg-gray-900'
      );

      // Fill form with new URL
      const urlInput = screen.getByPlaceholderText(
        'https://example.com/my-resume.pdf'
      );
      await user.clear(urlInput);
      await user.type(urlInput, 'https://example.com/new-url.pdf');

      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Switched to external URL');

      // Save (button text is different in edit mode - it's just "Save" not "+ Add new resume")
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(deletedStorageKey).toBe('old-file-storage-key');
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('should not delete file when URL is the same', async () => {
      const user = userEvent.setup();
      const deleteHandler = vi.fn();

      server.use(
        http.delete('/api/v2/files/:storageKey', () => {
          deleteHandler();
          return HttpResponse.json({
            success: true,
            data: { deleted: true },
          });
        })
      );

      // Create a resume with just URL (no file)
      const urlOnlyResume = {
        type: 'URL Only',
        resumeVersion: {
          url: 'https://example.com/existing.pdf',
          lastUpdated: '2024-01-01T00:00:00Z',
          notes: 'URL only resume',
          editHistory: [
            {
              editedAt: '2024-01-01T00:00:00Z',
              notes: 'Initial',
              editedBy: '1',
            },
          ],
        },
      };

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={urlOnlyResume}
          resumeItems={[...mockExistingResumes, urlOnlyResume]}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Just update notes
      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Minor update');

      // Save (button text is different in edit mode - it's just "Save" not "+ Add new resume")
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Delete should not have been called
      expect(deleteHandler).not.toHaveBeenCalled();
    });
  });

  describe('Edit History Preservation', () => {
    it('should preserve edit history when updating resume', async () => {
      const user = userEvent.setup();
      let savedData: any = null;

      server.use(
        http.put(
          `/api/v2/career-transitions/${mockCareerTransitionId}/application-materials`,
          async ({ request }) => {
            savedData = await request.json();
            return HttpResponse.json({
              success: true,
              data: savedData,
            });
          }
        )
      );

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={mockExistingResumes[0]}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Update notes
      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'Updated version');

      // Save (button text is different in edit mode - it's just "Save" not "+ Add new resume")
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Verify edit history is preserved
      const updatedResume = savedData.items.find(
        (r: any) => r.type === 'General'
      );
      expect(updatedResume.resumeVersion.editHistory).toHaveLength(2);
      expect(updatedResume.resumeVersion.editHistory[0].notes).toBe(
        'Initial upload'
      );
      expect(updatedResume.resumeVersion.editHistory[1].notes).toBe(
        'Updated version'
      );
    });

    it('should filter out invalid edit history entries', async () => {
      const user = userEvent.setup();
      let savedData: any = null;

      const resumeWithInvalidHistory = {
        type: 'Invalid History',
        resumeVersion: {
          url: 'https://example.com/test.pdf',
          lastUpdated: '2024-01-01T00:00:00Z',
          notes: 'Test',
          editHistory: [
            {
              editedAt: '2024-01-01T00:00:00Z',
              notes: 'Valid entry',
              editedBy: '123', // Valid numeric ID
            },
            {
              editedAt: '2024-01-02T00:00:00Z',
              notes: 'Invalid entry',
              editedBy: 'not-a-number', // Invalid ID
            },
          ],
        },
      };

      server.use(
        http.put(
          `/api/v2/career-transitions/${mockCareerTransitionId}/application-materials`,
          async ({ request }) => {
            savedData = await request.json();
            return HttpResponse.json({
              success: true,
              data: savedData,
            });
          }
        )
      );

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resume={resumeWithInvalidHistory}
          resumeItems={[...mockExistingResumes, resumeWithInvalidHistory]}
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Update notes
      const notesInput = screen.getByPlaceholderText(/Add your notes/i);
      await user.type(notesInput, 'New update');

      // Save (button text is different in edit mode - it's just "Save" not "+ Add new resume")
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      // Verify invalid entry was filtered out
      const updatedResume = savedData.items.find(
        (r: any) => r.type === 'Invalid History'
      );
      expect(updatedResume.resumeVersion.editHistory).toHaveLength(2); // Only valid + new
      expect(
        updatedResume.resumeVersion.editHistory.every((entry: any) =>
          /^\d+$/.test(entry.editedBy)
        )
      ).toBe(true);
    });
  });

  describe('Close Behavior', () => {
    it('should prompt confirmation when closing with unsaved changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Make changes
      await user.click(screen.getByText('Add URL'));
      const typeInput = screen.getByPlaceholderText(
        /e.g. General, Healthcare/i
      );
      await user.type(typeInput, 'Test');

      // Try to close - Find button with X icon in header
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(
        (btn) => btn.querySelector('svg.lucide-x') !== null
      );
      if (!closeButton) throw new Error('Close button not found');
      await user.click(closeButton);

      expect(confirmSpy).toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('should close without confirmation when no changes', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm');

      renderWithProviders(
        <ResumeModal
          careerTransitionId={mockCareerTransitionId}
          resumeItems={mockExistingResumes}
          isOpen={true}
          onClose={mockOnClose}
        />
      );

      // Close without making changes - Find button with X icon in header
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(
        (btn) => btn.querySelector('svg.lucide-x') !== null
      );
      if (!closeButton) throw new Error('Close button not found');
      await user.click(closeButton);

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });
});
