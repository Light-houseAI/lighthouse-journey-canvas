import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { signInSchema, type SignIn } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SignIn>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signInMutation = useMutation({
    mutationFn: async (data: SignIn) => {
      const response = await apiRequest("POST", "/api/signin", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Welcome back!",
        description: "You've signed in successfully.",
      });
      // Force page reload to ensure auth state is properly updated
      window.location.href = "/";
    },
    onError: (error: Error) => {
      if (error.message.includes("Already authenticated")) {
        // User is already logged in, redirect to home
        setLocation("/");
        return;
      }
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignIn) => {
    signInMutation.mutate(data);
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
        className="relative z-10"
      >
        <Card className="w-full max-w-lg glass border-purple-500/20 shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/40 transition-all duration-500">
          <CardHeader className="space-y-4 text-center p-8">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                Welcome back
              </CardTitle>
              <CardDescription className="text-white/90 text-lg mt-3 font-medium">
                Continue your professional journey
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="space-y-6 p-8 pt-0">
            <motion.form 
              onSubmit={form.handleSubmit(onSubmit)} 
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <div className="space-y-3">
                <Label htmlFor="email" className="text-white font-medium text-base">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className="glass border-purple-400/40 bg-slate-800/60 text-white placeholder:text-slate-300/80 focus:border-purple-300 focus:ring-4 focus:ring-purple-400/30 focus:outline-none transition-all duration-300 text-base py-3 px-4"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-pink-300 font-medium">{form.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="text-white font-medium text-base">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••••••"
                  className="glass border-purple-400/40 bg-slate-800/60 text-white placeholder:text-slate-300/80 focus:border-purple-300 focus:ring-4 focus:ring-purple-400/30 focus:outline-none transition-all duration-300 text-base py-3 px-4"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-pink-300 font-medium">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full mt-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-4 text-lg rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] focus:ring-4 focus:ring-purple-400/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-0"
                disabled={signInMutation.isPending}
              >
                {signInMutation.isPending ? (
                  <span className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </motion.form>
            
            <motion.div 
              className="text-center pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <p className="text-base text-white/90">
                Don't have an account?{" "}
                <Link 
                  href="/signup" 
                  className="text-purple-300 hover:text-purple-200 font-semibold transition-colors duration-200 hover:underline decoration-purple-300 focus:ring-2 focus:ring-purple-400/50 focus:outline-none rounded px-1"
                >
                  Create account
                </Link>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}