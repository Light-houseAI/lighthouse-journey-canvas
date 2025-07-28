import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { signUpSchema, type SignUp } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SignUp>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpMutation = useMutation({
    mutationFn: async (data: SignUp) => {
      const response = await apiRequest("POST", "/api/signup", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Account created!",
        description: "Welcome! Let's get you set up.",
      });
      // Force page reload to ensure auth state is properly updated
      window.location.href = "/onboarding/step1";
    },
    onError: (error: Error) => {
      if (error.message.includes("Already authenticated")) {
        // User is already logged in, redirect to home
        setLocation("/");
        return;
      }
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignUp) => {
    signUpMutation.mutate(data);
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
        <Card className="w-full max-w-xl glass border-purple-400/30 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/50 transition-all duration-500 bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center p-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-lg">
                Begin Your Journey
              </CardTitle>
              <CardDescription className="text-slate-100 text-xl mt-4 font-medium">
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
                <Label htmlFor="email" className="text-slate-100 font-semibold text-lg block">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  className="border-2 border-purple-400/50 bg-slate-800/70 text-slate-100 placeholder:text-slate-400 focus:border-purple-300 focus:ring-4 focus:ring-purple-400/40 focus:outline-none transition-all duration-300 text-lg py-4 px-5 rounded-lg font-medium backdrop-blur-sm"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-base text-red-300 font-semibold">{form.formState.errors.email.message}</p>
                )}
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="text-slate-100 font-semibold text-lg block">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a secure password (8+ characters)"
                  className="border-2 border-purple-400/50 bg-slate-800/70 text-slate-100 placeholder:text-slate-400 focus:border-purple-300 focus:ring-4 focus:ring-purple-400/40 focus:outline-none transition-all duration-300 text-lg py-4 px-5 rounded-lg font-medium backdrop-blur-sm"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-base text-red-300 font-semibold">{form.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full mt-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-5 text-xl rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-4 focus:ring-purple-400/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg"
                disabled={signUpMutation.isPending}
              >
                {signUpMutation.isPending ? (
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
              <p className="text-lg text-slate-100 font-medium">
                Already have an account?{" "}
                <Link 
                  href="/signin" 
                  className="text-purple-300 hover:text-purple-200 font-bold transition-colors duration-200 hover:underline decoration-purple-300 decoration-2 underline-offset-4 focus:ring-2 focus:ring-purple-400/60 focus:outline-none rounded px-2 py-1"
                >
                  Sign in
                </Link>
              </p>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}