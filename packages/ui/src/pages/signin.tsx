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
import { type SignIn, signInSchema } from '@journey/schema';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { useTheme } from '../contexts/ThemeContext';
import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import { useToast } from '../hooks/use-toast';
import { useLogin } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/error-toast';

interface SignInProps {
  onSwitchToSignUp: () => void;
}

export default function SignIn({ onSwitchToSignUp }: SignInProps) {
  const { track } = useAnalytics();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { theme } = useTheme();

  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignIn) => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'sign_in',
      button_location: 'signin_page',
    });
    try {
      await loginMutation.mutateAsync(data);
      track(AnalyticsEvents.USER_SIGNED_IN, {
        method: 'email',
      });
      toast({
        title: 'Welcome back! 🚀',
        description: "You've signed in successfully.",
      });
    } catch (error) {
      toast({
        title: 'Sign in failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Light-themed background with gradient and subtle pattern */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>
        {/* Subtle dotted pattern background */}
        <div className="absolute inset-0 opacity-20">
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
        className="relative z-10"
      >
        <Card
          className={`w-full max-w-xl ${theme.cardBackground} ${theme.primaryBorder} border ${theme.cardShadow} transition-all duration-500`}
        >
          <CardHeader className="space-y-4 p-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className={`text-4xl font-bold ${theme.primaryText}`}>
                Welcome back!
              </CardTitle>
              <CardDescription
                className={`${theme.secondaryText} mt-4 text-xl font-medium`}
              >
                Continue your professional journey
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="space-y-8 p-10 pt-0">
            <motion.form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-7"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="space-y-3">
                <Label
                  htmlFor="email"
                  className={`${theme.primaryText} block text-lg font-semibold`}
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300`}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-base font-semibold text-red-500">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label
                  htmlFor="password"
                  className={`${theme.primaryText} block text-lg font-semibold`}
                >
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300`}
                  {...form.register('password')}
                />
                {form.formState.errors.password && (
                  <p className="text-base font-semibold text-red-500">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="mt-10 w-full rounded-xl border-0 bg-[#10B981] py-5 text-xl font-bold text-white transition-all duration-300 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </motion.form>

            <motion.div
              className="pt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <p className={`text-lg ${theme.primaryText} font-medium`}>
                Don't have an account?{' '}
                <Button
                  onClick={() => {
                    track(AnalyticsEvents.BUTTON_CLICKED, {
                      button_name: 'switch_to_signup',
                      button_location: 'signin_page',
                    });
                    onSwitchToSignUp();
                  }}
                  variant="ghost"
                  className="cursor-pointer rounded border-none bg-transparent px-2 py-1 font-bold text-[#10B981] decoration-2 underline-offset-4 transition-colors duration-200 hover:text-[#059669] hover:underline"
                >
                  Create account
                </Button>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
