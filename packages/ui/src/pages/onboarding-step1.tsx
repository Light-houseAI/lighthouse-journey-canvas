import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@journey/components'; // was: button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@journey/components'; // was: card
// was: label
import { RadioGroup, RadioGroupItem } from '@journey/components'; // was: radio-group
import { type Interest, interestSchema } from '@journey/schema';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useLogout } from '../hooks/useAuth';
import { useProfileReviewStore } from '../stores/profile-review-store';

const interestOptions = [
  {
    value: 'find-job',
    label: 'Find a new job',
    description: 'Looking for new career opportunities',
  },
  {
    value: 'grow-career',
    label: 'Grow in my career',
    description: 'Advance in my current field',
  },
  {
    value: 'change-careers',
    label: 'Change careers',
    description: 'Switch to a different industry',
  },
  {
    value: 'start-startup',
    label: 'Start a startup',
    description: 'Build my own company',
  },
];

export default function OnboardingStep1() {
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const { setSelectedInterest } = useProfileReviewStore();
  const { theme } = useTheme();

  const form = useForm<Interest>({
    resolver: zodResolver(interestSchema),
  });

  const handleBackToSignIn = async () => {
    try {
      await logoutMutation.mutateAsync();
      // No navigation needed - App.tsx will automatically show UnauthenticatedApp
    } catch (error) {
      console.error('Logout error:', error);
      // Even if logout fails, the auth store will clear the user state
    }
  };

  const onSubmit = (data: Interest) => {
    // Store the interest in Zustand state (don't save to server yet)
    setSelectedInterest(data.interest as any);

    toast({
      title: 'Success',
      description: "Let's extract your profile data!",
    });
    // Navigation to step 2 will happen automatically via AuthenticatedApp logic
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
                'radial-gradient(1px 1px at 20px 30px, #10B981, transparent), radial-gradient(1px 1px at 40px 70px, #34D399, transparent), radial-gradient(0.5px 0.5px at 90px 40px, #6EE7B7, transparent), radial-gradient(0.5px 0.5px at 130px 80px, #10B981, transparent), radial-gradient(1px 1px at 160px 30px, #34D399, transparent)',
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
                onClick={handleBackToSignIn}
                variant="ghost"
                className={`flex items-center gap-2 text-sm ${theme.secondaryText} h-auto rounded px-1 py-0.5 transition-colors duration-200 hover:text-[#10B981] hover:underline focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2`}
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Sign In
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
                <div
                  className={`h-3 w-12 ${theme.secondaryText} rounded-full opacity-30`}
                ></div>
              </div>
              <p
                className={`text-base sm:text-lg ${theme.secondaryText} mt-3 font-medium sm:mt-4`}
              >
                Step 1 of 2
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
                What are you most interested in?
              </CardTitle>
              <CardDescription
                className={`${theme.secondaryText} text-lg font-medium sm:text-xl`}
              >
                This helps us tailor your experience to your goals
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
              <RadioGroup
                onValueChange={(value) =>
                  form.setValue('interest', value as any)
                }
                className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 md:gap-6"
              >
                {interestOptions.map((option, index) => (
                  <motion.label
                    key={option.value}
                    htmlFor={option.value}
                    className="block cursor-pointer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
                  >
                    <div
                      className={`flex items-start space-x-3 rounded-lg border-2 p-3 sm:space-x-4 sm:rounded-xl sm:p-4 md:p-5 ${theme.primaryBorder} transition-all duration-300 focus-within:border-emerald-300/80 focus-within:ring-4 focus-within:ring-emerald-400/30 hover:border-emerald-300/60 hover:bg-white/10 hover:shadow-lg hover:shadow-emerald-500/20 md:hover:border-emerald-300/80 md:hover:bg-white/20 md:hover:shadow-emerald-500/40 ${theme.cardBackground} group min-h-[68px] backdrop-blur-sm sm:min-h-[76px] md:min-h-[84px]`}
                    >
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className={`mt-1 ${theme.primaryBorder} text-[#10B981] focus:ring-2 focus:ring-emerald-400/40`}
                      />
                      <div className="flex-1">
                        <div
                          className={`text-sm font-semibold sm:text-base md:text-lg ${theme.primaryText} leading-tight transition-colors duration-200 group-hover:text-[#10B981]`}
                        >
                          {option.label}
                        </div>
                        <p
                          className={`text-xs sm:text-sm md:text-base ${theme.secondaryText} group-hover:${theme.primaryText} mt-1 font-medium leading-snug transition-colors duration-200 sm:mt-2`}
                        >
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </motion.label>
                ))}
              </RadioGroup>

              {form.formState.errors.interest && (
                <motion.p
                  className="text-base font-semibold text-red-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {form.formState.errors.interest.message}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.4 }}
                className="sticky bottom-4 mt-4 flex justify-center pb-2 sm:relative sm:bottom-auto sm:mt-8 sm:pb-0 md:mt-10"
              >
                <Button
                  type="submit"
                  className="w-fit rounded-xl border-0 bg-[#10B981] px-8 py-4 text-lg font-bold text-white transition-all duration-300 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 sm:px-12 sm:py-5 sm:text-xl md:px-16"
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="border-3 h-5 w-5 animate-spin rounded-full border-white/30 border-t-white sm:h-6 sm:w-6" />
                      Saving...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
