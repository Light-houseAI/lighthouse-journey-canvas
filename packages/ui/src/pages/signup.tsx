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
import { type SignUp, signUpSchema } from '@journey/schema';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useRegister } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/error-toast';

interface SignUpProps {
  onSwitchToSignIn: () => void;
}

export default function SignUp({ onSwitchToSignIn }: SignUpProps) {
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { theme } = useTheme();

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignUp) => {
    try {
      await registerMutation.mutateAsync(data);
      toast({
        title: 'Account created!',
        description: "Welcome! Let's get you set up.",
      });
      // No navigation needed - App.tsx will automatically show the right component
    } catch (error) {
      toast({
        title: 'Sign up failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* RPG-themed background with gradient and starfield */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}></div>

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
              <CardTitle
                className={`text-4xl font-bold ${theme.primaryText} drop-shadow-lg`}
              >
                Begin Your Journey
              </CardTitle>
              <CardDescription
                className={`${theme.secondaryText} mt-4 text-xl font-medium`}
              >
                Create your professional timeline
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
                  placeholder="Create a secure password (8+ characters)"
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
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="border-3 h-6 w-6 animate-spin rounded-full border-white/30 border-t-white" />
                    Creating account...
                  </span>
                ) : (
                  'Create account'
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
                Already have an account?{' '}
                <Button
                  onClick={onSwitchToSignIn}
                  variant="ghost"
                  className="cursor-pointer rounded border-none bg-transparent px-2 py-1 font-bold text-[#10B981] decoration-2 underline-offset-4 transition-colors duration-200 hover:text-[#059669] hover:underline"
                >
                  Sign in
                </Button>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
