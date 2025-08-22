import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Check, User, Mail, Settings as SettingsIcon, Link } from 'lucide-react';
import { useLocation } from 'wouter';

import { MagicCard } from '../../../components/magicui/magic-card';
import { ShimmerButton } from '../../../components/magicui/shimmer-button';
import { BlurFade } from '../../../components/magicui/blur-fade';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

import { useAuthStore } from '@/stores/auth-store';
import { profileUpdateSchema, type ProfileUpdate } from '@shared/schema';

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, updateProfile, isLoading } = useAuthStore();
  const { toast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileUpdate>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      userName: user?.userName || '',
    },
  });

  const handleSubmit = async (data: ProfileUpdate) => {
    try {
      setIsUpdating(true);
      await updateProfile(data);

      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyShareLink = async () => {
    if (!user?.userName) {
      toast({
        title: "Username required",
        description: "You need to set a username before sharing your profile.",
        variant: "destructive",
      });
      return;
    }

    const shareUrl = `${window.location.origin}/${user.userName}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);

      toast({
        title: "Link copied",
        description: "Your profile sharing link has been copied to clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Failed to copy link to clipboard.",
        variant: "destructive",
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <BlurFade delay={0.1}>
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={goBack}
              className="mb-4 text-purple-200 hover:text-white hover:bg-purple-500/20"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Timeline
            </Button>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                <SettingsIcon className="h-6 w-6 text-purple-300" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Settings
                </h1>
                <p className="text-purple-200">Manage your profile and account preferences</p>
              </div>
            </div>
          </div>
        </BlurFade>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Profile Section */}
          <BlurFade delay={0.2}>
            <MagicCard
              className="p-0 overflow-hidden"
              gradientColor="#1e1b4b"
              gradientOpacity={0.8}
              gradientFrom="#9333ea"
              gradientTo="#ec4899"
            >
              <Card className="border-0 bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <User className="h-5 w-5 text-purple-300" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Profile Information</CardTitle>
                      <CardDescription className="text-purple-200">
                        Update your username for profile sharing
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                      {/* Email (Read-only) */}
                      <div className="space-y-2">
                        <Label className="text-purple-200 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Address
                        </Label>
                        <Input
                          value={user.email}
                          disabled
                          className="bg-slate-800/50 border-purple-500/30 text-slate-300 cursor-not-allowed"
                        />
                        <p className="text-xs text-purple-300">
                          Email cannot be changed at this time
                        </p>
                      </div>

                      <Separator className="bg-purple-500/30" />

                      {/* Username */}
                      <FormField
                        control={form.control}
                        name="userName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-purple-200 flex items-center gap-2">
                              <User className="h-4 w-4" />
                              Username
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter your username"
                                className="bg-slate-800/50 border-purple-500/30 text-white placeholder:text-slate-400 focus:border-purple-400 focus:ring-purple-400/20"
                              />
                            </FormControl>
                            <FormDescription className="text-purple-300">
                              Choose a unique username for your shareable profile link.
                              Only letters, numbers, underscores, and dashes are allowed.
                            </FormDescription>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />

                      {/* Submit Button */}
                      <div className="flex justify-end">
                        <ShimmerButton
                          type="submit"
                          disabled={isUpdating || isLoading}
                          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                        >
                          {isUpdating ? 'Updating...' : 'Update Profile'}
                        </ShimmerButton>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </MagicCard>
          </BlurFade>

          {/* Share Profile Section */}
          <BlurFade delay={0.3}>
            <MagicCard
              className="p-0 overflow-hidden"
              gradientColor="#1e1b4b"
              gradientOpacity={0.8}
              gradientFrom="#9333ea"
              gradientTo="#ec4899"
            >
              <Card className="border-0 bg-slate-900/80 backdrop-blur-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                      <Link className="h-5 w-5 text-purple-300" />
                    </div>
                    <div>
                      <CardTitle className="text-white">Share Your Profile</CardTitle>
                      <CardDescription className="text-purple-200">
                        Share your professional journey with others
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {user.userName ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-purple-200">Your Profile Link</Label>
                        <div className="flex gap-2">
                          <Input
                            value={`${window.location.origin}/${user.userName}`}
                            readOnly
                            className="bg-slate-800/50 border-purple-500/30 text-slate-300 cursor-default"
                          />
                          <Button
                            onClick={copyShareLink}
                            variant="outline"
                            size="sm"
                            className="border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white shrink-0"
                          >
                            {copiedLink ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-purple-300">
                        Others can view your timeline using this link. Only nodes you've given permission for will be visible.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 border border-purple-500/30 rounded-lg bg-purple-500/10 text-center">
                      <Link className="h-12 w-12 text-purple-400 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-white mb-2">Set a Username First</h3>
                      <p className="text-purple-200 text-sm">
                        You need to set a username before you can share your profile with others.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </MagicCard>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}
