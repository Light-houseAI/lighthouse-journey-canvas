import { zodResolver } from '@hookform/resolvers/zod';
import { type ProfileUpdate, profileUpdateSchema } from '@journey/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Copy, Link, Mail, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';

import logoImage from '../assets/images/logo.png';
import { BlurFade } from '@journey/components';
import { Button } from '@journey/components';  // was: button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@journey/components';  // was: card
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@journey/components';  // was: form
import { Input } from '@journey/components';  // was: input
import { Label } from '@journey/components';  // was: label
import { Separator } from '@journey/components';  // was: separator
import { UserMenu } from '../components/ui/user-menu';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../hooks/use-toast';
import { useAuthStore } from '../stores/auth-store';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, updateProfile, isLoading } = useAuthStore();
  const { theme } = useTheme();
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<ProfileUpdate>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      userName: user?.userName || '',
    },
  });

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        userName: user.userName || '',
      });
    }
  }, [user, form]);

  // TanStack Query mutation for profile updates
  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      // Reset form with updated data from server
      form.reset({
        firstName: updatedUser.firstName || '',
        lastName: updatedUser.lastName || '',
        userName: updatedUser.userName || '',
      });

      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });

      // Invalidate related queries if any
      queryClient.invalidateQueries({ queryKey: ['user', 'profile'] });
    },
    onError: () => {
      toast({
        title: 'Update failed',
        description: 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (data: ProfileUpdate) => {
    await updateProfileMutation.mutateAsync(data);
  };

  const copyShareLink = async () => {
    if (!user?.userName) {
      toast({
        title: 'Username required',
        description: 'You need to set a username before sharing your profile.',
        variant: 'destructive',
      });
      return;
    }

    const shareUrl = `${window.location.origin}/profile/${user.userName}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);

      toast({
        title: 'Link copied',
        description: 'Your profile sharing link has been copied to clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy link to clipboard.',
        variant: 'destructive',
      });
    }
  };

  const goBack = () => {
    setLocation('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className={`min-h-screen ${theme.backgroundGradient}`}>
      {/* Header matching Figma design */}
      <div
        className={`${theme.backgroundGradient} border-b border-gray-200 px-6 py-4 shadow-[0px_1px_4px_0px_rgba(12,12,13,0.1),0px_1px_4px_0px_rgba(12,12,13,0.05)]`}
      >
        <div className="flex items-center justify-between">
          {/* Logo + Product Name */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[23px]">
              <img
                src={logoImage}
                alt="Lighthouse AI"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="text-xl font-semibold leading-[30px] tracking-[-0.05px] text-black">
              Lighthouse AI
            </div>
          </div>

          {/* Right Content */}
          <div className="flex items-center gap-4">{user && <UserMenu />}</div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <BlurFade delay={0.1}>
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={goBack}
              className={`mb-4 ${theme.secondaryText} hover:${theme.cardBackground}`}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Timeline
            </Button>

            <div>
              <h1
                className={`text-[36px] font-bold ${theme.primaryText} leading-[44px] tracking-[-0.05px]`}
              >
                Account settings
              </h1>
            </div>
          </div>
        </BlurFade>

        <div className="mx-auto max-w-4xl space-y-6">
          {/* Profile Section */}
          <BlurFade delay={0.2}>
            <Card
              className={`${theme.cardBackground} ${theme.cardShadow} rounded-[8px] border-0`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${theme.primaryBorder} border`}
                  >
                    <User className={`h-5 w-5 ${theme.secondaryText}`} />
                  </div>
                  <div>
                    <CardTitle className={theme.primaryText}>
                      Profile Information
                    </CardTitle>
                    <CardDescription className={theme.secondaryText}>
                      Update your personal information and username for profile
                      sharing
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleSubmit)}
                    className="space-y-6"
                  >
                    {/* Email (Read-only) */}
                    <div className="space-y-2">
                      <Label
                        className={`${theme.secondaryText} flex items-center gap-2`}
                      >
                        <Mail className="h-4 w-4" />
                        Email Address
                      </Label>
                      <Input
                        value={user.email}
                        disabled
                        className={`${theme.inputBackground} ${theme.primaryBorder} border ${theme.mutedText} cursor-not-allowed`}
                      />
                      <p className={`text-xs ${theme.mutedText}`}>
                        Email cannot be changed at this time
                      </p>
                    </div>

                    <Separator className={theme.primaryBorder} />

                    {/* First Name */}
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className={`${theme.secondaryText} flex items-center gap-2`}
                          >
                            <User className="h-4 w-4" />
                            First Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your first name"
                              className={`${theme.inputBackground} ${theme.primaryBorder} border ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus}`}
                            />
                          </FormControl>
                          <FormDescription className={theme.mutedText}>
                            Your first name for your profile.
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    {/* Last Name */}
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className={`${theme.secondaryText} flex items-center gap-2`}
                          >
                            <User className="h-4 w-4" />
                            Last Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your last name"
                              className={`${theme.inputBackground} ${theme.primaryBorder} border ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus}`}
                            />
                          </FormControl>
                          <FormDescription className={theme.mutedText}>
                            Your last name for your profile.
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <Separator className={theme.primaryBorder} />

                    {/* Username */}
                    <FormField
                      control={form.control}
                      name="userName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel
                            className={`${theme.secondaryText} flex items-center gap-2`}
                          >
                            <User className="h-4 w-4" />
                            Username
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your username"
                              className={`${theme.inputBackground} ${theme.primaryBorder} border ${theme.primaryText} placeholder:${theme.placeholderText} ${theme.focusBorder} ${theme.focus}`}
                            />
                          </FormControl>
                          <FormDescription className={theme.mutedText}>
                            Choose a unique username for your shareable profile
                            link. Only letters, numbers, underscores, and dashes
                            are allowed.
                          </FormDescription>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    {/* Submit Button */}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending || isLoading}
                        className="bg-[#2E2E2E] text-white hover:bg-[#454C52]"
                      >
                        {updateProfileMutation.isPending
                          ? 'Updating...'
                          : 'Update Profile'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Share Profile Section */}
          <BlurFade delay={0.3}>
            <Card
              className={`${theme.cardBackground} ${theme.cardShadow} rounded-[8px] border-0`}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-lg p-2 ${theme.primaryBorder} border`}
                  >
                    <Link className={`h-5 w-5 ${theme.secondaryText}`} />
                  </div>
                  <div>
                    <CardTitle className={theme.primaryText}>
                      Share Your Profile
                    </CardTitle>
                    <CardDescription className={theme.secondaryText}>
                      Share your professional journey with others
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {user.userName ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className={theme.secondaryText}>
                        Your Profile Link
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={`${window.location.origin}/profile/${user.userName}`}
                          readOnly
                          className={`${theme.inputBackground} ${theme.primaryBorder} border ${theme.mutedText} cursor-default`}
                        />
                        <Button
                          onClick={copyShareLink}
                          variant="outline"
                          size="sm"
                          className={`${theme.primaryBorder} border ${theme.secondaryText} ${theme.hover} shrink-0`}
                        >
                          {copiedLink ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <p className={`text-sm ${theme.mutedText}`}>
                      Others can view your timeline using this link whichever
                      journeys you shared.
                    </p>
                  </div>
                ) : (
                  <div
                    className={`p-6 ${theme.primaryBorder} rounded-lg border ${theme.glassBackground} text-center`}
                  >
                    <Link
                      className={`h-12 w-12 ${theme.secondaryText} mx-auto mb-3`}
                    />
                    <h3
                      className={`text-lg font-semibold ${theme.primaryText} mb-2`}
                    >
                      Set a Username First
                    </h3>
                    <p className={`${theme.secondaryText} text-sm`}>
                      You need to set a username before you can share your
                      profile with others.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
