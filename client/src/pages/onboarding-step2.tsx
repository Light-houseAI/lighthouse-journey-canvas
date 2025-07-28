import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { usernameInputSchema, type UsernameInput } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft } from "lucide-react";

export default function OnboardingStep2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isExtracting, setIsExtracting] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string>("");

  const handleBackToStep1 = () => {
    // Navigate back to Step 1, preserving user state
    setLocation("/onboarding/step1");
  };

  // Function to extract username from LinkedIn URL
  const extractUsernameFromUrl = (input: string): string => {
    // Remove leading/trailing whitespace
    const trimmed = input.trim();
    
    // Check if it's a full LinkedIn URL
    const linkedinUrlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^\/\?#]+)/i);
    if (linkedinUrlMatch) {
      return linkedinUrlMatch[1];
    }
    
    // Return the original input if no URL pattern found
    return trimmed;
  };

  // Function to validate username format
  const validateUsernameFormat = (username: string): string => {
    if (!username) return "";
    
    // Check if it contains spaces or looks like a full name
    if (username.includes(' ') || /^[A-Z][a-z]+ [A-Z][a-z]+/.test(username)) {
      return "This doesn't look like a LinkedIn username. Please enter the part after linkedin.com/in/.";
    }
    
    // Check if it still looks like a URL
    if (username.includes('linkedin.com') || username.includes('http')) {
      return "This doesn't look like a LinkedIn username. Please enter the part after linkedin.com/in/.";
    }
    
    return "";
  };

  const form = useForm<UsernameInput>({
    resolver: zodResolver(usernameInputSchema),
    defaultValues: {
      username: "",
    },
  });

  // Watch for changes in the username field
  const watchedUsername = form.watch("username");
  
  useEffect(() => {
    if (watchedUsername) {
      const extractedUsername = extractUsernameFromUrl(watchedUsername);
      const warning = validateUsernameFormat(extractedUsername);
      
      setValidationWarning(warning);
      
      // If we extracted a different username from a URL, update the form
      if (extractedUsername !== watchedUsername && extractedUsername) {
        form.setValue("username", extractedUsername);
      }
    } else {
      setValidationWarning("");
    }
  }, [watchedUsername, form]);

  const extractMutation = useMutation({
    mutationFn: async (data: UsernameInput) => {
      setIsExtracting(true);
      const response = await apiRequest("POST", "/api/extract-profile", data);
      return response.json();
    },
    onSuccess: (data) => {
      setIsExtracting(false);
      // Store the extracted profile data in sessionStorage for review
      sessionStorage.setItem("extractedProfile", JSON.stringify(data.profile));
      sessionStorage.setItem("profileUsername", form.getValues("username"));
      
      // Navigate to profile review page with username
      const username = form.getValues("username");
      setLocation(`/profile-review/${username}`);
    },
    onError: (error: Error) => {
      setIsExtracting(false);
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  const onSubmit = (data: UsernameInput) => {
    extractMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* RPG-themed background with gradient and starfield */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Starfield/dotted pattern background */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(2px 2px at 20px 30px, #8B5CF6, transparent), radial-gradient(2px 2px at 40px 70px, #A855F7, transparent), radial-gradient(1px 1px at 90px 40px, #C084FC, transparent), radial-gradient(1px 1px at 130px 80px, #8B5CF6, transparent), radial-gradient(2px 2px at 160px 30px, #A855F7, transparent)',
            backgroundRepeat: 'repeat',
            backgroundSize: '200px 100px'
          }} />
        </div>
      </div>

      {/* Floating glassmorphism card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-4xl lg:max-w-6xl"
      >
        <Card className="glass border-purple-400/30 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/50 transition-all duration-500 bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="text-center p-6 sm:p-8 md:p-10 pb-4 sm:pb-6 md:pb-8">
            {/* Back Navigation */}
            <motion.div 
              className="flex justify-start mb-4 sm:mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
            >
              <button 
                onClick={handleBackToStep1}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-purple-300 transition-colors duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-1 py-0.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Step 1
              </button>
            </motion.div>
            {/* Progress indicator */}
            <motion.div 
              className="mb-6 sm:mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="flex justify-center space-x-3">
                <div className="w-12 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30"></div>
                <div className="w-12 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30"></div>
              </div>
              <p className="text-base sm:text-lg text-slate-300 font-medium mt-3 sm:mt-4">Step 2 of 2</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-lg mb-3 sm:mb-4">
                Let's extract your professional data
              </CardTitle>
              <CardDescription className="text-slate-100 text-lg sm:text-xl font-medium">
                Enter your LinkedIn username to unlock a rich profile sourced from LinkedIn, GitHub, People Data Labs, and other professional networks.
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 md:p-10 pt-0">
            <motion.form 
              onSubmit={form.handleSubmit(onSubmit)} 
              className="space-y-6 sm:space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.div 
                className="space-y-3 sm:space-y-4 max-w-3xl mx-auto"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Label htmlFor="username" className="text-slate-100 font-semibold text-sm sm:text-base md:text-lg block">LinkedIn Profile Username</Label>
                <div className="flex rounded-lg overflow-hidden border-2 border-purple-400/50 focus-within:border-purple-300/80 focus-within:ring-4 focus-within:ring-purple-400/40 hover:border-purple-300/60 transition-all duration-300">
                  <span className="inline-flex items-center px-3 sm:px-4 md:px-5 bg-slate-800/70 text-slate-300 text-sm sm:text-base md:text-lg font-medium backdrop-blur-sm">
                    linkedin.com/in/
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. john-smith-12345"
                    className="flex-1 border-0 bg-slate-800/70 text-slate-100 placeholder:text-slate-400 focus:ring-0 focus:outline-none text-sm sm:text-base md:text-lg py-3 sm:py-3.5 md:py-4 px-3 sm:px-4 md:px-5 font-medium backdrop-blur-sm rounded-none"
                    {...form.register("username")}
                    disabled={isExtracting}
                  />
                </div>
                {form.formState.errors.username && (
                  <motion.p 
                    className="text-xs sm:text-sm md:text-base text-red-300 font-semibold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {form.formState.errors.username.message}
                  </motion.p>
                )}
                {validationWarning && (
                  <motion.p 
                    className="text-xs sm:text-sm md:text-base text-yellow-300 font-semibold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {validationWarning}
                  </motion.p>
                )}
                <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium">
                  Paste the part of your LinkedIn profile URL after linkedin.com/in/
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="sticky bottom-4 sm:relative sm:bottom-auto mt-4 sm:mt-8 md:mt-10 pb-2 sm:pb-0 flex justify-center"
              >
                <Button 
                  type="submit" 
                  className="w-fit px-8 sm:px-12 md:px-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 sm:py-5 text-lg sm:text-xl rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-4 focus:ring-purple-400/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg" 
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 sm:w-6 h-5 sm:h-6 animate-spin" />
                      Extracting profile data...
                    </span>
                  ) : (
                    "Extract Profile Data"
                  )}
                </Button>
              </motion.div>
            </motion.form>

            {isExtracting && (
              <motion.div 
                className="mt-4 sm:mt-6 md:mt-8 p-4 sm:p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-400/30 backdrop-blur-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-base sm:text-lg text-slate-100 font-medium">
                  This may take a few moments as we gather comprehensive data from multiple sources...
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}