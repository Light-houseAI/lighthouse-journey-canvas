/**
 * Tests for Profile Review Store
 * Tests profile extraction, selection management, and onboarding flow
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { renderWithProviders, http, HttpResponse } from '../test/renderWithProviders';
import { useProfileReviewStore } from './profile-review-store';
import { createMockProfileData } from '../test/factories';

// Test component for profile review store operations
const ProfileReviewStoreTestComponent: React.FC = () => {
  const store = useProfileReviewStore();

  // Test handlers for store operations
  const handleSetProfile = () => {
    const profile = createMockProfileData();
    store.setExtractedProfile(profile, 'testuser');
  };

  const handleToggleHeadline = () => {
    store.toggleSelection('headline', !store.selection?.headline);
  };

  const handleToggleExperience = (index: number) => {
    store.toggleExperience(index, !store.selection?.experiences[index]);
  };

  const handleToggleEducation = (index: number) => {
    store.toggleEducation(index, !store.selection?.education[index]);
  };

  const handleToggleBasicInfo = (checked: boolean) => {
    store.toggleSectionSelection('basicInfo', checked);
  };

  const handleToggleExperiences = (checked: boolean) => {
    store.toggleSectionSelection('experiences', checked);
  };

  const handleSaveProfile = async () => {
    await store.saveProfile(async () => {
      // Mock onboarding completion
      await fetch('/api/onboarding/complete', { method: 'POST' });
    });
  };

  const handleSetInterest = (interest: 'find-job' | 'grow-career' | 'change-careers' | 'start-startup') => {
    store.setSelectedInterest(interest);
  };

  const handleGoBack = () => {
    store.goBackToStep1();
  };

  const handleReset = () => {
    store.reset();
  };

  return (
    <div>
      <h1>Profile Review Test</h1>

      {/* Display state */}
      <div data-testid="username">{store.username || 'none'}</div>
      <div data-testid="has-profile">{store.extractedProfile ? 'yes' : 'no'}</div>
      <div data-testid="interest">{store.selectedInterest || 'none'}</div>
      <div data-testid="step">Step {store.currentOnboardingStep}</div>
      <div data-testid="loading">{store.isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="success">{store.showSuccess ? 'success' : 'no-success'}</div>
      {store.error && <div data-testid="error">{store.error}</div>}

      {/* Display selection state */}
      {store.selection && (
        <div data-testid="selection">
          <div data-testid="selection-name">{store.selection.name ? 'yes' : 'no'}</div>
          <div data-testid="selection-headline">{store.selection.headline ? 'yes' : 'no'}</div>
          <div data-testid="selection-location">{store.selection.location ? 'yes' : 'no'}</div>
          <div data-testid="selection-about">{store.selection.about ? 'yes' : 'no'}</div>
          <div data-testid="selection-avatarUrl">{store.selection.avatarUrl ? 'yes' : 'no'}</div>
          <div data-testid="selection-experiences">
            {store.selection.experiences.map((selected, index) => (
              <span key={index}>{selected ? 'yes' : 'no'}</span>
            ))}
          </div>
          <div data-testid="selection-education">
            {store.selection.education.map((selected, index) => (
              <span key={index}>{selected ? 'yes' : 'no'}</span>
            ))}
          </div>
        </div>
      )}

      {/* Profile details */}
      {store.extractedProfile && (
        <div data-testid="profile-details">
          <div data-testid="profile-name">{store.extractedProfile.name}</div>
          {store.extractedProfile.headline && (
            <div data-testid="profile-headline">{store.extractedProfile.headline}</div>
          )}
          <div data-testid="profile-experiences">
            {store.extractedProfile.experiences.length} experiences
          </div>
          <div data-testid="profile-education">
            {store.extractedProfile.education.length} education
          </div>
        </div>
      )}

      {/* Action buttons */}
      <button onClick={handleSetProfile}>Set Profile</button>
      <button onClick={handleToggleHeadline}>Toggle Headline</button>
      <button onClick={() => handleToggleExperience(0)}>Toggle Experience 0</button>
      <button onClick={() => handleToggleEducation(0)}>Toggle Education 0</button>
      <button onClick={() => handleToggleBasicInfo(false)}>Deselect Basic Info</button>
      <button onClick={() => handleToggleBasicInfo(true)}>Select Basic Info</button>
      <button onClick={() => handleToggleExperiences(false)}>Deselect All Experiences</button>
      <button onClick={handleSaveProfile}>Save Profile</button>
      <button onClick={() => handleSetInterest('find-job')}>Set Find Job</button>
      <button onClick={() => handleSetInterest('grow-career')}>Set Grow Career</button>
      <button onClick={handleGoBack}>Go Back</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  );
};

describe('Profile Review Store', () => {
  beforeEach(() => {
    // Reset store before each test
    act(() => {
      useProfileReviewStore.setState({
        extractedProfile: null,
        username: null,
        selection: null,
        showSuccess: false,
        isLoading: false,
        error: null,
        selectedInterest: null,
        currentOnboardingStep: 1,
      });
    });
  });

  describe('Profile Management', () => {
    it('should set extracted profile with username and initialize selection', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Initially no profile
      expect(screen.getByTestId('has-profile')).toHaveTextContent('no');
      expect(screen.getByTestId('username')).toHaveTextContent('none');

      // Set profile
      await user.click(screen.getByText('Set Profile'));

      // Profile should be set with selection initialized
      expect(screen.getByTestId('has-profile')).toHaveTextContent('yes');
      expect(screen.getByTestId('username')).toHaveTextContent('testuser');

      // Check selection initialized (all true by default)
      expect(screen.getByTestId('selection-name')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-headline')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-location')).toHaveTextContent('yes');
    });

    it('should handle profiles with missing optional fields', async () => {
      const ProfileWithMissingFields = () => {
        const store = useProfileReviewStore();

        const handleSetMinimalProfile = () => {
          const profile = createMockProfileData({
            overrides: {
              headline: undefined,
              location: undefined,
              about: undefined,
              avatarUrl: undefined,
            }
          });
          store.setExtractedProfile(profile, 'minimal-user');
        };

        return (
          <div>
            <button onClick={handleSetMinimalProfile}>Set Minimal Profile</button>
            {store.selection && (
              <div data-testid="selection">
                <div data-testid="headline-selected">{store.selection.headline ? 'yes' : 'no'}</div>
                <div data-testid="location-selected">{store.selection.location ? 'yes' : 'no'}</div>
                <div data-testid="about-selected">{store.selection.about ? 'yes' : 'no'}</div>
                <div data-testid="avatarUrl-selected">{store.selection.avatarUrl ? 'yes' : 'no'}</div>
              </div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<ProfileWithMissingFields />);

      // Click the button
      await user.click(screen.getByText('Set Minimal Profile'));

      // Missing fields should be false in selection
      expect(screen.getByTestId('headline-selected')).toHaveTextContent('no');
      expect(screen.getByTestId('location-selected')).toHaveTextContent('no');
      expect(screen.getByTestId('about-selected')).toHaveTextContent('no');
      expect(screen.getByTestId('avatarUrl-selected')).toHaveTextContent('no');
    });
  });

  describe('Selection Toggling', () => {
    it('should toggle individual field selections', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      // Initially headline is selected
      expect(screen.getByTestId('selection-headline')).toHaveTextContent('yes');

      // Toggle headline
      await user.click(screen.getByText('Toggle Headline'));
      expect(screen.getByTestId('selection-headline')).toHaveTextContent('no');

      // Toggle back
      await user.click(screen.getByText('Toggle Headline'));
      expect(screen.getByTestId('selection-headline')).toHaveTextContent('yes');
    });

    it('should toggle experience selections', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      const experiencesDiv = screen.getByTestId('selection-experiences');
      const initialExperiences = experiencesDiv.textContent;
      expect(initialExperiences).toContain('yes');

      // Toggle first experience
      await user.click(screen.getByText('Toggle Experience 0'));

      // First experience should be toggled
      const updatedExperiences = experiencesDiv.textContent;
      expect(updatedExperiences).toContain('no');
    });

    it('should toggle education selections', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      const educationDiv = screen.getByTestId('selection-education');
      const initialEducation = educationDiv.textContent;
      expect(initialEducation).toContain('yes');

      // Toggle first education
      await user.click(screen.getByText('Toggle Education 0'));

      // First education should be toggled
      const updatedEducation = educationDiv.textContent;
      expect(updatedEducation).toContain('no');
    });
  });

  describe('Section Selection', () => {
    it('should toggle entire basic info section', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      // Initially all basic info selected
      expect(screen.getByTestId('selection-headline')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-location')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-about')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-avatarUrl')).toHaveTextContent('yes');

      // Deselect all basic info
      await user.click(screen.getByText('Deselect Basic Info'));

      expect(screen.getByTestId('selection-headline')).toHaveTextContent('no');
      expect(screen.getByTestId('selection-location')).toHaveTextContent('no');
      expect(screen.getByTestId('selection-about')).toHaveTextContent('no');
      expect(screen.getByTestId('selection-avatarUrl')).toHaveTextContent('no');

      // Select all basic info
      await user.click(screen.getByText('Select Basic Info'));

      expect(screen.getByTestId('selection-headline')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-location')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-about')).toHaveTextContent('yes');
      expect(screen.getByTestId('selection-avatarUrl')).toHaveTextContent('yes');
    });

    it('should toggle all experiences section', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      const experiencesDiv = screen.getByTestId('selection-experiences');

      // Initially all selected
      expect(experiencesDiv.textContent).not.toContain('no');

      // Deselect all experiences
      await user.click(screen.getByText('Deselect All Experiences'));

      // All should be deselected
      expect(experiencesDiv.textContent).not.toContain('yes');
    });
  });

  describe('Onboarding Flow', () => {
    it('should manage onboarding steps', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Initially on step 1
      expect(screen.getByTestId('step')).toHaveTextContent('Step 1');
      expect(screen.getByTestId('interest')).toHaveTextContent('none');

      // Set interest (moves to step 2)
      await user.click(screen.getByText('Set Find Job'));

      expect(screen.getByTestId('step')).toHaveTextContent('Step 2');
      expect(screen.getByTestId('interest')).toHaveTextContent('find-job');

      // Go back to step 1 (keeps interest)
      await user.click(screen.getByText('Go Back'));

      expect(screen.getByTestId('step')).toHaveTextContent('Step 1');
      expect(screen.getByTestId('interest')).toHaveTextContent('find-job');
    });

    it('should handle different interests', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set find-job interest
      await user.click(screen.getByText('Set Find Job'));
      expect(screen.getByTestId('interest')).toHaveTextContent('find-job');

      // Change to grow-career
      await user.click(screen.getByText('Set Grow Career'));
      expect(screen.getByTestId('interest')).toHaveTextContent('grow-career');
    });
  });

  describe('Profile Saving', () => {
    it('should save profile successfully', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />, {
        handlers: [
          http.post('/api/onboarding/interest', () => {
            return HttpResponse.json({ success: true });
          }),
          http.post('/api/onboarding/save-profile', () => {
            return HttpResponse.json({ success: true });
          }),
          http.post('/api/onboarding/complete', () => {
            return HttpResponse.json({ success: true });
          }),
        ],
      });

      // Set up profile and interest
      await user.click(screen.getByText('Set Find Job'));
      await user.click(screen.getByText('Set Profile'));

      // Save profile
      await user.click(screen.getByText('Save Profile'));

      // Should show success after completion
      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
      });

      // Success should hide after 2 seconds
      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('no-success');
      }, { timeout: 3000 });
    });

    it('should handle save errors', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />, {
        handlers: [
          http.post('/api/onboarding/interest', () => {
            return HttpResponse.json(
              { error: 'Failed to save interest' },
              { status: 500 }
            );
          }),
        ],
      });

      // Set up profile and interest
      await user.click(screen.getByText('Set Find Job'));
      await user.click(screen.getByText('Set Profile'));

      // Try to save profile
      await user.click(screen.getByText('Save Profile'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toBeInTheDocument();
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('success')).toHaveTextContent('no-success');
    });

    it('should not save without required data', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Try to save without setting profile or interest
      await user.click(screen.getByText('Save Profile'));

      // Should show error
      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Missing required data');
      });
    });

    it('should filter profile data based on selection', async () => {
      let savedProfile: any = null;

      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />, {
        handlers: [
          http.post('/api/onboarding/interest', () => {
            return HttpResponse.json({ success: true });
          }),
          http.post('/api/onboarding/save-profile', async ({ request }) => {
            const body = await request.json();
            savedProfile = body;
            return HttpResponse.json({ success: true });
          }),
          http.post('/api/onboarding/complete', () => {
            return HttpResponse.json({ success: true });
          }),
        ],
      });

      // Set up profile and interest
      await user.click(screen.getByText('Set Find Job'));
      await user.click(screen.getByText('Set Profile'));

      // Deselect some fields
      await user.click(screen.getByText('Toggle Headline'));
      await user.click(screen.getByText('Toggle Experience 0'));

      // Save profile
      await user.click(screen.getByText('Save Profile'));

      await waitFor(() => {
        expect(screen.getByTestId('success')).toHaveTextContent('success');
      });

      // Check filtered data doesn't include deselected fields
      expect(savedProfile).toBeTruthy();
      expect(savedProfile.filteredData.headline).toBeUndefined();
      expect(savedProfile.filteredData.experiences).toHaveLength(1); // One was deselected
    });
  });

  describe('State Management', () => {
    it('should clear profile data', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set up data
      await user.click(screen.getByText('Set Find Job'));
      await user.click(screen.getByText('Set Profile'));

      expect(screen.getByTestId('has-profile')).toHaveTextContent('yes');

      // Clear profile using clearProfile (not full reset)
      act(() => {
        useProfileReviewStore.getState().clearProfile();
      });

      expect(screen.getByTestId('has-profile')).toHaveTextContent('no');
      expect(screen.getByTestId('username')).toHaveTextContent('none');
      // Interest should still be set (clearProfile doesn't reset onboarding state)
      expect(screen.getByTestId('interest')).toHaveTextContent('find-job');
    });

    it('should reset entire store state', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set up data
      await user.click(screen.getByText('Set Find Job'));
      await user.click(screen.getByText('Set Profile'));

      expect(screen.getByTestId('has-profile')).toHaveTextContent('yes');
      expect(screen.getByTestId('interest')).toHaveTextContent('find-job');
      expect(screen.getByTestId('step')).toHaveTextContent('Step 2');

      // Full reset
      await user.click(screen.getByText('Reset'));

      expect(screen.getByTestId('has-profile')).toHaveTextContent('no');
      expect(screen.getByTestId('username')).toHaveTextContent('none');
      expect(screen.getByTestId('interest')).toHaveTextContent('none');
      expect(screen.getByTestId('step')).toHaveTextContent('Step 1');
    });

    it('should handle loading and error states', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Initially not loading
      expect(screen.getByTestId('loading')).toHaveTextContent('idle');

      // Set loading
      act(() => {
        useProfileReviewStore.getState().setLoading(true);
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('loading');

      // Set error (should clear loading)
      act(() => {
        useProfileReviewStore.getState().setError('Test error');
      });

      expect(screen.getByTestId('loading')).toHaveTextContent('idle');
      expect(screen.getByTestId('error')).toHaveTextContent('Test error');
    });

    it('should update selection with partial updates', async () => {
      const { user } = renderWithProviders(<ProfileReviewStoreTestComponent />);

      // Set profile first
      await user.click(screen.getByText('Set Profile'));

      // Update multiple fields at once
      act(() => {
        useProfileReviewStore.getState().updateSelection({
          headline: false,
          location: false,
          about: true,
        });
      });

      expect(screen.getByTestId('selection-headline')).toHaveTextContent('no');
      expect(screen.getByTestId('selection-location')).toHaveTextContent('no');
      expect(screen.getByTestId('selection-about')).toHaveTextContent('yes');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty experiences and education arrays', async () => {
      const EmptyArraysComponent = () => {
        const store = useProfileReviewStore();

        const handleSetEmptyProfile = () => {
          const profile = createMockProfileData({
            overrides: {
              experiences: [],
              education: [],
            }
          });
          store.setExtractedProfile(profile, 'empty-user');
        };

        return (
          <div>
            <button onClick={handleSetEmptyProfile}>Set Empty Profile</button>
            {store.selection && (
              <div>
                <div data-testid="exp-length">{store.selection.experiences.length}</div>
                <div data-testid="edu-length">{store.selection.education.length}</div>
              </div>
            )}
          </div>
        );
      };

      const { user } = renderWithProviders(<EmptyArraysComponent />);

      await user.click(screen.getByText('Set Empty Profile'));

      expect(screen.getByTestId('exp-length')).toHaveTextContent('0');
      expect(screen.getByTestId('edu-length')).toHaveTextContent('0');
    });

    it('should handle operations on null selection gracefully', () => {
      const NullSelectionComponent = () => {
        const store = useProfileReviewStore();

        const handleToggleWithoutProfile = () => {
          // Try to toggle without setting profile first
          store.toggleSelection('headline', false);
          store.toggleExperience(0, false);
          store.toggleEducation(0, false);
          store.toggleSectionSelection('basicInfo', false);
        };

        return (
          <div>
            <button onClick={handleToggleWithoutProfile}>Toggle Without Profile</button>
            <div data-testid="selection-exists">{store.selection ? 'yes' : 'no'}</div>
          </div>
        );
      };

      const { user } = renderWithProviders(<NullSelectionComponent />);

      // Should not crash when toggling without selection
      act(() => {
        user.click(screen.getByText('Toggle Without Profile'));
      });

      expect(screen.getByTestId('selection-exists')).toHaveTextContent('no');
    });
  });
});