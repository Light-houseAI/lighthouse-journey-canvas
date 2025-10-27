import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@journey/components'; // was: button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@journey/components'; // was: card
import { Input } from '@journey/components'; // was: input
import { Label } from '@journey/components'; // was: label
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@journey/components'; // was: tooltip
import { type UsernameInput, usernameInputSchema } from '@journey/schema';
import { motion } from 'framer-motion';
import { ChevronLeft, HelpCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useCurrentUser } from '../hooks/useAuth';
import { useExtractProfile } from '../hooks/useOnboarding';
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
      return 'Profile extraction failed. Please try again.';
    }
    return message;
  }
  return 'Profile extraction failed. Please try again.';
};

export default function OnboardingStep2() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { initializeSelection, goBackToStep1 } = useProfileReviewStore();
  const [validationWarning, setValidationWarning] = useState<string>('');

  // Use TanStack Query hook for profile extraction
  const extractProfileMutation = useExtractProfile();

  // Get current user to check if profile is already extracted
  const { data: user } = useCurrentUser();

  const handleBackToStep1 = () => {
    // Go back to step 1 using Zustand state
    goBackToStep1();
  };

  // Function to extract username from LinkedIn URL
  const extractUsernameFromUrl = (input: string): string => {
    // Remove leading/trailing whitespace
    const trimmed = input.trim();

    // Check if it's a full LinkedIn URL
    const linkedinUrlMatch = trimmed.match(
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([^/?#]+)/i
    );
    if (linkedinUrlMatch) {
      return linkedinUrlMatch[1];
    }

    // Return the original input if no URL pattern found
    return trimmed;
  };

  // Function to validate username format
  const validateUsernameFormat = (username: string): string => {
    if (!username) return '';

    // Check if it contains spaces or looks like a full name
    if (username.includes(' ') || /^[A-Z][a-z]+ [A-Z][a-z]+/.test(username)) {
      return "This doesn't look like a LinkedIn username. Please enter the part after linkedin.com/in/.";
    }

    // Check if it still looks like a URL
    if (username.includes('linkedin.com') || username.includes('http')) {
      return "This doesn't look like a LinkedIn username. Please enter the part after linkedin.com/in/.";
    }

    return '';
  };

  const form = useForm<UsernameInput>({
    resolver: zodResolver(usernameInputSchema),
    defaultValues: {
      username: '',
    },
  });

  // Watch for changes in the username field
  const watchedUsername = form.watch('username');

  // Check for duplicate profile extraction
  useEffect(() => {
    if (user?.hasCompletedOnboarding) {
      toast({
        title: 'Profile Already Extracted',
        description:
          'Your profile has already been saved. Contact support if you need to reset.',
        variant: 'destructive',
      });
    }
  }, [user, toast]);

  useEffect(() => {
    if (watchedUsername) {
      const extractedUsername = extractUsernameFromUrl(watchedUsername);
      const warning = validateUsernameFormat(extractedUsername);

      setValidationWarning(warning);

      // If we extracted a different username from a URL, update the form
      if (extractedUsername !== watchedUsername && extractedUsername) {
        form.setValue('username', extractedUsername);
      }
    } else {
      setValidationWarning('');
    }
  }, [watchedUsername, form]);

  const onSubmit = async (data: UsernameInput) => {
    try {
      const profile = await extractProfileMutation.mutateAsync(data.username);

      // Initialize selection state with extracted profile (moves to step 3)
      initializeSelection(profile);

      toast({
        title: 'Profile extracted successfully!',
        description: 'Review and save your profile data.',
      });

      // Navigation to ProfileReview will happen automatically via AuthenticatedApp logic
      // (AuthenticatedApp checks currentOnboardingStep which is set to 3 by initializeSelection)
    } catch (error) {
      toast({
        title: 'Extraction failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* RPG-themed background with gradient and starfield */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>
        {/* Starfield/dotted pattern background */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(2px 2px at 20px 30px, #8B5CF6, transparent), radial-gradient(2px 2px at 40px 70px, #A855F7, transparent), radial-gradient(1px 1px at 90px 40px, #C084FC, transparent), radial-gradient(1px 1px at 130px 80px, #8B5CF6, transparent), radial-gradient(2px 2px at 160px 30px, #A855F7, transparent)',
              backgroundRepeat: 'repeat',
              backgroundSize: '200px 100px',
            }}
          />
        </div>
      </div>

      {/* Floating glassmorphism card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-4xl lg:max-w-6xl"
      >
        <Card
          className={`${theme.primaryBorder} ${theme.cardShadow} transition-all duration-500 hover:shadow-lg ${theme.cardBackground} backdrop-blur-xl`}
        >
          <CardHeader className="p-6 pb-4 text-center sm:p-8 sm:pb-6 md:p-10 md:pb-8">
            {/* Back Navigation */}
            <motion.div
              className="mb-4 flex justify-start sm:mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
            >
              <Button
                onClick={handleBackToStep1}
                variant="ghost"
                className={`flex items-center gap-2 text-sm ${theme.secondaryText} h-auto rounded px-1 py-0.5 transition-colors duration-200 hover:text-[#10B981] hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2`}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Step 1
              </Button>
            </motion.div>
            {/* Progress indicator */}
            <motion.div
              className="mb-6 sm:mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="flex justify-center space-x-3">
                <div className="h-3 w-12 rounded-full bg-[#10B981]"></div>
                <div className="h-3 w-12 rounded-full bg-[#10B981]"></div>
              </div>
              <p
                className={`text-base sm:text-lg ${theme.secondaryText} mt-3 font-medium sm:mt-4`}
              >
                Step 2 of 2
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle
                className={`text-2xl font-bold sm:text-3xl md:text-4xl ${theme.primaryText} mb-3 drop-shadow-lg sm:mb-4`}
              >
                Let's extract your professional data
              </CardTitle>
              <CardDescription
                className={`${theme.secondaryText} text-lg font-medium sm:text-xl`}
              >
                Enter your LinkedIn username to unlock a rich profile sourced
                from LinkedIn, GitHub, People Data Labs, and other professional
                networks.
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 md:p-10">
            <motion.form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 sm:space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.div
                className="mx-auto max-w-3xl space-y-3 sm:space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="username"
                    className={`${theme.primaryText} text-sm font-semibold sm:text-base md:text-lg`}
                  >
                    LinkedIn Profile URL
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle
                          className={`h-4 w-4 ${theme.secondaryText} cursor-help transition-colors hover:text-[#10B981]`}
                        />
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={`${theme.cardBackground} border ${theme.primaryBorder} ${theme.primaryText} max-w-xs text-sm shadow-xl backdrop-blur-sm`}
                      >
                        <p>
                          Need help? Go to your LinkedIn profile in a browser
                          and then copy the URL from the address bar.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div
                  className={`flex overflow-hidden rounded-lg border-2 ${theme.primaryBorder} transition-all duration-300 focus-within:border-emerald-300/80 focus-within:ring-4 focus-within:ring-emerald-400/40 hover:border-emerald-300/60`}
                >
                  <span
                    className={`inline-flex items-center px-3 sm:px-4 md:px-5 ${theme.inputBackground} ${theme.secondaryText} text-sm font-medium backdrop-blur-sm sm:text-base md:text-lg`}
                  >
                    linkedin.com/in/
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="e.g. john-smith-12345"
                    className={`flex-1 border-0 ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} rounded-none px-3 py-3 text-sm font-medium backdrop-blur-sm focus:outline-none focus:ring-0 sm:px-4 sm:py-3.5 sm:text-base md:px-5 md:py-4 md:text-lg`}
                    {...form.register('username')}
                    disabled={extractProfileMutation.isPending}
                  />
                </div>
                {form.formState.errors.username && (
                  <motion.p
                    className="text-xs font-semibold text-red-300 sm:text-sm md:text-base"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {form.formState.errors.username.message}
                  </motion.p>
                )}
                {validationWarning && (
                  <motion.p
                    className="text-xs font-semibold text-yellow-300 sm:text-sm md:text-base"
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
                className="sticky bottom-4 mt-4 flex justify-center pb-2 sm:relative sm:bottom-auto sm:mt-8 sm:pb-0 md:mt-10"
              >
                <Button
                  type="submit"
                  className="w-fit rounded-xl border-0 bg-[#10B981] px-8 py-4 text-lg font-bold text-white transition-all duration-300 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 sm:px-12 sm:py-5 sm:text-xl md:px-16"
                  disabled={
                    extractProfileMutation.isPending ||
                    user?.hasCompletedOnboarding
                  }
                >
                  {extractProfileMutation.isPending ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin sm:h-6 sm:w-6" />
                      Extracting profile data...
                    </span>
                  ) : user?.hasCompletedOnboarding ? (
                    'Profile Already Extracted'
                  ) : (
                    'Extract Profile Data'
                  )}
                </Button>
              </motion.div>
            </motion.form>

            {extractProfileMutation.isPending && (
              <motion.div
                className={`mt-4 rounded-xl border bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 p-4 sm:mt-6 sm:p-6 md:mt-8 ${theme.primaryBorder} backdrop-blur-sm`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p
                  className={`text-base sm:text-lg ${theme.primaryText} font-medium`}
                >
                  This may take a few moments as we gather comprehensive data
                  from multiple sources...
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
