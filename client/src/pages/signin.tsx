import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema, type SignIn } from "@shared/types";
import { useAuthStore } from "@/stores/auth-store";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface SignInProps {
  onSwitchToSignUp: () => void;
}

export default function SignIn({ onSwitchToSignUp }: SignInProps) {
  const { toast } = useToast();
  const { login, isLoading, error } = useAuthStore();
  const { theme } = useTheme();

  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignIn) => {
    try {
      await login(data);
      toast({
        title: "Welcome back!",
        description: "You've signed in successfully.",
      });
      // No navigation needed - App.tsx will automatically show the right component
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Sign in failed",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      {/* Light-themed background with gradient and subtle pattern */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>
        {/* Subtle dotted pattern background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(1px 1px at 20px 30px, #10B981, transparent), radial-gradient(1px 1px at 40px 70px, #34D399, transparent), radial-gradient(0.5px 0.5px at 90px 40px, #6EE7B7, transparent), radial-gradient(0.5px 0.5px at 130px 80px, #10B981, transparent), radial-gradient(1px 1px at 160px 30px, #34D399, transparent)',
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
        className="relative z-10"
      >
        <Card className={`w-full max-w-xl ${theme.cardBackground} ${theme.primaryBorder} border ${theme.cardShadow} transition-all duration-500`}>
          <CardHeader className="space-y-4 text-center p-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className={`text-4xl font-bold ${theme.primaryText}`}>
                Welcome back
              </CardTitle>
              <CardDescription className={`${theme.secondaryText} text-xl mt-4 font-medium`}>
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
                  placeholder="••••••••••••"
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
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
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
                Don't have an account?{" "}
                <button
                  onClick={onSwitchToSignUp}
                  className="text-[#10B981] hover:text-[#059669] font-bold transition-colors duration-200 hover:underline decoration-2 underline-offset-4 rounded px-2 py-1 bg-transparent border-none cursor-pointer"
                >
                  Create account
                </button>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
