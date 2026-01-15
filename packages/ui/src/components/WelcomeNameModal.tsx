/**
 * WelcomeNameModal Component
 *
 * Modal that prompts users to enter their name when they first access the main app.
 * Shows for users who have completed onboarding but haven't set their name yet.
 */

import { Button } from '@journey/components';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@journey/components';
import { Input } from '@journey/components';
import { Label } from '@journey/components';
import { User } from 'lucide-react';
import { useState } from 'react';

import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import { useToast } from '../hooks/use-toast';
import { useUpdateProfile } from '../hooks/useAuth';

interface WelcomeNameModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function WelcomeNameModal({ isOpen, onComplete }: WelcomeNameModalProps) {
  const { track } = useAnalytics();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'continue',
      button_location: 'welcome_name_modal',
    });

    if (!firstName.trim()) {
      toast({
        title: 'First name required',
        description: 'Please enter your first name to continue.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
      });

      track(AnalyticsEvents.PROFILE_UPDATED, {
        fields_updated: ['firstName', lastName.trim() ? 'lastName' : null].filter(Boolean),
        location: 'welcome_name_modal',
      });

      toast({
        title: 'Welcome!',
        description: `Nice to meet you, ${firstName}!`,
      });

      onComplete();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save your name. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSkip = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'skip',
      button_location: 'welcome_name_modal',
    });
    // Allow users to skip, but they'll see "User's Journey" until they set their name in settings
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Welcome to Lighthouse!</DialogTitle>
          <DialogDescription className="text-center">
            Let's personalize your experience. What should we call you?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              placeholder="Enter your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoFocus
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name (optional)</Label>
            <Input
              id="lastName"
              placeholder="Enter your last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isPending}
            />
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button type="submit" disabled={isPending || !firstName.trim()}>
              {isPending ? 'Saving...' : 'Continue'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              disabled={isPending}
              className="text-muted-foreground"
            >
              Skip for now
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
