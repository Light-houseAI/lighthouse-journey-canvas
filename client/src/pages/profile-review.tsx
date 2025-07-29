import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type ProfileData, type InsertProfile } from "@shared/schema";
import { ArrowLeft, MapPin, Loader2, Check } from "lucide-react";

interface SelectionState {
  name: boolean;
  headline: boolean;
  location: boolean;
  about: boolean;
  avatarUrl: boolean;
  experiences: boolean[];
  education: boolean[];
  skills: boolean[];

}

export default function ProfileReview() {
  const [, setLocation] = useLocation();
  const { username } = useParams<{ username: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const storedProfile = sessionStorage.getItem('extractedProfile');
    const storedUsername = sessionStorage.getItem('profileUsername');

    if (!storedProfile || !storedUsername || storedUsername !== username) {
      toast({
        title: "No Profile Data",
        description: "Please extract a profile first.",
        variant: "destructive",
      });
      setLocation('/onboarding/step2');
      return;
    }

    try {
      const profileData: ProfileData = JSON.parse(storedProfile);
      setProfile(profileData);

      // Initialize selection state - all items selected by default
      setSelection({
        name: true,
        headline: Boolean(profileData.headline),
        location: Boolean(profileData.location),
        about: Boolean(profileData.about),
        avatarUrl: Boolean(profileData.avatarUrl),
        experiences: profileData.experiences.map(() => true),
        education: profileData.education.map(() => true),
        skills: profileData.skills.map(() => true),

      });
    } catch (error) {
      toast({
        title: "Invalid Profile Data",
        description: "Failed to parse profile data.",
        variant: "destructive",
      });
      setLocation('/');
    }
  }, [username, setLocation, toast]);

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      if (!profile || !selection) {
        throw new Error("Missing required data");
      }

      // Create filtered profile data based on selection
      const filteredProfile: ProfileData = {
        name: profile.name, // Name is always required
        headline: selection.headline ? profile.headline : undefined,
        location: selection.location ? profile.location : undefined,
        about: selection.about ? profile.about : undefined,
        avatarUrl: selection.avatarUrl ? profile.avatarUrl : undefined,
        experiences: profile.experiences.filter((_, index) => selection.experiences[index]),
        education: profile.education.filter((_, index) => selection.education[index]),
        skills: profile.skills.filter((_, index) => selection.skills[index]),

      };

      const saveData: InsertProfile = {
        username,
        rawData: profile,
        filteredData: filteredProfile,
      };

      const response = await apiRequest("POST", "/api/save-profile", saveData);
      return response.json();
    },
    onSuccess: async () => {
      // DO NOT complete onboarding here - let the chat conversation handle that

      // Clear session storage
      sessionStorage.removeItem('extractedProfile');
      sessionStorage.removeItem('profileUsername');

      // Show success state
      setShowSuccess(true);

      // Invalidate auth query to refresh user state
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });

      // Redirect to professional journey after a short delay
      setTimeout(() => {
        setLocation("/professional-journey");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save profile data",
        variant: "destructive",
      });
    },
  });

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
    count += selection.skills.filter(Boolean).length;


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
    count += profile.skills.length;


    return count;
  };

  const handleSectionToggle = (section: string, checked: boolean) => {
    if (!selection) return;

    setSelection(prev => {
      if (!prev) return prev;

      switch (section) {
        case 'basicInfo':
          return {
            ...prev,
            headline: checked && Boolean(profile?.headline),
            location: checked && Boolean(profile?.location),
            about: checked && Boolean(profile?.about),
            avatarUrl: checked && Boolean(profile?.avatarUrl),
          };
        case 'experiences':
          return {
            ...prev,
            experiences: prev.experiences.map(() => checked),
          };
        case 'education':
          return {
            ...prev,
            education: prev.education.map(() => checked),
          };
        case 'skills':
          return {
            ...prev,
            skills: prev.skills.map(() => checked),
          };

        default:
          return prev;
      }
    });
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
        {/* Starfield background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="stars"></div>
          <div className="stars2"></div>
          <div className="stars3"></div>
        </div>

        <motion.div
          className="max-w-md mx-auto text-center relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-2xl shadow-purple-500/20">
            <CardContent className="p-8 space-y-6">
              <motion.div
                className="w-16 h-16 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mx-auto border border-purple-400/30"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <Check className="h-8 w-8 text-purple-300" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">Profile Saved!</h2>
                <p className="text-slate-300">
                  The selected profile data has been successfully saved to your database.
                </p>
              </div>
              <div className="flex space-x-4">
                <Button
                  onClick={() => setLocation('/onboarding/step2')}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0"
                >
                  Extract Another
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-purple-400/30 text-purple-300 hover:bg-purple-500/10"
                  onClick={() => setLocation('/professional-journey')}
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative">
      {/* Starfield background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars"></div>
        <div className="stars2"></div>
        <div className="stars3"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-slate-800/20 backdrop-blur-sm border-b border-purple-400/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/onboarding/step2')}
                className="text-slate-400 hover:text-purple-300 hover:bg-purple-500/10"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-white">Review Profile Data</h1>
                <p className="text-sm text-slate-300">Select the information you want to save</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-300">
                {getSelectedCount()} of {getTotalCount()} fields selected
              </span>
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white border-0 shadow-lg hover:shadow-purple-500/25"
              >
                {saveProfileMutation.isPending ? (
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
              <Card className="sticky top-8 bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-xl shadow-purple-500/10">
                <CardContent className="p-6 text-center space-y-4">
                  {profile.avatarUrl && (
                    <div className="relative">
                      <img
                        src={profile.avatarUrl}
                        alt="Profile avatar"
                        className="w-20 h-20 rounded-full mx-auto object-cover border-2 border-purple-400/30"
                      />
                      <div className="absolute inset-0 w-20 h-20 rounded-full mx-auto bg-gradient-to-r from-purple-500/20 to-pink-500/20"></div>
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white">{profile.name}</h3>
                    {profile.headline && (
                      <p className="text-sm text-slate-300">{profile.headline}</p>
                    )}
                    {profile.location && (
                      <p className="text-sm text-purple-300 mt-1 flex items-center justify-center">
                        <MapPin className="mr-1 h-3 w-3" />
                        {profile.location}
                      </p>
                    )}
                  </div>

                  <Separator className="bg-purple-400/20" />

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Experiences:</span>
                      <span className="font-medium text-purple-300">{profile.experiences.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Education:</span>
                      <span className="font-medium text-purple-300">{profile.education.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Skills:</span>
                      <span className="font-medium text-purple-300">{profile.skills.length}</span>
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
            <Card className="bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-xl shadow-purple-500/10">
              <div className="px-6 py-4 border-b border-purple-400/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Basic Information</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selection.headline && selection.location && selection.about && selection.avatarUrl}
                      onCheckedChange={(checked) => handleSectionToggle('basicInfo', checked as boolean)}
                      className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500"
                    />
                    <span className="text-sm text-slate-400">Select all</span>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {/* Name - always required */}
                <div className="flex items-start space-x-3 py-2 hover:bg-purple-500/5 rounded-lg transition-colors">
                  <Checkbox
                    checked
                    disabled
                    className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 opacity-50"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Full Name</label>
                      <span className="text-xs text-purple-400">Required</span>
                    </div>
                    <p className="text-slate-100 mt-1 font-medium">{profile.name}</p>
                  </div>
                </div>

                {profile.headline && (
                  <div className="flex items-start space-x-3 py-2 hover:bg-purple-500/5 rounded-lg transition-colors">
                    <Checkbox
                      checked={selection.headline}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, headline: checked as boolean} : prev)}
                      className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-slate-300">Professional Headline</label>
                      <p className="text-slate-100 mt-1">{profile.headline}</p>
                    </div>
                  </div>
                )}

                {profile.location && (
                  <div className="flex items-start space-x-3 py-2 hover:bg-purple-500/5 rounded-lg transition-colors">
                    <Checkbox
                      checked={selection.location}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, location: checked as boolean} : prev)}
                      className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-slate-300">Location</label>
                      <p className="text-slate-100 mt-1">{profile.location}</p>
                    </div>
                  </div>
                )}

                {profile.about && (
                  <div className="flex items-start space-x-3 py-2 hover:bg-purple-500/5 rounded-lg transition-colors">
                    <Checkbox
                      checked={selection.about}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, about: checked as boolean} : prev)}
                      className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-slate-300">About Section</label>
                      <p className="text-slate-100 mt-1 line-clamp-3">{profile.about}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Experience Section */}
            {profile.experiences.length > 0 && (
              <Card className="bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-xl shadow-purple-500/10">
                <div className="px-6 py-4 border-b border-purple-400/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Work Experience</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.experiences.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('experiences', checked as boolean)}
                        className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500"
                      />
                      <span className="text-sm text-slate-400">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-6">
                  {profile.experiences.map((experience, index) => (
                    <div key={index} className="flex items-start space-x-3 hover:bg-purple-500/5 rounded-lg transition-colors p-2">
                      <Checkbox
                        checked={selection.experiences[index]}
                        onCheckedChange={(checked) => setSelection(prev => {
                          if (!prev) return prev;
                          const newExperiences = [...prev.experiences];
                          newExperiences[index] = checked as boolean;
                          return {...prev, experiences: newExperiences};
                        })}
                        className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-100">
                          {experience.title.name || experience.title || 'Position'}
                        </h4>
                        <p className="text-purple-300 font-medium">{experience.company}</p>
                        {experience.start && (
                          <p className="text-sm text-slate-400">
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
              <Card className="bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-xl shadow-purple-500/10">
                <div className="px-6 py-4 border-b border-purple-400/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Education</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.education.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('education', checked as boolean)}
                        className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500"
                      />
                      <span className="text-sm text-slate-400">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  {profile.education.map((edu, index) => (
                    <div key={index} className="flex items-start space-x-3 hover:bg-purple-500/5 rounded-lg transition-colors p-2">
                      <Checkbox
                        checked={selection.education[index]}
                        onCheckedChange={(checked) => setSelection(prev => {
                          if (!prev) return prev;
                          const newEducation = [...prev.education];
                          newEducation[index] = checked as boolean;
                          return {...prev, education: newEducation};
                        })}
                        className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-100">{edu.school}</h4>
                        {edu.degree && <p className="text-slate-300">{edu.degree}</p>}
                        {edu.field && <p className="text-slate-300">{edu.field}</p>}
                        {edu.start && (
                          <p className="text-sm text-slate-400">
                            {edu.start} - {edu.end || 'Present'}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Skills Section */}
            {profile.skills.length > 0 && (
              <Card className="bg-slate-800/40 backdrop-blur-xl border border-purple-400/30 shadow-xl shadow-purple-500/10">
                <div className="px-6 py-4 border-b border-purple-400/20">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Skills</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.skills.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('skills', checked as boolean)}
                        className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500"
                      />
                      <span className="text-sm text-slate-400">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {profile.skills.map((skill, index) => (
                      <label key={index} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-purple-500/5 cursor-pointer transition-colors">
                        <Checkbox
                          checked={selection.skills[index]}
                          onCheckedChange={(checked) => setSelection(prev => {
                            if (!prev) return prev;
                            const newSkills = [...prev.skills];
                            newSkills[index] = checked as boolean;
                            return {...prev, skills: newSkills};
                          })}
                          className="border-purple-400/50 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-500 hover:border-purple-400"
                        />
                        <span className="text-slate-100">{skill}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
