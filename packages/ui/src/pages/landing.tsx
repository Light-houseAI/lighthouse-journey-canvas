import { Button } from '@journey/components';
import { motion } from 'framer-motion';
import { ArrowRight, Mail } from 'lucide-react';
import React, { useState } from 'react';

import { useAnalytics, AnalyticsEvents } from '../hooks/useAnalytics';
import logoImage from '../assets/images/logo.png';
// Hero section images - save these to assets/images/
import heroQuestionMark from '../assets/images/hero-question-mark.png';
import heroRelaxing from '../assets/images/hero-relaxing.png';
import heroCollaboration from '../assets/images/hero-collaboration.png';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onBlog: () => void;
}

// Hero Illustration Component - uses actual images
function HeroIllustration() {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Three images arranged horizontally */}
      <div className="flex items-end gap-4">
        <img 
          src={heroQuestionMark} 
          alt="People with questions" 
          className="h-auto w-[180px] object-contain"
        />
        <img 
          src={heroRelaxing} 
          alt="Person relaxing with analytics" 
          className="h-auto w-[220px] object-contain"
        />
        <img 
          src={heroCollaboration} 
          alt="Team collaboration" 
          className="h-auto w-[200px] object-contain"
        />
      </div>
    </div>
  );
}

function QuestionMarkIllustration() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img 
        src={heroQuestionMark} 
        alt="People with knowledge gaps" 
        className="h-auto max-h-[400px] w-auto max-w-full object-contain"
      />
    </div>
  );
}

function TrappedWorkIllustration() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <img 
        src={heroRelaxing} 
        alt="Work trapped in your head" 
        className="h-auto max-h-[400px] w-auto max-w-full object-contain"
      />
    </div>
  );
}

function AnalyzeIllustration() {
  return (
    <svg viewBox="0 0 460 307" fill="none" className="h-full w-full">
      {/* Chart background */}
      <rect x="30" y="20" width="400" height="250" rx="12" fill="white" />
      {/* Grid lines */}
      <line x1="80" y1="50" x2="80" y2="240" stroke="#E0E7E4" strokeWidth="1" />
      <line x1="80" y1="240" x2="400" y2="240" stroke="#E0E7E4" strokeWidth="1" />
      {/* Bar chart */}
      <rect x="100" y="180" width="40" height="60" rx="4" fill="#3D6E63" />
      <rect x="160" y="140" width="40" height="100" rx="4" fill="#9AC6B5" />
      <rect x="220" y="100" width="40" height="140" rx="4" fill="#A897F2" />
      <rect x="280" y="120" width="40" height="120" rx="4" fill="#634CC7" />
      <rect x="340" y="80" width="40" height="160" rx="4" fill="#3D6E63" />
      {/* Trend line */}
      <path d="M120 170 L180 130 L240 90 L300 110 L360 70" stroke="#634CC7" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Data points */}
      <circle cx="120" cy="170" r="6" fill="#634CC7" />
      <circle cx="180" cy="130" r="6" fill="#634CC7" />
      <circle cx="240" cy="90" r="6" fill="#634CC7" />
      <circle cx="300" cy="110" r="6" fill="#634CC7" />
      <circle cx="360" cy="70" r="6" fill="#634CC7" />
      {/* Magnifying glass */}
      <circle cx="380" cy="60" r="25" stroke="#3D6E63" strokeWidth="4" fill="white" />
      <line x1="400" y1="80" x2="420" y2="100" stroke="#3D6E63" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function AIAgentIllustration() {
  return (
    <svg viewBox="0 0 460 337" fill="none" className="h-full w-full">
      {/* Background */}
      <rect x="20" y="20" width="420" height="280" rx="12" fill="#F0F4F8" />
      {/* AI text */}
      <text x="180" y="200" fontSize="120" fontWeight="bold" fill="#634CC7" fontFamily="Inter">AI</text>
      {/* Robot head outline */}
      <rect x="280" y="80" width="120" height="100" rx="20" fill="white" stroke="#3D6E63" strokeWidth="3" />
      {/* Robot eyes */}
      <circle cx="310" cy="120" r="12" fill="#A897F2" />
      <circle cx="370" cy="120" r="12" fill="#A897F2" />
      <circle cx="310" cy="120" r="5" fill="#634CC7" />
      <circle cx="370" cy="120" r="5" fill="#634CC7" />
      {/* Robot mouth */}
      <rect x="300" y="150" width="80" height="15" rx="4" fill="#9AC6B5" />
      {/* Antenna */}
      <line x1="340" y1="80" x2="340" y2="50" stroke="#3D6E63" strokeWidth="3" />
      <circle cx="340" cy="45" r="8" fill="#A897F2" />
      {/* Code symbols */}
      <text x="50" y="100" fontSize="30" fill="#3D6E63" fontFamily="monospace">&lt;/&gt;</text>
      <text x="60" y="250" fontSize="24" fill="#9AC6B5" fontFamily="monospace">{'{}'}</text>
      {/* Connection lines */}
      <path d="M100 120 Q150 150 180 130" stroke="#A897F2" strokeWidth="2" strokeDasharray="4,4" fill="none" />
      <path d="M100 230 Q140 200 180 220" stroke="#9AC6B5" strokeWidth="2" strokeDasharray="4,4" fill="none" />
    </svg>
  );
}

function ReportsIllustration() {
  return (
    <svg viewBox="0 0 460 345" fill="none" className="h-full w-full">
      {/* Background */}
      <ellipse cx="230" cy="310" rx="180" ry="25" fill="#E8F0ED" />
      {/* Document stack */}
      <rect x="120" y="80" width="200" height="250" rx="8" fill="#E8E8E8" transform="rotate(-5 120 80)" />
      <rect x="130" y="70" width="200" height="250" rx="8" fill="#F0F0F0" transform="rotate(-2 130 70)" />
      <rect x="140" y="60" width="200" height="250" rx="8" fill="white" stroke="#E0E7E4" strokeWidth="2" />
      {/* Document content */}
      <rect x="160" y="90" width="120" height="12" rx="2" fill="#3D6E63" />
      <rect x="160" y="115" width="160" height="8" rx="2" fill="#E0E7E4" />
      <rect x="160" y="135" width="140" height="8" rx="2" fill="#E0E7E4" />
      <rect x="160" y="155" width="150" height="8" rx="2" fill="#E0E7E4" />
      {/* Chart in document */}
      <rect x="160" y="180" width="160" height="80" rx="4" fill="#F8F8F8" />
      <rect x="175" y="220" width="20" height="30" rx="2" fill="#A897F2" />
      <rect x="205" y="200" width="20" height="50" rx="2" fill="#9AC6B5" />
      <rect x="235" y="210" width="20" height="40" rx="2" fill="#634CC7" />
      <rect x="265" y="190" width="20" height="60" rx="2" fill="#3D6E63" />
      {/* Person presenting */}
      <circle cx="400" cy="180" r="35" fill="#F5D0C5" />
      <path d="M365 320 Q400 220 435 320" fill="#634CC7" />
      <ellipse cx="400" cy="155" rx="25" ry="18" fill="#4A3728" />
      {/* Pointer */}
      <line x1="370" y1="220" x2="320" y2="180" stroke="#2E2E2E" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ComputerIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
      <rect width="80" height="80" rx="8" fill="#013B84" />
      {/* Monitor */}
      <rect x="15" y="18" width="50" height="35" rx="3" fill="white" />
      <rect x="18" y="21" width="44" height="29" rx="2" fill="#E8F0ED" />
      {/* Screen content */}
      <rect x="22" y="26" width="20" height="3" rx="1" fill="#3D6E63" />
      <rect x="22" y="32" width="36" height="2" rx="1" fill="#9AC6B5" />
      <rect x="22" y="37" width="30" height="2" rx="1" fill="#9AC6B5" />
      <rect x="22" y="42" width="34" height="2" rx="1" fill="#9AC6B5" />
      {/* Stand */}
      <rect x="35" y="53" width="10" height="5" fill="white" />
      <rect x="28" y="58" width="24" height="4" rx="2" fill="white" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
      <rect width="80" height="80" rx="8" fill="#013B84" />
      {/* Gear */}
      <path
        d="M40 25 L43 25 L45 20 L48 20 L50 25 L55 27 L58 23 L61 25 L59 30 L62 35 L67 35 L67 38 L62 40 L62 45 L67 47 L65 50 L60 48 L55 52 L57 57 L54 59 L50 55 L45 57 L45 62 L42 62 L40 57 L35 57 L33 62 L30 62 L30 57 L25 55 L22 59 L19 57 L22 52 L18 48 L13 50 L11 47 L16 45 L16 40 L11 38 L13 35 L18 35 L20 30 L17 25 L20 23 L25 27 L30 25 L32 20 L35 20 L37 25 Z"
        fill="white"
      />
      <circle cx="40" cy="40" r="10" fill="#013B84" />
      <circle cx="40" cy="40" r="6" fill="white" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" className="h-full w-full">
      <rect width="80" height="80" rx="8" fill="#013B84" />
      {/* Chart bars */}
      <rect x="15" y="45" width="12" height="20" rx="2" fill="white" />
      <rect x="34" y="30" width="12" height="35" rx="2" fill="white" />
      <rect x="53" y="20" width="12" height="45" rx="2" fill="white" />
      {/* Trend line */}
      <path d="M21 42 L40 28 L59 18" stroke="#9AC6B5" strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Dots */}
      <circle cx="21" cy="42" r="4" fill="#A897F2" />
      <circle cx="40" cy="28" r="4" fill="#A897F2" />
      <circle cx="59" cy="18" r="4" fill="#A897F2" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
      <rect width="32" height="32" rx="16" fill="#4A4F4E" />
      <path
        d="M12 13H9V23H12V13ZM10.5 11.5C11.6 11.5 12.5 10.6 12.5 9.5C12.5 8.4 11.6 7.5 10.5 7.5C9.4 7.5 8.5 8.4 8.5 9.5C8.5 10.6 9.4 11.5 10.5 11.5ZM23 23H20V18C20 16.3 19.3 15.5 18 15.5C16.7 15.5 16 16.5 16 18V23H13V13H16V14.5C16.5 13.5 17.8 12.8 19 12.8C21.2 12.8 23 14.3 23 17.5V23Z"
        fill="white"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
      <rect width="32" height="32" rx="16" fill="#4A4F4E" />
      <path
        d="M18.244 14.312L23.552 8H22.117L17.587 13.376L13.956 8H9L14.552 16.924L9 23.5H10.435L15.209 17.86L19.044 23.5H24L18.244 14.312ZM15.948 17.016L15.289 16.088L10.952 9.1H13.256L16.544 13.664L17.203 14.592L22.117 22.4H19.813L15.948 17.016Z"
        fill="white"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 70 70" fill="none" className="h-full w-full">
      <circle cx="35" cy="35" r="35" fill="url(#sendGradient)" />
      <path
        d="M25 35L45 25L40 45L35 38L25 35Z"
        fill="white"
        transform="rotate(-30 35 35)"
      />
      <defs>
        <linearGradient id="sendGradient" x1="0" y1="70" x2="70" y2="0">
          <stop offset="10.27%" stopColor="#747DEF" />
          <stop offset="100%" stopColor="#5E3BE1" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Section Components
function NavBar({ onSignIn, onSignUp, onBlog }: { onSignIn: () => void; onSignUp: () => void; onBlog: () => void }) {
  const { track } = useAnalytics();

  const handleSignIn = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'sign_in',
      button_location: 'landing_navbar',
    });
    onSignIn();
  };

  const handleSignUp = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'sign_up',
      button_location: 'landing_navbar',
    });
    onSignUp();
  };

  const handleBlog = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'blog',
      button_location: 'landing_navbar',
    });
    onBlog();
  };

  return (
    <nav className="flex w-full items-center justify-between border-b border-black/20 bg-[#F3F4F8] px-20 py-[18px]">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
          style={{
            background: 'linear-gradient(117.82deg, #9AC6B5 38.64%, #A897F2 85.27%)',
          }}
        >
          <img src={logoImage} alt="Lighthouse" className="h-7 w-7" />
        </div>
        <span className="text-xl font-semibold text-[#040606]">Lighthouse AI</span>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-8">
        <span className="text-base font-semibold text-[#040606]">Home</span>
        <button
          onClick={handleBlog}
          className="text-base font-medium text-[#4A4F4E] hover:text-black transition-colors"
        >
          Blog
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handleSignIn}
          className="h-[52px] rounded-lg bg-white px-[22px] py-[14px] text-base font-semibold text-black shadow-[0px_2px_5px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_rgba(0,0,0,0.12)] hover:bg-gray-50"
        >
          Sign in
        </Button>
        <Button
          onClick={handleSignUp}
          className="h-[52px] rounded-lg bg-black px-[22px] py-[14px] text-base font-semibold text-white shadow-[0px_2px_5px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_rgba(0,0,0,0.12)] hover:bg-gray-900"
        >
          Sign up
        </Button>
      </div>
    </nav>
  );
}

function HeroSection({ onGetStarted }: { onGetStarted: () => void }) {
  const { track } = useAnalytics();

  const handleGetStarted = () => {
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'get_started',
      button_location: 'landing_hero',
    });
    onGetStarted();
  };

  return (
    <section className="flex w-full items-center gap-6 bg-white px-20 py-6">
      {/* Text Content */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="flex max-w-[609px] flex-1 flex-col justify-center gap-6"
      >
        <h1 className="text-5xl font-bold leading-[56px] tracking-[-0.05px] text-[#2E2E2E]">
          Master your workflow and scale it
        </h1>
        <p className="text-base font-bold leading-6 tracking-[-0.05px] text-[#2E2E2E]">
          <span className="font-bold">Lighthouse AI learns how you work</span> by observing your on-screen work in real
          time. We optimize your craft and automate the repetitive, manual tasks, while
          you take credit for your hard-earned experience.
        </p>
        <Button
          onClick={handleGetStarted}
          className="flex h-14 w-fit items-center gap-2.5 rounded-lg bg-black px-6 py-4 text-base font-semibold text-white shadow-[0px_2px_5px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_rgba(0,0,0,0.12)] hover:bg-gray-900"
        >
          Get started
          <ArrowRight className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Hero Illustration */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="h-[647px] w-[647px] flex-shrink-0"
      >
        <HeroIllustration />
      </motion.div>
    </section>
  );
}

function KeyProblemsSection() {
  return (
    <section className="flex w-full flex-col items-center gap-12 bg-[#F3F4F8] px-20 py-20">
      {/* Section Header */}
      <div className="flex flex-col items-center gap-4">
        <span
          className="text-[26px] font-semibold"
          style={{
            background: 'linear-gradient(90deg, #3D6E63 20.19%, #634CC7 91.97%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Key problems
        </span>
        <h2 className="text-center text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#0F172A]">
          What we're trying to solve
        </h2>
      </div>

      {/* Problem 1 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex w-full max-w-[1280px] items-center gap-12"
      >
        <div className="h-[400px] w-[620px] flex-shrink-0">
          <QuestionMarkIllustration />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-[28px] font-semibold leading-9 tracking-[-0.05px] text-black">
            Everybody has knowledge gaps
          </h3>
          <ul className="flex flex-col gap-2 text-xl leading-[29px] tracking-[-0.05px] text-[#0F172A]">
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0F172A]" />
              Outdated ways of working quietly lead to operational friction, slowdowns, and inconsistent execution across teams.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0F172A]" />
              Without visibility into how work is actually being done — and what better patterns exist — companies can't optimize or modernize their operations.
            </li>
          </ul>
        </div>
      </motion.div>

      {/* Problem 2 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="flex w-full max-w-[1280px] items-center gap-12"
      >
        <div className="flex flex-1 flex-col gap-3">
          <h3 className="text-[28px] font-semibold leading-9 tracking-[-0.05px] text-black">
            Your best work is trapped in your head
          </h3>
          <ul className="flex flex-col gap-2 text-xl leading-[29px] tracking-[-0.05px] text-[#0F172A]">
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0F172A]" />
              You've developed unique shortcuts and workflows that make you elite, but that knowledge is invisible, unshared, and not monetized.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0F172A]" />
              You're repeating the same process every day instead of building a library of expertise.
            </li>
          </ul>
        </div>
        <div className="h-[400px] w-[620px] flex-shrink-0">
          <TrappedWorkIllustration />
        </div>
      </motion.div>
    </section>
  );
}

function OurSolutionSection() {
  const solutions = [
    {
      title: 'Analyze and optimize',
      description:
        'See your work like never before. Lighthouse observes your workflow and highlights bottlenecks, letting you understand and debug your process like code before you automate it.',
      Illustration: AnalyzeIllustration,
    },
    {
      title: 'Create micro-AI agents trained on your patterns',
      description:
        'Agents are trained based on the nuances of your personal style, optimizations, shortcuts, and judgement calls unique to you. Then watch them execute those tasks when you need them to.',
      Illustration: AIAgentIllustration,
    },
    {
      title: 'Generate reports, guides, insights, and more',
      description:
        'Use your valuable work as a source to create different outputs to benefit yourself or your team. Imagine creating a progress update, project handoff document, or instructional playbook just by querying your documented work.',
      Illustration: ReportsIllustration,
    },
  ];

  return (
    <section className="flex w-full flex-col items-center gap-12 bg-white px-20 py-20">
      {/* Section Header */}
      <div className="flex flex-col items-center gap-4">
        <span
          className="text-[26px] font-semibold"
          style={{
            background: 'linear-gradient(90deg, #3D6E63 20.19%, #634CC7 91.97%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Our solution
        </span>
        <h2 className="text-center text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#0F172A]">
          Your work becomes your automations
        </h2>
      </div>

      {/* Solutions */}
      <div className="flex w-full max-w-[1280px] flex-col gap-12 px-[95px]">
        {solutions.map((solution, index) => (
          <motion.div
            key={solution.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="flex items-center gap-[60px]"
          >
            <div className="flex max-w-[600px] flex-col gap-3">
              <h3 className="text-[28px] font-semibold leading-9 tracking-[-0.05px] text-black">
                {solution.title}
              </h3>
              <p className="text-xl leading-[29px] tracking-[-0.05px] text-[#0F172A]">
                {solution.description}
              </p>
            </div>
            <div className="h-[307px] w-[460px] flex-shrink-0">
              <solution.Illustration />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      Icon: ComputerIcon,
      title: 'Capture work sessions',
      description:
        'The Lighthouse AI desktop app passively captures on-screen work, gathers context, and identifies repeatable patterns.',
    },
    {
      Icon: GearIcon,
      title: 'Generate agents',
      description:
        'After repeated work sessions, Lighthouse AI creates micro-AI agents that can perform the same tasks across your tools.',
    },
    {
      Icon: ChartIcon,
      title: 'Share and scale',
      description:
        'An ecosystem of human-trained agents can be used by others or for yourself to automate new or repeated tasks.',
    },
  ];

  return (
    <section className="flex w-full flex-col items-center gap-12 bg-[#F3F4F8] px-20 py-20">
      {/* Section Header */}
      <div className="flex flex-col items-center gap-4">
        <span
          className="text-[26px] font-semibold"
          style={{
            background: 'linear-gradient(90deg, #3D6E63 20.19%, #634CC7 91.97%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          How it works
        </span>
        <h2 className="text-center text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#0F172A]">
          Training your AI agents
        </h2>
      </div>

      {/* Cards */}
      <div className="flex w-full max-w-[1280px] gap-12">
        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="flex flex-1 flex-col items-center gap-6 rounded-[20px] border border-[#EFF0F7] bg-white p-12 shadow-[0px_5px_14px_rgba(8,15,52,0.04)]"
          >
            <div className="h-20 w-20">
              <step.Icon />
            </div>
            <h3 className="text-center text-[22px] font-bold leading-7 text-[#170F49]">
              {step.title}
            </h3>
            <p className="text-center text-xl leading-[29px] tracking-[-0.05px] text-[#0F172A]">
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SubscribeSection() {
  const { track } = useAnalytics();
  const [email, setEmail] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    track(AnalyticsEvents.BUTTON_CLICKED, {
      button_name: 'subscribe_newsletter',
      button_location: 'landing_subscribe',
    });
    // TODO: Implement newsletter subscription
    console.log('Subscribe:', email);
    setEmail('');
  };

  return (
    <section className="flex w-full flex-col items-end px-20 pb-0 pt-[60px]">
      <div className="relative flex w-full items-start">
        <div className="-mr-9 flex flex-1 flex-col items-center gap-[60px] rounded-[120px_24px_12px_12px] bg-[#F9F7FE] px-0 py-[60px]">
          <h2 className="max-w-[1246px] text-center text-4xl font-bold leading-[44px] tracking-[-0.05px] text-[#4A4F4E]">
            Subscribe to get information, latest news and other interesting offers from Lighthouse AI
          </h2>
          <form onSubmit={handleSubscribe} className="flex items-start gap-6">
            <div className="flex h-16 w-[421px] items-center gap-[11px] rounded-[10px] bg-white px-8 py-6">
              <Mail className="h-6 w-6 text-[#9AA4A0]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email address"
                className="flex-1 bg-transparent text-sm text-[#9AA4A0] outline-none placeholder:text-[#9AA4A0]"
              />
            </div>
            <Button
              type="submit"
              className="h-16 rounded-lg bg-black px-[26px] py-[18px] text-lg font-semibold text-white shadow-[0px_2px_5px_rgba(103,110,118,0.08),0px_0px_0px_1px_rgba(103,110,118,0.16),0px_1px_1px_rgba(0,0,0,0.12)] hover:bg-gray-900"
            >
              Subscribe
            </Button>
          </form>
        </div>
        <div className="relative -ml-9 h-[70px] w-[70px] flex-shrink-0">
          <SendIcon />
        </div>
      </div>
      {/* Decorative plus signs */}
      <div className="relative h-[166px] w-[153px] opacity-30">
        {[...Array(15)].map((_, i) => (
          <span
            key={i}
            className="absolute text-[22px] text-[#E5E5E5]"
            style={{
              left: `${(i % 5) * 35}px`,
              top: `${Math.floor(i / 5) * 35}px`,
            }}
          >
            +
          </span>
        ))}
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <>
      {/* Upper Footer */}
      <div className="flex w-full items-start justify-between bg-[#EFF0F5] px-20 py-[62px]">
        <div className="flex w-full max-w-[1280px] items-start justify-between gap-[50px]">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full"
              style={{
                background: 'linear-gradient(117.82deg, #9AC6B5 38.64%, #A897F2 85.27%)',
              }}
            >
              <img src={logoImage} alt="Lighthouse" className="h-7 w-7" />
            </div>
            <span className="text-xl font-semibold text-[#040606]">Lighthouse AI</span>
          </div>

          {/* Social Media */}
          <div className="flex flex-col items-center gap-5">
            <span className="text-[21px] font-semibold leading-[130%] text-[#2D2D2D]">
              Connect with us
            </span>
            <div className="flex items-center gap-4">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8">
                <LinkedInIcon />
              </a>
              <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="h-8 w-8">
                <XIcon />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Footer */}
      <footer className="flex w-full items-center justify-between bg-black px-[100px] py-[50px]">
        <span className="text-sm font-medium leading-5 text-white">
          © 2025 Krama Inc. - All Rights Reserved
        </span>
        <div className="flex items-start gap-[125px]">
          <a href="/terms" className="text-sm font-medium leading-5 text-white hover:underline">
            Terms of use
          </a>
          <a href="/privacy" className="text-sm font-medium leading-5 text-white hover:underline">
            Privacy policy
          </a>
        </div>
      </footer>
    </>
  );
}

// Main Landing Page Component
export default function LandingPage({ onGetStarted, onSignIn, onSignUp, onBlog }: LandingPageProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-white">
      <div className="flex w-full max-w-[1440px] flex-col">
        <NavBar onSignIn={onSignIn} onSignUp={onSignUp} onBlog={onBlog} />
        <HeroSection onGetStarted={onGetStarted} />
        <KeyProblemsSection />
        <OurSolutionSection />
        <HowItWorksSection />
        <SubscribeSection />
        <FooterSection />
      </div>
    </div>
  );
}
