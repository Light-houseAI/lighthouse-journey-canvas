/**
 * Integration Tests for Client Workflows
 * Tests complete user journeys and multi-component interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import { httpClient } from '@/services/http-client';
import { useAuthStore } from '@/stores/auth-store';

// Mock MSW handlers for integration testing
import { server } from '@/mocks/server';
import { rest } from 'msw';

// Test components
import { App } from '@/App';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  userName: 'testuser',
  hasCompletedOnboarding: true,
};

const mockTimelineData = [
  {
    id: '1',
    type: 'experience',
    title: 'Software Engineer',
    company: 'Tech Corp',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    description: 'Developed React applications',
    skills: ['React', 'TypeScript'],
    isPrivate: false,
  },
  {
    id: '2',
    type: 'education',
    title: 'Computer Science Degree',
    institution: 'University',
    startDate: '2019-09-01',
    endDate: '2023-05-01',
    isPrivate: false,
  },
];

const IntegrationTestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        {children}
      </Router>
    </QueryClientProvider>
  );
};

describe('Client Integration Tests', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    
    // Setup MSW handlers for integration tests
    server.use(
      rest.get('/api/auth/me', (req, res, ctx) => {
        return res(ctx.json({ success: true, data: mockUser }));
      }),
      rest.get('/api/timeline', (req, res, ctx) => {
        return res(ctx.json({ success: true, data: mockTimelineData }));
      }),
      rest.post('/api/timeline', (req, res, ctx) => {
        return res(ctx.json({ 
          success: true, 
          data: { id: '3', ...req.body } 
        }));
      }),
      rest.patch('/api/timeline/:id', (req, res, ctx) => {
        return res(ctx.json({ 
          success: true, 
          data: { ...mockTimelineData[0], ...req.body } 
        }));
      }),
      rest.delete('/api/timeline/:id', (req, res, ctx) => {
        return res(ctx.json({ success: true }));
      })
    );
  });

  afterEach(() => {
    server.resetHandlers();
  });

  describe('User Authentication Flow', () => {
    it('should complete login workflow', async () => {
      server.use(
        rest.post('/api/auth/signin', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: mockUser,
          }));
        })
      );

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Should show login form for unauthenticated user
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

      // Fill in login form
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(loginButton);

      // Should redirect to timeline after successful login
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Tech Corp')).toBeInTheDocument();
      });
    });

    it('should handle login errors', async () => {
      server.use(
        rest.post('/api/auth/signin', (req, res, ctx) => {
          return res(
            ctx.status(401),
            ctx.json({
              success: false,
              error: { message: 'Invalid credentials' }
            })
          );
        })
      );

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      
      const loginButton = screen.getByRole('button', { name: /sign in/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });

    it('should handle token refresh workflow', async () => {
      let requestCount = 0;
      
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          requestCount++;
          if (requestCount === 1) {
            return res(ctx.status(401), ctx.json({ error: 'Token expired' }));
          }
          return res(ctx.json({ success: true, data: mockTimelineData }));
        }),
        rest.post('/api/auth/refresh', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          }));
        })
      );

      // Mock authenticated state
      useAuthStore.setState({ user: mockUser });

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Should automatically retry after token refresh
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      expect(requestCount).toBe(2); // Initial request + retry
    });
  });

  describe('Timeline Management Workflow', () => {
    beforeEach(() => {
      // Mock authenticated state
      useAuthStore.setState({ user: mockUser });
    });

    it('should complete add experience workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Click add experience button
      const addButton = screen.getByRole('button', { name: /add experience/i });
      await user.click(addButton);

      // Fill out experience form
      await user.type(screen.getByLabelText(/title/i), 'Senior Developer');
      await user.type(screen.getByLabelText(/company/i), 'New Corp');
      await user.type(screen.getByLabelText(/start date/i), '2024-01-01');
      await user.type(screen.getByLabelText(/description/i), 'Leading development team');

      // Add skills
      const skillInput = screen.getByPlaceholderText(/add skill/i);
      await user.type(skillInput, 'React');
      await user.keyboard('{Enter}');
      await user.type(skillInput, 'Node.js');
      await user.keyboard('{Enter}');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Should show success message and new experience in timeline
      await waitFor(() => {
        expect(screen.getByText(/experience added successfully/i)).toBeInTheDocument();
        expect(screen.getByText('Senior Developer')).toBeInTheDocument();
        expect(screen.getByText('New Corp')).toBeInTheDocument();
      });
    });

    it('should complete edit experience workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Click edit button on first experience
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      // Update title
      const titleInput = screen.getByDisplayValue('Software Engineer');
      await user.clear(titleInput);
      await user.type(titleInput, 'Senior Software Engineer');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show updated experience
      await waitFor(() => {
        expect(screen.getByText(/experience updated successfully/i)).toBeInTheDocument();
        expect(screen.getByText('Senior Software Engineer')).toBeInTheDocument();
        expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument();
      });
    });

    it('should complete delete experience workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Wait for timeline to load
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Should remove experience from timeline
      await waitFor(() => {
        expect(screen.getByText(/experience deleted successfully/i)).toBeInTheDocument();
        expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument();
      });
    });

    it('should handle privacy toggle workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Toggle privacy for first experience
      const privacyToggles = screen.getAllByRole('switch', { name: /private/i });
      await user.click(privacyToggles[0]);

      await waitFor(() => {
        expect(screen.getByText(/privacy updated/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/private entry/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Management Workflow', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: mockUser });
    });

    it('should complete profile update workflow', async () => {
      server.use(
        rest.patch('/api/auth/profile', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            data: { ...mockUser, ...req.body }
          }));
        })
      );

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Navigate to settings
      const settingsLink = screen.getByRole('link', { name: /settings/i });
      await user.click(settingsLink);

      // Update profile information
      const firstNameInput = screen.getByDisplayValue('Test');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Updated');

      const lastNameInput = screen.getByDisplayValue('User');
      await user.clear(lastNameInput);
      await user.type(lastNameInput, 'Name');

      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/profile updated successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle avatar upload workflow', async () => {
      server.use(
        rest.post('/api/upload/avatar', (req, res, ctx) => {
          return res(ctx.json({
            success: true,
            data: { avatarUrl: '/uploads/avatar-123.jpg' }
          }));
        })
      );

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      const settingsLink = screen.getByRole('link', { name: /settings/i });
      await user.click(settingsLink);

      // Mock file upload
      const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      const fileInput = screen.getByLabelText(/upload avatar/i);
      
      await user.upload(fileInput, file);

      await waitFor(() => {
        expect(screen.getByText(/avatar uploaded successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Search and Filter Workflow', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: mockUser });
    });

    it('should complete timeline search workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Computer Science Degree')).toBeInTheDocument();
      });

      // Use search functionality
      const searchInput = screen.getByPlaceholderText(/search timeline/i);
      await user.type(searchInput, 'engineer');

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.queryByText('Computer Science Degree')).not.toBeInTheDocument();
      });

      // Clear search
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Computer Science Degree')).toBeInTheDocument();
      });
    });

    it('should complete filter workflow', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.getByText('Computer Science Degree')).toBeInTheDocument();
      });

      // Open filter menu
      const filterButton = screen.getByRole('button', { name: /filter/i });
      await user.click(filterButton);

      // Select experience filter
      const experienceFilter = screen.getByRole('checkbox', { name: /experience/i });
      await user.click(experienceFilter);

      const applyButton = screen.getByRole('button', { name: /apply/i });
      await user.click(applyButton);

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.queryByText('Computer Science Degree')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery Workflow', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: mockUser });
    });

    it('should handle network error recovery', async () => {
      let failureCount = 0;
      
      server.use(
        rest.get('/api/timeline', (req, res, ctx) => {
          failureCount++;
          if (failureCount <= 2) {
            return res.networkError('Network error');
          }
          return res(ctx.json({ success: true, data: mockTimelineData }));
        })
      );

      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Should show error initially
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should show error again on second failure
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Click retry again
      await user.click(retryButton);

      // Should succeed on third attempt
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
      });
    });

    it('should handle form validation errors', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Try to add experience without required fields
      const addButton = screen.getByRole('button', { name: /add experience/i });
      await user.click(addButton);

      const submitButton = screen.getByRole('button', { name: /save/i });
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
        expect(screen.getByText(/company is required/i)).toBeInTheDocument();
      });

      // Fix validation errors
      await user.type(screen.getByLabelText(/title/i), 'New Position');
      await user.type(screen.getByLabelText(/company/i), 'New Company');

      await user.click(submitButton);

      // Should succeed after fixing errors
      await waitFor(() => {
        expect(screen.getByText(/experience added successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component State Management', () => {
    beforeEach(() => {
      useAuthStore.setState({ user: mockUser });
    });

    it('should sync state across components', async () => {
      render(
        <IntegrationTestWrapper>
          <App />
        </IntegrationTestWrapper>
      );

      // Load timeline
      await waitFor(() => {
        expect(screen.getByText('Software Engineer')).toBeInTheDocument();
      });

      // Update experience from timeline
      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const titleInput = screen.getByDisplayValue('Software Engineer');
      await user.clear(titleInput);
      await user.type(titleInput, 'Lead Engineer');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Navigate to profile view
      const profileLink = screen.getByRole('link', { name: /profile/i });
      await user.click(profileLink);

      // Should show updated data in profile view
      await waitFor(() => {
        expect(screen.getByText('Lead Engineer')).toBeInTheDocument();
      });
    });
  });
});