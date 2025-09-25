import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Loader2, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useAuthStore } from '../stores/auth-store';
import { useProfileReviewStore } from '../stores/profile-review-store';
// Helper function to get user-friendly error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message;
    // Check if it looks like a technical error code
    if (
      message.match(/^[A-Z_]+$/) ||
      message.includes('_ERROR') ||
      message.includes('_TOKEN')
    ) {
      return 'Failed to save profile data. Please try again.';
    }
    return message;
  }
  return 'Failed to save profile data. Please try again.';
};

// Helper function to check if an experience is current
const isCurrentExperience = (experience: any): boolean => {
  return (
    !experience.end ||
    experience.end === 'Present' ||
    experience.current === true
  );
};

export default function ProfileReview() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { completeOnboarding } = useAuthStore();
  const { theme } = useTheme();
  const {
    extractedProfile: profile,
    selection,
    showSuccess,
    error,
    toggleExperience,
    toggleEducation,
    toggleSectionSelection,
    setShowSuccess,
    saveProfile,
    clearProfile,
  } = useProfileReviewStore();

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      await saveProfile(completeOnboarding);
    },
    onSuccess: () => {
      toast({
        title: 'Profile saved successfully!',
        description: 'Your professional journey is ready to explore.',
      });
    },
    onError: (error) => {
      console.error('Error saving profile:', error);
      toast({
        title: 'Save Failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (!profile) {
      toast({
        title: 'No Profile Data',
        description: 'Please extract a profile first.',
        variant: 'destructive',
      });
      clearProfile();
    }
  }, [profile, toast, clearProfile]);

  useEffect(() => {
    if (error) {
      toast({
        title: 'Error',
        description: error,
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  const handleSaveProfile = async () => {
    await saveProfileMutation.mutateAsync();
  };

  // Handle viewing matches for current experiences
  const handleViewMatches = (experience: any) => {
    // Build search query from experience
    const title =
      typeof experience.title === 'object'
        ? experience.title.name
        : experience.title;
    const searchQuery =
      experience.description || title || `${title} at ${experience.company}`;

    // Navigate to search page with the query
    setLocation(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const getSelectedCount = () => {
    if (!selection) return 0;

    let count = 0;
    if (selection.name) count++;
    if (selection.headline) count++;
    if (selection.location) count++;
    if (selection.about) count++;
    if (selection.avatarUrl) count++;
    count += selection.experiences.filter(Boolean).length;
    count += selection.education.filter(Boolean).length;

    return count;
  };

  const getTotalCount = () => {
    if (!profile) return 0;

    let count = 1; // name is always present
    if (profile.headline) count++;
    if (profile.location) count++;
    if (profile.about) count++;
    if (profile.avatarUrl) count++;
    count += profile.experiences.length;
    count += profile.education.length;

    return count;
  };

  const handleSectionToggle = (
    section: 'basicInfo' | 'experiences' | 'education',
    checked: boolean
  ) => {
    toggleSectionSelection(section, checked);
  };

  if (showSuccess) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center p-4 ${theme.backgroundGradient} relative`}
      >
        <motion.div
          className="relative z-10 mx-auto max-w-md text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card
            className={`${theme.cardBackground} border backdrop-blur-xl ${theme.primaryBorder} ${theme.cardShadow}`}
          >
            <CardContent className="space-y-6 p-8">
              <motion.div
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gray-300 bg-gray-100"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Check className="h-8 w-8 text-[#2E2E2E]" />
              </motion.div>
              <div className="space-y-2">
                <h2 className={`text-2xl font-semibold ${theme.primaryText}`}>
                  Profile Saved!
                </h2>
                <p className={theme.secondaryText}>
                  The selected profile data has been successfully saved to your
                  database.
                </p>
              </div>
              <div className="flex space-x-4">
                <Button
                  onClick={() => {
                    // Hide success screen and let AuthenticatedApp show ProfessionalJourney
                    setShowSuccess(false);
                  }}
                  className="flex-1 border-0 bg-[#10B981] text-white hover:bg-[#059669]"
                >
                  View Journey
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (!profile || !selection) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${theme.backgroundGradient}`}
      >
        <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.backgroundGradient} relative`}>
      {/* Header */}
      <div
        className={`relative z-10 ${theme.cardBackground} border-b backdrop-blur-sm ${theme.primaryBorder}`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Clear extracted profile to go back to step 2
                  clearProfile();
                }}
                className={`${theme.secondaryText} hover:bg-emerald-500/10 hover:text-[#10B981]`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-white">
                  Review Profile Data
                </h1>
                <p className={`text-sm ${theme.secondaryText}`}>
                  Select the information you want to save
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${theme.secondaryText}`}>
                {getSelectedCount()} of {getTotalCount()} fields selected
              </span>
              <Button
                onClick={handleSaveProfile}
                disabled={saveProfileMutation.isPending}
                className="border-0 bg-[#10B981] text-white hover:bg-[#059669]"
              >
                {saveProfileMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          className="space-y-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* Basic Information */}
          <Card
            className={`${theme.cardBackground} border backdrop-blur-xl ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}
          >
            <div className={`border-b px-6 py-4 ${theme.primaryBorder}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  Basic Information
                </h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={
                      selection.headline &&
                      selection.location &&
                      selection.about &&
                      selection.avatarUrl
                    }
                    onCheckedChange={(checked) =>
                      handleSectionToggle('basicInfo', checked as boolean)
                    }
                    className={`${theme.primaryBorder} data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                  />
                  <span className={`text-sm ${theme.secondaryText}`}>
                    Select all
                  </span>
                </div>
              </div>
            </div>
            <CardContent className="space-y-4 p-6">
              {/* Name - always required */}
              <div className="flex items-start space-x-3 rounded-lg py-2 transition-colors hover:bg-emerald-500/5">
                <Checkbox
                  checked
                  disabled
                  className={`${theme.primaryBorder} opacity-50 data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <label
                      className={`text-sm font-medium ${theme.secondaryText}`}
                    >
                      Full Name
                    </label>
                    <span className={`text-xs text-[#10B981]`}>Required</span>
                  </div>
                  <p className={`${theme.primaryText} mt-1 font-medium`}>
                    {profile.name}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Experience Section */}
          {profile.experiences.length > 0 && (
            <Card
              className={`${theme.cardBackground} border backdrop-blur-xl ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}
            >
              <div className={`border-b px-6 py-4 ${theme.primaryBorder}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Work Experience
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selection.experiences.every(Boolean)}
                      onCheckedChange={(checked) =>
                        handleSectionToggle('experiences', checked as boolean)
                      }
                      className={`${theme.primaryBorder} data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                    />
                    <span className={`text-sm ${theme.secondaryText}`}>
                      Select all
                    </span>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-6 p-6">
                {profile.experiences.map((experience, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 rounded-lg p-2 transition-colors hover:bg-emerald-500/5"
                  >
                    <Checkbox
                      checked={selection.experiences[index]}
                      onCheckedChange={(checked) =>
                        toggleExperience(index, checked as boolean)
                      }
                      className={`${theme.primaryBorder} hover:border-emerald-400 data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${theme.primaryText}`}>
                          {typeof experience.title === 'object'
                            ? experience.title.name
                            : experience.title || 'Position'}
                        </h4>
                        {isCurrentExperience(experience) && (
                          <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 text-xs text-[#10B981]">
                            Current
                          </span>
                        )}
                      </div>
                      <p className={`font-medium text-[#10B981]`}>
                        {experience.company}
                      </p>
                      {experience.start && (
                        <p className={`text-sm ${theme.secondaryText}`}>
                          {experience.start} - {experience.end || 'Present'}
                        </p>
                      )}
                      {experience.description && (
                        <p className="mt-2 text-sm text-slate-300">
                          {experience.description}
                        </p>
                      )}
                      {/* View Matches button for current experiences */}
                      {isCurrentExperience(experience) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewMatches(experience)}
                          className="mt-3 text-[#10B981] hover:bg-emerald-500/10 hover:text-[#059669]"
                        >
                          <Search className="mr-2 h-4 w-4" />
                          View Matches
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Education Section */}
          {profile.education.length > 0 && (
            <Card
              className={`${theme.cardBackground} border backdrop-blur-xl ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}
            >
              <div className={`border-b px-6 py-4 ${theme.primaryBorder}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">
                    Education
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selection.education.every(Boolean)}
                      onCheckedChange={(checked) =>
                        handleSectionToggle('education', checked as boolean)
                      }
                      className={`${theme.primaryBorder} data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                    />
                    <span className={`text-sm ${theme.secondaryText}`}>
                      Select all
                    </span>
                  </div>
                </div>
              </div>
              <CardContent className="space-y-4 p-6">
                {profile.education.map((edu, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 rounded-lg p-2 transition-colors hover:bg-emerald-500/5"
                  >
                    <Checkbox
                      checked={selection.education[index]}
                      onCheckedChange={(checked) =>
                        toggleEducation(index, checked as boolean)
                      }
                      className={`${theme.primaryBorder} hover:border-emerald-400 data-[state=checked]:border-[#10B981] data-[state=checked]:bg-[#10B981]`}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-semibold ${theme.primaryText}`}>
                        {edu.school}
                      </h4>
                      {edu.degree && (
                        <p className={theme.secondaryText}>{edu.degree}</p>
                      )}
                      {edu.field && (
                        <p className={theme.secondaryText}>{edu.field}</p>
                      )}
                      {edu.start && (
                        <p className={`text-sm ${theme.secondaryText}`}>
                          {edu.start} - {edu.end || 'Present'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Skills section removed - skills are no longer extracted */}
        </motion.div>
      </div>
    </div>
  );
}
