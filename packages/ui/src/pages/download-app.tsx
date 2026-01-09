import { Button } from '@journey/components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@journey/components';
import { motion } from 'framer-motion';
import {
  Apple,
  ChevronLeft,
  Download,
  Loader2,
  MonitorSmartphone,
  Play,
} from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';
import { useLogout } from '../hooks/useAuth';
import { useCreateDesktopTrack } from '../hooks/useOnboarding';
import { useToast } from '../hooks/use-toast';

// Desktop app download URL for Mac
const MAC_APP_DOWNLOAD_URL =
  'https://storage.googleapis.com/lighthouse-ai-desktop-releases/desktop-app-releases/v9.0.0/Lighthouse-AI-1.0.0.dmg';

export default function DownloadApp() {
  const { theme } = useTheme();
  const logoutMutation = useLogout();
  const createDesktopTrackMutation = useCreateDesktopTrack();
  const { toast } = useToast();

  const handleBackToSignIn = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDownload = () => {
    window.open(MAC_APP_DOWNLOAD_URL, '_blank');
  };

  // Mock function to simulate desktop app pushing track data
  const handleMockDesktopTrack = async () => {
    try {
      const mockTrackData = {
        companyName: 'Acme Corp',
        role: 'Software Engineer',
        startDate: '2024-01',
        description:
          'Building innovative products and leading technical initiatives.',
        location: 'San Francisco, CA',
      };

      await createDesktopTrackMutation.mutateAsync(mockTrackData);

      toast({
        title: 'Track created successfully!',
        description: 'Your journey will now update to show your work history.',
      });
    } catch (error) {
      console.error('Mock desktop track error:', error);
      toast({
        title: 'Failed to create track',
        description:
          error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Background with gradient and subtle pattern */}
      <div className={`absolute inset-0 ${theme.backgroundGradient}`}>
        <div className="absolute inset-0 opacity-20">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(2px 2px at 30px 40px, #3B82F6, transparent), radial-gradient(2px 2px at 60px 90px, #60A5FA, transparent), radial-gradient(1px 1px at 110px 50px, #93C5FD, transparent), radial-gradient(1px 1px at 150px 100px, #3B82F6, transparent), radial-gradient(2px 2px at 180px 40px, #60A5FA, transparent)',
              backgroundRepeat: 'repeat',
              backgroundSize: '220px 120px',
            }}
          />
        </div>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-2xl"
      >
        <Card
          className={`${theme.primaryBorder} ${theme.cardShadow} transition-all duration-500 hover:shadow-lg ${theme.cardBackground} backdrop-blur-xl`}
        >
          <CardHeader className="p-6 pb-4 text-center sm:p-8 sm:pb-6 md:p-10 md:pb-8">
            {/* Back Navigation */}
            <motion.div
              className="mb-4 flex justify-start sm:mb-6"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.4 }}
            >
              <Button
                onClick={handleBackToSignIn}
                variant="ghost"
                className={`flex items-center gap-2 text-sm ${theme.secondaryText} h-auto rounded px-1 py-0.5 transition-colors duration-200 hover:text-[#3B82F6] hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:ring-offset-2`}
              >
                <ChevronLeft className="h-4 w-4" />
                Sign Out
              </Button>
            </motion.div>

            {/* Icon */}
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
            >
              <div className="rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-6 backdrop-blur-sm">
                <MonitorSmartphone className="h-16 w-16 text-blue-400" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <CardTitle
                className={`text-2xl font-bold sm:text-3xl ${theme.primaryText} mb-3 drop-shadow-lg sm:mb-4`}
              >
                Download the Mac App
              </CardTitle>
              <CardDescription
                className={`${theme.secondaryText} text-base font-medium sm:text-lg`}
              >
                Get started by downloading the Lighthouse AI desktop app for
                Mac. The app will automatically sync your work tracks to your
                journey.
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="p-6 pt-0 sm:p-8 sm:pt-0 md:p-10 md:pt-0">
            {/* Download Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-col items-center gap-4"
            >
              <Button
                onClick={handleDownload}
                className="flex w-full max-w-sm items-center justify-center gap-3 rounded-xl border-0 bg-gradient-to-r from-blue-500 to-blue-600 px-8 py-5 text-lg font-bold text-white transition-all duration-300 hover:from-blue-600 hover:to-blue-700 hover:shadow-lg hover:shadow-blue-500/25"
              >
                <Apple className="h-6 w-6" />
                Download for Mac
                <Download className="h-5 w-5" />
              </Button>

              <p className={`text-sm ${theme.secondaryText}`}>
                macOS 11.0 (Big Sur) or later required
              </p>
            </motion.div>

            {/* Instructions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="mt-8 space-y-4"
            >
              <h3
                className={`text-center text-lg font-semibold ${theme.primaryText}`}
              >
                What happens next?
              </h3>

              <div className="space-y-3">
                {[
                  {
                    step: '1',
                    title: 'Install the app',
                    description:
                      'Open the downloaded DMG file and drag Lighthouse AI to your Applications folder.',
                  },
                  {
                    step: '2',
                    title: 'Create your first track',
                    description:
                      'The desktop app will guide you through creating work tracks as you use your Mac.',
                  },
                  {
                    step: '3',
                    title: 'Your journey updates automatically',
                    description:
                      'Once tracks are created, this page will refresh and show your professional journey.',
                  },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    className={`flex gap-4 rounded-lg border p-4 ${theme.primaryBorder} ${theme.cardBackground} backdrop-blur-sm`}
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
                      {item.step}
                    </div>
                    <div>
                      <h4
                        className={`font-semibold ${theme.primaryText} text-sm sm:text-base`}
                      >
                        {item.title}
                      </h4>
                      <p
                        className={`text-sm ${theme.secondaryText} mt-1 leading-relaxed`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Status indicator and mock testing button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="mt-8 flex flex-col items-center gap-4"
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                <span className={`text-sm ${theme.secondaryText}`}>
                  Waiting for desktop app connection...
                </span>
              </div>

              {/* Mock button for testing - simulates desktop app pushing data */}
              <div
                className={`rounded-lg border p-4 ${theme.primaryBorder} ${theme.cardBackground} w-full max-w-sm backdrop-blur-sm`}
              >
                <p
                  className={`mb-3 text-center text-xs ${theme.secondaryText}`}
                >
                  For testing: Simulate desktop app creating a track
                </p>
                <Button
                  onClick={handleMockDesktopTrack}
                  disabled={createDesktopTrackMutation.isPending}
                  variant="outline"
                  className={`flex w-full items-center justify-center gap-2 ${theme.primaryBorder}`}
                >
                  {createDesktopTrackMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating track...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Simulate Desktop Track
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

