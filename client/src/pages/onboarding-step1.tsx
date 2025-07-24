import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { interestSchema, type Interest } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const interestOptions = [
  { value: "find-job", label: "Find a new job", description: "Looking for new career opportunities" },
  { value: "grow-career", label: "Grow in my career", description: "Advance in my current field" },
  { value: "change-careers", label: "Change careers", description: "Switch to a different industry" },
  { value: "start-startup", label: "Start a startup", description: "Build my own company" },
];

export default function OnboardingStep1() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<Interest>({
    resolver: zodResolver(interestSchema),
  });

  const interestMutation = useMutation({
    mutationFn: async (data: Interest) => {
      const response = await apiRequest("POST", "/api/onboarding/interest", data);
      return response.json();
    },
    onSuccess: () => {
      setLocation("/onboarding/step2");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Interest) => {
    interestMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="mb-4">
            <div className="flex justify-center space-x-2">
              <div className="w-8 h-2 bg-blue-600 rounded"></div>
              <div className="w-8 h-2 bg-gray-300 rounded"></div>
            </div>
            <p className="text-sm text-gray-600 mt-2">Step 1 of 2</p>
          </div>
          <CardTitle className="text-2xl font-bold">What are you most interested in?</CardTitle>
          <CardDescription>
            This helps us tailor your experience to your goals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <RadioGroup
              onValueChange={(value) => form.setValue("interest", value as any)}
              className="space-y-4"
            >
              {interestOptions.map((option) => (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor={option.value} className="text-base font-medium cursor-pointer">
                      {option.label}
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>

            {form.formState.errors.interest && (
              <p className="text-sm text-red-600">{form.formState.errors.interest.message}</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={interestMutation.isPending}
            >
              {interestMutation.isPending ? "Saving..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}