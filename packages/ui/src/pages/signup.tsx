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
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { CheckCircle } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import { useToast } from '../hooks/use-toast';
import { useRegister, useRegisterWithCode } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/error-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

interface SignUpProps {
  onSwitchToSignIn: () => void;
  /** Optional invite code for waitlist users */
  inviteCode?: string;
  /** Optional pre-filled email from invite code validation */
  inviteEmail?: string;
}

interface ValidateInviteResponse {
  success: boolean;
  data?: {
    valid: boolean;
    email?: string;
    message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export default function SignUp({ onSwitchToSignIn, inviteCode: initialInviteCode, inviteEmail: initialInviteEmail }: SignUpProps) {
  const { track } = useAnalytics();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const registerWithCodeMutation = useRegisterWithCode();
  const { theme } = useTheme();

  // Invite code state
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [inviteEmail, setInviteEmail] = useState(initialInviteEmail || '');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState(!!initialInviteEmail);
  const [codeError, setCodeError] = useState('');
  const [showInviteField, setShowInviteField] = useState(!!initialInviteCode);

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: initialInviteEmail || '',
      password: '',
      firstName: '',
      lastName: '',
    },
  });

  // Update email when invite email changes
  useEffect(() => {
    if (inviteEmail) {
      form.setValue('email', inviteEmail);
    }
  }, [inviteEmail, form]);

  // Validate invite code on mount if provided
  useEffect(() => {
    if (initialInviteCode && !initialInviteEmail) {
      validateInviteCode(initialInviteCode);
    }
  }, [initialInviteCode]);

  const validateInviteCode = async (code: string) => {
    if (!code.trim()) {
      setCodeError('Please enter your invite code');
      setIsCodeValid(false);
      return;
    }

    setIsValidatingCode(true);
    setCodeError('');

    try {
      const response = await fetch(
        `${API_URL}/api/waitlist/invite/${encodeURIComponent(code)}/validate`
      );
      const result: ValidateInviteResponse = await response.json();

      if (result.success && result.data?.valid) {
        setIsCodeValid(true);
        setInviteEmail(result.data.email || '');
        form.setValue('email', result.data.email || '');
        toast({
          title: 'Code validated!',
          description: 'Please complete your registration below.',
        });
      } else {
        setIsCodeValid(false);
        setCodeError(result.data?.message || result.error?.message || 'Invalid invite code');
      }
    } catch (error) {
      setIsCodeValid(false);
      setCodeError('Unable to validate code. Please try again.');
    } finally {
      setIsValidatingCode(false);
    }
  };

  const onSubmit = async (data: SignUp) => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'create_account',
      button_location: 'signup_page',
    });
    console.log('🚀 [SIGNUP] Form submitted with data:', data);
    
    try {
      // If using invite code, use the signup-with-code endpoint
      if (isCodeValid && inviteCode) {
        await registerWithCodeMutation.mutateAsync({
          code: inviteCode,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
        });
        track(AnalyticsEvents.USER_SIGNED_UP, {
          method: 'invite_code',
        });
      } else {
        await registerMutation.mutateAsync(data);
        track(AnalyticsEvents.USER_SIGNED_UP, {
          method: 'email',
        });
      }
      
      toast({
        title: 'Account created!',
        description: "Welcome! Let's get you set up.",
      });
      // Redirect to home page after successful registration
      window.location.href = '/';
    } catch (error) {
      console.error('❌ [SIGNUP] Registration failed:', error);
      toast({
        title: 'Sign up failed',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Debug: Log form errors
  const onError = (errors: any) => {
    console.error('❌ [SIGNUP] Form validation errors:', errors);
  };

  const isPending = registerMutation.isPending || registerWithCodeMutation.isPending;

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
              onSubmit={form.handleSubmit(onSubmit, onError)}
              className="space-y-7"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              {/* Invite Code Field - shown when user has invite code or wants to enter one */}
              {(showInviteField || initialInviteCode) && (
                <div className="space-y-3">
                  <Label
                    htmlFor="inviteCode"
                    className={`${theme.primaryText} block text-lg font-semibold`}
                  >
                    Invite Code
                  </Label>
                  <div className="flex gap-3">
                    <Input
                      id="inviteCode"
                      type="text"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value);
                        setCodeError('');
                        setIsCodeValid(false);
                      }}
                      placeholder="Enter your invite code"
                      disabled={isCodeValid}
                      className={`flex-1 border-2 ${
                        isCodeValid
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                          : `${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText}`
                      } placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300 disabled:cursor-not-allowed`}
                    />
                    {!isCodeValid && (
                      <Button
                        type="button"
                        onClick={() => validateInviteCode(inviteCode)}
                        disabled={isValidatingCode || !inviteCode.trim()}
                        className="rounded-lg bg-[#10B981] px-6 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isValidatingCode ? 'Checking...' : 'Verify'}
                      </Button>
                    )}
                  </div>
                  {codeError && (
                    <p className="text-base font-semibold text-red-500">{codeError}</p>
                  )}
                  {isCodeValid && (
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Code verified! Complete your registration below.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Toggle to show invite code field */}
              {!showInviteField && !initialInviteCode && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowInviteField(true)}
                    className={`text-sm ${theme.secondaryText} hover:${theme.primaryText} underline transition-colors`}
                  >
                    Have an invite code?
                  </button>
                </div>
              )}

              {/* Name fields in a row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label
                    htmlFor="firstName"
                    className={`${theme.primaryText} block text-lg font-semibold`}
                  >
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300`}
                    {...form.register('firstName')}
                  />
                  {form.formState.errors.firstName && (
                    <p className="text-base font-semibold text-red-500">
                      {form.formState.errors.firstName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label
                    htmlFor="lastName"
                    className={`${theme.primaryText} block text-lg font-semibold`}
                  >
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Doe (optional)"
                    className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300`}
                    {...form.register('lastName')}
                  />
                  {form.formState.errors.lastName && (
                    <p className="text-base font-semibold text-red-500">
                      {form.formState.errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>

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
                  disabled={isCodeValid && !!inviteEmail}
                  className={`border-2 ${
                    isCodeValid && inviteEmail
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 cursor-not-allowed'
                      : `${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText}`
                  } placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} rounded-lg px-5 py-4 text-lg font-medium transition-all duration-300`}
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
                disabled={isPending || (showInviteField && !isCodeValid && !!inviteCode.trim())}
              >
                {isPending ? (
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
                  onClick={() => {
                    track(AnalyticsEvents.BUTTON_CLICKED, {
                      button_name: 'switch_to_signin',
                      button_location: 'signup_page',
                    });
                    onSwitchToSignIn();
                  }}
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
