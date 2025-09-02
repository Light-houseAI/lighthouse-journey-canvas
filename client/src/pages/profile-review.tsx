import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth-store";
import { useProfileReviewStore } from "@/stores/profile-review-store";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, MapPin, Loader2, Check } from "lucide-react";
// Helper function to get user-friendly error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message;
    // Check if it looks like a technical error code
    if (message.match(/^[A-Z_]+$/) || message.includes('_ERROR') || message.includes('_TOKEN')) {
      return "Failed to save profile data. Please try again.";
    }
    return message;
  }
  return "Failed to save profile data. Please try again.";
};

export default function ProfileReview() {
  const { toast } = useToast();
  const { completeOnboarding } = useAuthStore();
  const { theme } = useTheme();
  const {
    extractedProfile: profile,
    username,
    selection,
    showSuccess,
    isLoading,
    error,
    toggleSelection,
    toggleExperience,
    toggleEducation,
    toggleSectionSelection,
    setShowSuccess,
    saveProfile,
    clearProfile
  } = useProfileReviewStore();

  useEffect(() => {
    // Check if we need to redirect back to step 2 if no profile data exists
    if (!profile) {
      toast({
        title: "No Profile Data",
        description: "Please extract a profile first.",
        variant: "destructive",
      });
      clearProfile();
    }
  }, [profile, toast, clearProfile]);

  // Show error toast when error occurs
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleSaveProfile = async () => {
    try {
      await saveProfile(completeOnboarding);
      toast({
        title: "Profile saved successfully!",
        description: "Your professional journey is ready to explore.",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Save Failed",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
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

  const handleSectionToggle = (section: 'basicInfo' | 'experiences' | 'education', checked: boolean) => {
    toggleSectionSelection(section, checked);
  };

  if (showSuccess) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${theme.backgroundGradient} relative`}>


        <motion.div
          className="max-w-md mx-auto text-center relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className={`${theme.cardBackground} backdrop-blur-xl border ${theme.primaryBorder} ${theme.cardShadow}`}>
            <CardContent className="p-8 space-y-6">
              <motion.div
                className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto border border-gray-300"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Check className="h-8 w-8 text-[#2E2E2E]" />
              </motion.div>
              <div className="space-y-2">
                <h2 className={`text-2xl font-semibold ${theme.primaryText}`}>Profile Saved!</h2>
                <p className={theme.secondaryText}>
                  The selected profile data has been successfully saved to your database.
                </p>
              </div>
              <div className="flex space-x-4">
                <Button
                  onClick={() => {
                    // Hide success screen and let AuthenticatedApp show ProfessionalJourney
                    setShowSuccess(false);
                  }}
                  className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white border-0"
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
      <div className={`min-h-screen flex items-center justify-center ${theme.backgroundGradient}`}>
        <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.backgroundGradient} relative`}>


      {/* Header */}
      <div className={`relative z-10 ${theme.cardBackground} backdrop-blur-sm border-b ${theme.primaryBorder}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Clear extracted profile to go back to step 2
                  clearProfile();
                }}
                className={`${theme.secondaryText} hover:text-[#10B981] hover:bg-emerald-500/10`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-white">Review Profile Data</h1>
                <p className={`text-sm ${theme.secondaryText}`}>Select the information you want to save</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`text-sm ${theme.secondaryText}`}>
                {getSelectedCount()} of {getTotalCount()} fields selected
              </span>
              <Button
                onClick={handleSaveProfile}
                disabled={isLoading}
                className="bg-[#10B981] hover:bg-[#059669] text-white border-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">

          {/* Profile Summary Card */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className={`sticky top-8 ${theme.cardBackground} backdrop-blur-xl border ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}>
                <CardContent className="p-6 text-center space-y-4">
                  {profile.avatarUrl && (
                    <div className="relative">
                      <img
                        src={profile.avatarUrl}
                        alt="Profile avatar"
                        className={`w-20 h-20 rounded-full mx-auto object-cover border-2 ${theme.primaryBorder}`}
                      />
                      <div className="absolute inset-0 w-20 h-20 rounded-full mx-auto bg-gradient-to-r from-emerald-500/20 to-cyan-500/20"></div>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white">{profile.name}</h3>
                    {profile.headline && (
                      <p className={`text-sm ${theme.secondaryText}`}>{profile.headline}</p>
                    )}
                    {profile.location && (
                      <p className={`text-sm text-[#10B981] mt-1 flex items-center justify-center`}>
                        <MapPin className="mr-1 h-3 w-3" />
                        {profile.location}
                      </p>
                    )}
                  </div>

                  <Separator className={theme.primaryBorder} />

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className={theme.secondaryText}>Experiences:</span>
                      <span className={`font-medium text-[#10B981]`}>{profile.experiences.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className={theme.secondaryText}>Education:</span>
                      <span className={`font-medium text-[#10B981]`}>{profile.education.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Main Content */}
          <motion.div
            className="lg:col-span-3 space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >

            {/* Basic Information */}
            <Card className={`${theme.cardBackground} backdrop-blur-xl border ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}>
              <div className={`px-6 py-4 border-b ${theme.primaryBorder}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Basic Information</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selection.headline && selection.location && selection.about && selection.avatarUrl}
                      onCheckedChange={(checked) => handleSectionToggle('basicInfo', checked as boolean)}
                      className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981]`}
                    />
                    <span className={`text-sm ${theme.secondaryText}`}>Select all</span>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {/* Name - always required */}
                <div className="flex items-start space-x-3 py-2 hover:bg-emerald-500/5 rounded-lg transition-colors">
                  <Checkbox
                    checked
                    disabled
                    className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981] opacity-50`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className={`text-sm font-medium ${theme.secondaryText}`}>Full Name</label>
                      <span className={`text-xs text-[#10B981]`}>Required</span>
                    </div>
                    <p className={`${theme.primaryText} mt-1 font-medium`}>{profile.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Experience Section */}
            {profile.experiences.length > 0 && (
              <Card className={`${theme.cardBackground} backdrop-blur-xl border ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}>
                <div className={`px-6 py-4 border-b ${theme.primaryBorder}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Work Experience</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.experiences.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('experiences', checked as boolean)}
                        className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981]`}
                      />
                      <span className={`text-sm ${theme.secondaryText}`}>Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-6">
                  {profile.experiences.map((experience, index) => (
                    <div key={index} className="flex items-start space-x-3 hover:bg-emerald-500/5 rounded-lg transition-colors p-2">
                      <Checkbox
                        checked={selection.experiences[index]}
                        onCheckedChange={(checked) => toggleExperience(index, checked as boolean)}
                        className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981] hover:border-emerald-400`}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold ${theme.primaryText}`}>
                          {experience.title || 'Position'}
                        </h4>
                        <p className={`text-[#10B981] font-medium`}>{experience.company}</p>
                        {experience.start && (
                          <p className={`text-sm ${theme.secondaryText}`}>
                            {experience.start} - {experience.end || 'Present'}
                          </p>
                        )}
                        {experience.description && (
                          <p className="text-slate-300 mt-2 text-sm">{experience.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Education Section */}
            {profile.education.length > 0 && (
              <Card className={`${theme.cardBackground} backdrop-blur-xl border ${theme.primaryBorder} shadow-xl shadow-emerald-500/10`}>
                <div className={`px-6 py-4 border-b ${theme.primaryBorder}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Education</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.education.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('education', checked as boolean)}
                        className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981]`}
                      />
                      <span className={`text-sm ${theme.secondaryText}`}>Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  {profile.education.map((edu, index) => (
                    <div key={index} className="flex items-start space-x-3 hover:bg-emerald-500/5 rounded-lg transition-colors p-2">
                      <Checkbox
                        checked={selection.education[index]}
                        onCheckedChange={(checked) => toggleEducation(index, checked as boolean)}
                        className={`${theme.primaryBorder} data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981] hover:border-emerald-400`}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className={`font-semibold ${theme.primaryText}`}>{edu.school}</h4>
                        {edu.degree && <p className={theme.secondaryText}>{edu.degree}</p>}
                        {edu.field && <p className={theme.secondaryText}>{edu.field}</p>}
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
    </div>
  );
}
