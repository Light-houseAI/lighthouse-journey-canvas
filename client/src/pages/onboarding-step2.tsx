import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4">
            <div className="flex justify-center space-x-2">
              <div className="w-8 h-2 bg-blue-600 rounded"></div>
              <div className="w-8 h-2 bg-blue-600 rounded"></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Step 2 of 2</p>
          </div>
          <CardTitle className="text-2xl font-bold">Let's extract your professional data</CardTitle>
          <CardDescription>
            Enter your LinkedIn username to get comprehensive profile information from multiple sources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">LinkedIn Username</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  linkedin.com/in/
                </span>
                <Input
                  id="username"
                  type="text"
                  placeholder="yourname"
                  className="rounded-l-none"
                  {...form.register("username")}
                  disabled={isExtracting}
                />
              </div>
              {form.formState.errors.username && (
                <p className="text-sm text-red-600">{form.formState.errors.username.message}</p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We'll extract data from LinkedIn, People Data Labs, GitHub, and other professional sources
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isExtracting}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting profile data...
                </>
              ) : (
                "Extract Profile Data"
              )}
            </Button>
          </form>

          {isExtracting && (
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This may take a few moments as we gather comprehensive data from multiple sources...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}