import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { usernameInputSchema, type UsernameInput } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function OnboardingStep2() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isExtracting, setIsExtracting] = useState(false);

  const form = useForm<UsernameInput>({
    resolver: zodResolver(usernameInputSchema),
    defaultValues: {
      username: "",
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (data: UsernameInput) => {
      setIsExtracting(true);
      const response = await apiRequest("POST", "/api/extract-profile", data);
      return response.json();
    },
    onSuccess: (data) => {
      setIsExtracting(false);
      // Store the extracted profile data in sessionStorage for review
      sessionStorage.setItem("extractedProfile", JSON.stringify(data.profile));
      sessionStorage.setItem("profileUsername", form.getValues("username"));
      
      // Navigate to profile review page with username
      const username = form.getValues("username");
      setLocation(`/profile-review/${username}`);
    },
    onError: (error: Error) => {
      setIsExtracting(false);
      toast({
        title: "Extraction failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });



  const onSubmit = (data: UsernameInput) => {
    extractMutation.mutate(data);
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
        className="relative z-10 w-full max-w-4xl"
      >
        <Card className="glass border-purple-400/30 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/50 transition-all duration-500 bg-slate-900/80 backdrop-blur-xl">
          <CardHeader className="text-center p-10 pb-8">
            {/* Progress indicator */}
            <motion.div 
              className="mb-8"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="flex justify-center space-x-3">
                <div className="w-12 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30"></div>
                <div className="w-12 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shadow-lg shadow-purple-500/30"></div>
              </div>
              <p className="text-lg text-slate-300 font-medium mt-4">Step 2 of 2</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-lg mb-4">
                Let's extract your professional data
              </CardTitle>
              <CardDescription className="text-slate-100 text-xl font-medium">
                Enter your LinkedIn username to get comprehensive profile information from multiple sources
              </CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent className="p-10 pt-0">
            <motion.form 
              onSubmit={form.handleSubmit(onSubmit)} 
              className="space-y-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <motion.div 
                className="space-y-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
              >
                <Label htmlFor="username" className="text-slate-100 font-semibold text-lg block">LinkedIn Username</Label>
                <div className="flex rounded-lg overflow-hidden border-2 border-purple-400/50 focus-within:border-purple-300 focus-within:ring-4 focus-within:ring-purple-400/40 transition-all duration-300">
                  <span className="inline-flex items-center px-5 bg-slate-800/70 text-slate-300 text-lg font-medium backdrop-blur-sm">
                    linkedin.com/in/
                  </span>
                  <Input
                    id="username"
                    type="text"
                    placeholder="yourname"
                    className="flex-1 border-0 bg-slate-800/70 text-slate-100 placeholder:text-slate-400 focus:ring-0 focus:outline-none text-lg py-4 px-5 font-medium backdrop-blur-sm rounded-none"
                    {...form.register("username")}
                    disabled={isExtracting}
                  />
                </div>
                {form.formState.errors.username && (
                  <motion.p 
                    className="text-base text-red-300 font-semibold"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {form.formState.errors.username.message}
                  </motion.p>
                )}
                <p className="text-base text-slate-300 font-medium">
                  We'll extract data from LinkedIn, People Data Labs, GitHub, and other professional sources
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                <Button 
                  type="submit" 
                  className="w-full mt-10 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-5 text-xl rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/40 hover:scale-[1.02] focus:ring-4 focus:ring-purple-400/60 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed border-0 shadow-lg" 
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Extracting profile data...
                    </span>
                  ) : (
                    "Extract Profile Data"
                  )}
                </Button>
              </motion.div>
            </motion.form>

            {isExtracting && (
              <motion.div 
                className="mt-8 p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-400/30 backdrop-blur-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-lg text-slate-100 font-medium">
                  This may take a few moments as we gather comprehensive data from multiple sources...
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}