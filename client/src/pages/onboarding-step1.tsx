import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { interestSchema, type Interest } from "@shared/schema";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const interestOptions = [
  { value: "find-job", label: "Find a new job", description: "Looking for new career opportunities" },
  { value: "grow-career", label: "Grow in my career", description: "Advance in my current field" },
  { value: "change-careers", label: "Change careers", description: "Switch to a different industry" },
  { value: "start-startup", label: "Start a startup", description: "Build my own company" },
];

export default function OnboardingStep1() {
  const { toast } = useToast();
  const { logout, updateUserInterest, isLoading } = useAuthStore();

  const form = useForm<Interest>({
    resolver: zodResolver(interestSchema),
  });

  const handleBackToSignIn = async () => {
    try {
      await logout();
      // No navigation needed - App.tsx will automatically show UnauthenticatedApp
    } catch (error) {
      console.error("Logout error:", error);
      // Even if logout fails, the auth store will clear the user state
    }
  };

  const onSubmit = async (data: Interest) => {
    try {
      await updateUserInterest(data.interest);
      // No navigation needed - App.tsx will automatically show next onboarding step
      toast({
        title: "Success",
        description: "Interest saved successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save interest",
        variant: "destructive",
      });
    }
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
                onClick={handleBackToSignIn}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-purple-300 transition-colors duration-200 hover:underline focus:outline-none focus:ring-2 focus:ring-purple-400/40 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-1 py-0.5"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Sign In
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
                <div className="w-12 h-3 bg-slate-700/50 rounded-full"></div>
              </div>
              <p className="text-base sm:text-lg text-slate-300 font-medium mt-3 sm:mt-4">Step 1 of 2</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-lg mb-3 sm:mb-4">
                What are you most interested in?
              </CardTitle>
              <CardDescription className="text-slate-100 text-lg sm:text-xl font-medium">
                This helps us tailor your experience to your goals
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
              <RadioGroup
                onValueChange={(value) => form.setValue("interest", value as any)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6 max-w-3xl mx-auto"
              >
                {interestOptions.map((option, index) => (
                  <motion.label
                    key={option.value}
                    htmlFor={option.value}
                    className="cursor-pointer block"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + (index * 0.1), duration: 0.4 }}
                  >
                    <div className="flex items-start space-x-3 sm:space-x-4 p-3 sm:p-4 md:p-5 rounded-lg sm:rounded-xl border-2 border-purple-400/30 hover:border-purple-300/60 md:hover:border-purple-300/80 focus-within:border-purple-300/80 focus-within:ring-4 focus-within:ring-purple-400/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20 md:hover:shadow-purple-500/40 hover:bg-slate-800/50 md:hover:bg-slate-800/60 bg-slate-800/30 backdrop-blur-sm group min-h-[68px] sm:min-h-[76px] md:min-h-[84px]">
                      <RadioGroupItem
                        value={option.value}
                        id={option.value}
                        className="mt-1 border-purple-400/50 text-purple-300 focus:ring-purple-400/40 focus:ring-2"
                      />
                      <div className="flex-1">
                        <div className="text-sm sm:text-base md:text-lg font-semibold text-slate-100 group-hover:text-purple-200 transition-colors duration-200 leading-tight">
                          {option.label}
                        </div>
                        <p className="text-xs sm:text-sm md:text-base text-slate-300 group-hover:text-slate-200 mt-1 sm:mt-2 font-medium leading-snug transition-colors duration-200">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </motion.label>
                ))}
              </RadioGroup>

              {form.formState.errors.interest && (
                <motion.p
                  className="text-base text-red-300 font-semibold"
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
                className="sticky bottom-4 sm:relative sm:bottom-auto mt-4 sm:mt-8 md:mt-10 pb-2 sm:pb-0 flex justify-center"
              >
                <Button
                  type="submit"
                  className="w-fit px-8 sm:px-12 md:px-16 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 sm:py-5 text-lg sm:text-xl rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-4 focus:ring-purple-400/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-3">
                      <div className="w-5 sm:w-6 h-5 sm:h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Continue"
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
