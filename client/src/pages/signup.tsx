import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUp } from "@shared/types";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SignUpProps {
  onSwitchToSignIn: () => void;
}

export default function SignUp({ onSwitchToSignIn }: SignUpProps) {
  const { toast } = useToast();
  const { register, isLoading } = useAuthStore();
  const { theme } = useTheme();

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignUp) => {
    try {
      await register(data);
      toast({
        title: "Account created!",
        description: "Welcome! Let's get you set up.",
      });
      // No navigation needed - App.tsx will automatically show the right component
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: error instanceof Error ? error.message : "Sign up failed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* RPG-themed background with gradient and starfield */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>

      </div>

      {/* Floating glassmorphism card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10"
      >
        <Card className={`w-full max-w-xl ${theme.cardBackground} ${theme.primaryBorder} border ${theme.cardShadow} transition-all duration-500`}>
          <CardHeader className="space-y-4 text-center p-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className={`text-4xl font-bold ${theme.primaryText} drop-shadow-lg`}>
                Begin Your Journey
              </CardTitle>
              <CardDescription className={`${theme.secondaryText} text-xl mt-4 font-medium`}>
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
                <Label htmlFor="email" className={`${theme.primaryText} font-semibold text-lg block`}>Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} transition-all duration-300 text-lg py-4 px-5 rounded-lg font-medium`}
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-base text-red-500 font-semibold">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className={`${theme.primaryText} font-semibold text-lg block`}>Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a secure password (8+ characters)"
                  className={`border-2 ${theme.primaryBorder} ${theme.inputBackground} ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus} transition-all duration-300 text-lg py-4 px-5 rounded-lg font-medium`}
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-base text-red-500 font-semibold">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-10 bg-[#10B981] hover:bg-[#059669] text-white font-bold py-5 text-xl rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed border-0"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create account"
                )}
              </Button>
            </motion.form>

            <motion.div
              className="text-center pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <p className={`text-lg ${theme.primaryText} font-medium`}>
                Already have an account?{" "}
                <button
                  onClick={onSwitchToSignIn}
                  className="text-[#10B981] hover:text-[#059669] font-bold transition-colors duration-200 hover:underline decoration-2 underline-offset-4 rounded px-2 py-1 bg-transparent border-none cursor-pointer"
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
