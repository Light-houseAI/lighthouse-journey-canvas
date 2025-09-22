import { zodResolver } from "@hookform/resolvers/zod";
import { type UsernameInput,usernameInputSchema } from "@journey/schema";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ChevronLeft, HelpCircle,Loader2 } from "lucide-react";
import { useEffect,useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../hooks/use-toast";
import { httpClient } from "../services/http-client";
import { useAuthStore } from "../stores/auth-store";
import { useProfileReviewStore } from "../stores/profile-review-store";
// Helper function to get user-friendly error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message;
    // Check if it looks like a technical error code
    if (message.match(/^[A-Z_]+$/) || message.includes('_ERROR') || message.includes('_TOKEN')) {
      return "Profile extraction failed. Please try again.";
    }
    return message;
  }
  return "Profile extraction failed. Please try again.";
};

export default function OnboardingStep2() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const { setExtractedProfile, goBackToStep1 } = useProfileReviewStore();
  const [isExtracting, setIsExtracting] = useState(false);
  const [validationWarning, setValidationWarning] = useState<string>("");

  const handleBackToStep1 = () => {
    // Go back to step 1 using Zustand state
    goBackToStep1();
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
      const response = await httpClient.post('/api/onboarding/extract-profile', data);
      return response;
    },
    onSuccess: (data) => {
      setIsExtracting(false);
      // Store the extracted profile data in the Zustand store
      const username = form.getValues("username");
      setExtractedProfile(data.profile, username);

      toast({
        title: "Profile extracted successfully!",
        description: "Review and save your profile data.",
      });

      // No navigation needed - AuthenticatedApp will automatically show ProfileReview
    },
    onError: (error: Error) => {
      setIsExtracting(false);
      toast({
        title: "Extraction failed",
        description: getErrorMessage(error),
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
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>
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
        <Card className={`${theme.primaryBorder} ${theme.cardShadow} hover:shadow-lg transition-all duration-500 ${theme.cardBackground} backdrop-blur-xl`}>
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
                className={`flex items-center gap-2 text-sm ${theme.secondaryText} hover:text-[#10B981] transition-colors duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 rounded px-1 py-0.5`}
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
                <div className="w-12 h-3 bg-[#10B981] rounded-full"></div>
                <div className="w-12 h-3 bg-[#10B981] rounded-full"></div>
              </div>
              <p className={`text-base sm:text-lg ${theme.secondaryText} font-medium mt-3 sm:mt-4`}>Step 2 of 2</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className={`text-2xl sm:text-3xl md:text-4xl font-bold ${theme.primaryText} drop-shadow-lg mb-3 sm:mb-4`}>
                Let's extract your professional data
              </CardTitle>
              <CardDescription className={`${theme.secondaryText} text-lg sm:text-xl font-medium`}>
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
                <div className="flex items-center gap-2">
                  <Label htmlFor="username" className={`${theme.primaryText} font-semibold text-sm sm:text-base md:text-lg`}>LinkedIn Profile URL</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className={`w-4 h-4 ${theme.secondaryText} hover:text-[#10B981] transition-colors cursor-help`} />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={`${theme.cardBackground} border ${theme.primaryBorder} ${theme.primaryText} text-sm max-w-xs backdrop-blur-sm shadow-xl`}
                      >
                        <p>Need help? Go to your LinkedIn profile in a browser and then copy the URL from the address bar.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className={`flex rounded-lg overflow-hidden border-2 ${theme.primaryBorder} focus-within:border-emerald-300/80 focus-within:ring-4 focus-within:ring-emerald-400/40 hover:border-emerald-300/60 transition-all duration-300`}>
                  <span className={`inline-flex items-center px-3 sm:px-4 md:px-5 ${theme.inputBackground} ${theme.secondaryText} text-sm sm:text-base md:text-lg font-medium backdrop-blur-sm`}>
                    linkedin.com/in/
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. john-smith-12345"
                    className={`flex-1 border-0 ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} focus:ring-0 focus:outline-none text-sm sm:text-base md:text-lg py-3 sm:py-3.5 md:py-4 px-3 sm:px-4 md:px-5 font-medium backdrop-blur-sm rounded-none`}
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
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
                className="sticky bottom-4 sm:relative sm:bottom-auto mt-4 sm:mt-8 md:mt-10 pb-2 sm:pb-0 flex justify-center"
              >
                <Button
                  type="submit"
                  className="w-fit px-8 sm:px-12 md:px-16 bg-[#10B981] hover:bg-[#059669] text-white font-bold py-4 sm:py-5 text-lg sm:text-xl rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-0"
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
                className={`mt-4 sm:mt-6 md:mt-8 p-4 sm:p-6 bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 rounded-xl border ${theme.primaryBorder} backdrop-blur-sm`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className={`text-base sm:text-lg ${theme.primaryText} font-medium`}>
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
