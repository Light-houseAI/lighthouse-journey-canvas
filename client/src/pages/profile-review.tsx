import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md mx-auto text-center">
          <Card className="shadow-xl">
            <CardContent className="p-8 space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-gray-900">Profile Saved!</h2>
                <p className="text-gray-600">
                  The selected profile data has been successfully saved to your database.
                </p>
              </div>
              <div className="flex space-x-4">
                <Button 
                  onClick={() => setLocation('/')}
                  className="flex-1"
                >
                  Extract Another
                </Button>
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => setLocation('/')}
                >
                  View Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile || !selection) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/')}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Review Profile Data</h1>
                <p className="text-sm text-gray-500">Select the information you want to save</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {getSelectedCount()} of {getTotalCount()} fields selected
              </span>
              <Button 
                onClick={() => saveProfileMutation.mutate()}
                disabled={saveProfileMutation.isPending}
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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          
          {/* Profile Summary Card */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="p-6 text-center space-y-4">
                {profile.avatarUrl && (
                  <img 
                    src={profile.avatarUrl} 
                    alt="Profile avatar" 
                    className="w-20 h-20 rounded-full mx-auto object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                  {profile.headline && (
                    <p className="text-sm text-gray-600">{profile.headline}</p>
                  )}
                  {profile.location && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center justify-center">
                      <MapPin className="mr-1 h-3 w-3" />
                      {profile.location}
                    </p>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Experiences:</span>
                    <span className="font-medium">{profile.experiences.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Education:</span>
                    <span className="font-medium">{profile.education.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Skills:</span>
                    <span className="font-medium">{profile.skills.length}</span>
                  </div>

                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            
            {/* Basic Information */}
            <Card>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selection.headline && selection.location && selection.about && selection.avatarUrl}
                      onCheckedChange={(checked) => handleSectionToggle('basicInfo', checked as boolean)}
                    />
                    <span className="text-sm text-gray-600">Select all</span>
                  </div>
                </div>
              </div>
              <CardContent className="p-6 space-y-4">
                {/* Name - always required */}
                <div className="flex items-start space-x-3 py-2">
                  <Checkbox checked disabled />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Full Name</label>
                      <span className="text-xs text-gray-500">Required</span>
                    </div>
                    <p className="text-gray-900 mt-1">{profile.name}</p>
                  </div>
                </div>
                
                {profile.headline && (
                  <div className="flex items-start space-x-3 py-2">
                    <Checkbox
                      checked={selection.headline}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, headline: checked as boolean} : prev)}
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-gray-700">Professional Headline</label>
                      <p className="text-gray-900 mt-1">{profile.headline}</p>
                    </div>
                  </div>
                )}
                
                {profile.location && (
                  <div className="flex items-start space-x-3 py-2">
                    <Checkbox
                      checked={selection.location}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, location: checked as boolean} : prev)}
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-gray-700">Location</label>
                      <p className="text-gray-900 mt-1">{profile.location}</p>
                    </div>
                  </div>
                )}
                
                {profile.about && (
                  <div className="flex items-start space-x-3 py-2">
                    <Checkbox
                      checked={selection.about}
                      onCheckedChange={(checked) => setSelection(prev => prev ? {...prev, about: checked as boolean} : prev)}
                    />
                    <div className="flex-1 min-w-0">
                      <label className="text-sm font-medium text-gray-700">About Section</label>
                      <p className="text-gray-900 mt-1 line-clamp-3">{profile.about}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Experience Section */}
            {profile.experiences.length > 0 && (
              <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Work Experience</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.experiences.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('experiences', checked as boolean)}
                      />
                      <span className="text-sm text-gray-600">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-6">
                  {profile.experiences.map((experience, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Checkbox
                        checked={selection.experiences[index]}
                        onCheckedChange={(checked) => setSelection(prev => {
                          if (!prev) return prev;
                          const newExperiences = [...prev.experiences];
                          newExperiences[index] = checked as boolean;
                          return {...prev, experiences: newExperiences};
                        })}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">
                          {typeof experience.title === 'string' ? experience.title : experience.title?.name || 'Position'}
                        </h4>
                        <p className="text-primary font-medium">{experience.company}</p>
                        {experience.start && (
                          <p className="text-sm text-gray-500">
                            {experience.start} - {experience.end || 'Present'}
                          </p>
                        )}
                        {experience.description && (
                          <p className="text-gray-700 mt-2 text-sm">{experience.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            
            {/* Education Section */}
            {profile.education.length > 0 && (
              <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Education</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.education.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('education', checked as boolean)}
                      />
                      <span className="text-sm text-gray-600">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-4">
                  {profile.education.map((edu, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Checkbox
                        checked={selection.education[index]}
                        onCheckedChange={(checked) => setSelection(prev => {
                          if (!prev) return prev;
                          const newEducation = [...prev.education];
                          newEducation[index] = checked as boolean;
                          return {...prev, education: newEducation};
                        })}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900">{edu.school}</h4>
                        {edu.degree && <p className="text-gray-700">{edu.degree}</p>}
                        {edu.field && <p className="text-gray-700">{edu.field}</p>}
                        {edu.start && (
                          <p className="text-sm text-gray-500">
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
              <Card>
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Skills</h3>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={selection.skills.every(Boolean)}
                        onCheckedChange={(checked) => handleSectionToggle('skills', checked as boolean)}
                      />
                      <span className="text-sm text-gray-600">Select all</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {profile.skills.map((skill, index) => (
                      <label key={index} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <Checkbox
                          checked={selection.skills[index]}
                          onCheckedChange={(checked) => setSelection(prev => {
                            if (!prev) return prev;
                            const newSkills = [...prev.skills];
                            newSkills[index] = checked as boolean;
                            return {...prev, skills: newSkills};
                          })}
                        />
                        <span className="text-gray-900">{skill}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            
          </div>
        </div>
      </div>
    </div>
  );
}
