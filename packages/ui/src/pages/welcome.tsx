import { Button } from '@journey/components';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import logoImage from '../assets/images/logo.png';

interface WelcomeProps {
  onSignIn: () => void;
}

// Feature card data
const features = [
  {
    title: 'Lighthouse AI assesses your current work',
    description:
      'Show your current work and artifacts so Lighthouse AI can understand where you are today and map the path to where you want to go.',
    illustration: 'assess',
  },
  {
    title: 'Capture real-time work sessions',
    description:
      'Record your workflows, skills, processes, and working styles. Your accumulated work will shape your journey narrative and build an accurate reflection your professional style.',
    illustration: 'capture',
  },
  {
    title: 'Review sessions to shape your story',
    description:
      'Reflect on your decisions, refine your intentions, and clarify your narrative so Lighthouse AI can surface relevant insights to propel you forward.',
    illustration: 'review',
  },
];

// Illustration components for each feature card
function AssessIllustration() {
  return (
    <div className="relative h-[120px] w-[120px] overflow-hidden rounded-lg bg-gradient-to-br from-[#E8F5F1] to-[#D4EDE5]">
      {/* Abstract chart/graph illustration */}
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        {/* Background shapes */}
        <rect
          x="15"
          y="20"
          width="90"
          height="80"
          rx="4"
          fill="white"
          fillOpacity="0.8"
        />
        {/* Chart bars */}
        <rect x="25" y="60" width="12" height="30" rx="2" fill="#3D6E63" />
        <rect x="42" y="45" width="12" height="45" rx="2" fill="#5A9A8A" />
        <rect x="59" y="55" width="12" height="35" rx="2" fill="#7BB5A7" />
        <rect x="76" y="35" width="12" height="55" rx="2" fill="#3D6E63" />
        {/* Trend line */}
        <path
          d="M25 55 L45 40 L65 50 L85 30"
          stroke="#A897F2"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Decorative dots */}
        <circle cx="25" cy="55" r="3" fill="#A897F2" />
        <circle cx="45" cy="40" r="3" fill="#A897F2" />
        <circle cx="65" cy="50" r="3" fill="#A897F2" />
        <circle cx="85" cy="30" r="3" fill="#A897F2" />
        {/* Person silhouette */}
        <circle cx="100" cy="25" r="8" fill="#5A9A8A" fillOpacity="0.6" />
        <path
          d="M92 45 Q100 35 108 45"
          stroke="#5A9A8A"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

function CaptureIllustration() {
  return (
    <div className="relative h-[120px] w-[120px] overflow-hidden rounded-lg bg-gradient-to-br from-[#E8F5F1] to-[#D4EDE5]">
      {/* Person at desk illustration */}
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        {/* Desk */}
        <rect x="10" y="75" width="100" height="8" rx="2" fill="#5A9A8A" />
        {/* Monitor */}
        <rect
          x="35"
          y="35"
          width="50"
          height="35"
          rx="3"
          fill="white"
          stroke="#3D6E63"
          strokeWidth="2"
        />
        <rect x="55" y="70" width="10" height="8" fill="#3D6E63" />
        {/* Screen content */}
        <rect x="40" y="42" width="40" height="3" rx="1" fill="#A897F2" />
        <rect x="40" y="48" width="30" height="3" rx="1" fill="#7BB5A7" />
        <rect x="40" y="54" width="35" height="3" rx="1" fill="#7BB5A7" />
        <rect x="40" y="60" width="25" height="3" rx="1" fill="#7BB5A7" />
        {/* Person */}
        <circle cx="25" cy="50" r="10" fill="#5A9A8A" />
        <path
          d="M15 85 Q25 65 35 85"
          stroke="#5A9A8A"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Keyboard */}
        <rect x="40" y="85" width="40" height="6" rx="1" fill="#E0E0E0" />
        {/* Floating elements */}
        <circle cx="95" cy="30" r="5" fill="#A897F2" fillOpacity="0.5" />
        <circle cx="105" cy="45" r="3" fill="#7BB5A7" fillOpacity="0.5" />
        <circle cx="90" cy="55" r="4" fill="#3D6E63" fillOpacity="0.3" />
      </svg>
    </div>
  );
}

function ReviewIllustration() {
  return (
    <div className="relative h-[120px] w-[120px] overflow-hidden rounded-lg bg-gradient-to-br from-[#E8F5F1] to-[#D4EDE5]">
      {/* People collaborating illustration */}
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        {/* Background board/screen */}
        <rect
          x="25"
          y="15"
          width="70"
          height="50"
          rx="4"
          fill="white"
          fillOpacity="0.9"
        />
        {/* Content on board */}
        <rect x="32" y="22" width="25" height="15" rx="2" fill="#A897F2" />
        <rect x="62" y="22" width="25" height="15" rx="2" fill="#7BB5A7" />
        <rect x="32" y="42" width="55" height="3" rx="1" fill="#E0E0E0" />
        <rect x="32" y="48" width="40" height="3" rx="1" fill="#E0E0E0" />
        <rect x="32" y="54" width="50" height="3" rx="1" fill="#E0E0E0" />
        {/* Person 1 - left */}
        <circle cx="30" cy="85" r="12" fill="#5A9A8A" />
        <path
          d="M18 115 Q30 95 42 115"
          stroke="#5A9A8A"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        {/* Person 2 - right */}
        <circle cx="90" cy="85" r="12" fill="#3D6E63" />
        <path
          d="M78 115 Q90 95 102 115"
          stroke="#3D6E63"
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
        />
        {/* Connection/conversation indicators */}
        <circle cx="60" cy="75" r="3" fill="#A897F2" />
        <circle cx="50" cy="80" r="2" fill="#7BB5A7" />
        <circle cx="70" cy="80" r="2" fill="#7BB5A7" />
      </svg>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  illustration,
  index,
}: {
  title: string;
  description: string;
  illustration: string;
  index: number;
}) {
  const IllustrationComponent =
    illustration === 'assess'
      ? AssessIllustration
      : illustration === 'capture'
        ? CaptureIllustration
        : ReviewIllustration;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1, duration: 0.4 }}
      className="flex w-full max-w-[683px] gap-6 overflow-hidden rounded-xl bg-white p-3 shadow-[0px_0px_42px_0px_rgba(0,0,0,0.08)]"
    >
      <IllustrationComponent />
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        <h3 className="text-xl font-semibold leading-[30px] tracking-[-0.05px] text-[#1d1e21]">
          {title}
        </h3>
        <p className="text-base font-normal leading-6 tracking-[-0.05px] text-[#1d1e21]">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

export default function Welcome({ onSignIn }: WelcomeProps) {
  return (
    <div className="flex min-h-screen flex-col items-start bg-white">
      {/* Content area */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-8 bg-[#f6f6f6] px-8 py-12">
        {/* Header with logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-4"
        >
          <span className="text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#2e2e2e]">
            Welcome to
          </span>
          <div className="flex items-center justify-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
              style={{
                backgroundImage:
                  'linear-gradient(117.825deg, rgb(154, 198, 181) 38.636%, rgb(168, 151, 242) 85.27%)',
              }}
            >
              <img src={logoImage} alt="Lighthouse" className="h-7 w-7" />
            </div>
            <span className="text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#2e2e2e]">
              Lighthouse AI
            </span>
          </div>
        </motion.div>

        {/* Feature cards */}
        <div className="flex flex-col items-center gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              illustration={feature.illustration}
              index={index}
            />
          ))}
        </div>

        {/* Sign in button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <Button
            onClick={onSignIn}
            className="flex items-center justify-center gap-2.5 rounded-lg bg-[#3d6e63] px-[22px] py-[14px] text-base font-semibold leading-6 text-white shadow-[0px_2px_5px_0px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_0px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#2d5a4f]"
          >
            <span>Sign in to your account</span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
