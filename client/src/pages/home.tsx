import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { usernameInputSchema, type UsernameInput, type ProfileData } from "@shared/schema";
import { Shield, Database, Filter, UserCircle, Loader2 } from "lucide-react";

export default function Home() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<UsernameInput>({
    resolver: zodResolver(usernameInputSchema),
    defaultValues: {
      username: "",
    },
  });

  const extractProfileMutation = useMutation({
    mutationFn: async (data: UsernameInput) => {
      const response = await apiRequest("POST", "/api/extract-profile", data);
      return response.json();
    },
    onSuccess: (data: { success: boolean; profile: ProfileData }) => {
      if (data.success) {
        // Store profile data in sessionStorage for the review page
        sessionStorage.setItem('extractedProfile', JSON.stringify(data.profile));
        sessionStorage.setItem('profileUsername', form.getValues('username'));
        setLocation(`/review/${form.getValues('username')}`);
      } else {
        toast({
          title: "Extraction Failed",
          description: "Failed to extract profile data. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to extract profile data",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UsernameInput) => {
    extractProfileMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          
          {/* Left Side: Headline and Description */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <UserCircle className="mr-2 h-4 w-4" />
                Profile Extractor
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                Extract LinkedIn 
                <span className="text-primary"> Profile Data</span>
                {" "}Instantly
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                Enter any LinkedIn username to automatically extract and organize profile information. No login required.
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Public Profile Access</h3>
                  <p className="text-gray-600">Extracts publicly available information without OAuth</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Filter className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Selective Data Export</h3>
                  <p className="text-gray-600">Choose exactly which information you want to save</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Database className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Structured Output</h3>
                  <p className="text-gray-600">Normalized data ready for your applications</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Side: Form */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900">Get Started</h2>
                  <p className="text-gray-600">Enter the LinkedIn username to extract profile data</p>
                </div>
                
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LinkedIn Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">linkedin.com/in/</span>
                            </div>
                            <Input
                              {...field}
                              placeholder="janedoe"
                              className="pl-32"
                              disabled={extractProfileMutation.isPending}
                            />
                          </div>
                        </FormControl>
                        <p className="text-sm text-gray-500">
                          Just the username part (e.g., "janedoe" not the full URL)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit"
                    className="w-full"
                    disabled={extractProfileMutation.isPending}
                  >
                    {extractProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Extracting Profile...
                      </>
                    ) : (
                      "Extract Profile Data"
                    )}
                  </Button>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center text-sm text-gray-500">
                    <Shield className="mr-2 h-4 w-4 text-green-600" />
                    We only access publicly available profile information
                  </div>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
