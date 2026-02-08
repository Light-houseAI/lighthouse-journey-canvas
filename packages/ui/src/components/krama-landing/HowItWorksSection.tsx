import { useState, useEffect } from 'react';
import { Layers, MousePointer2 } from 'lucide-react';
import logoImage from '../../assets/images/logo.png';
import AnalyzeAnimation from './AnalyzeAnimation';
import OptimizeAnimation from './OptimizeAnimation';
import ExecuteAnimation from './ExecuteAnimation';

// ─── Step data ───────────────────────────────────────────────────

const useCases = [
  {
    id: 'capture',
    title: 'Capture',
    headline: 'Capture',
    description:
      'Krama runs quietly in the background, recording your workflow across the apps you choose.',
  },
  {
    id: 'analyze',
    title: 'Analyze',
    headline: 'Analyze',
    description:
      'We classify what you were trying to do, how you did it, and where time went.',
  },
  {
    id: 'optimize',
    title: 'Optimize',
    headline: 'Optimize',
    description:
      "Get specific recommendations: shortcuts, automations, better approaches—tailored to your actual workflow.",
  },
  {
    id: 'execute',
    title: 'Execute',
    headline: 'Execute',
    description:
      'Step-by-step guidance to implement changes. Share workflows with your team. Keep improving.',
  },
];

// ─── Tool icons for the Capture animation ────────────────────────

const toolIcons = [
  { name: 'Slack', color: '#E01E5A', icon: 'slack', size: 'lg' },
  { name: 'Notion', color: '#000000', icon: 'notion', size: 'lg' },
  { name: 'Gmail', color: '#EA4335', icon: 'gmail', size: 'md' },
  { name: 'Drive', color: '#4285F4', icon: 'drive', size: 'sm' },
  { name: 'Figma', color: '#F24E1E', icon: 'figma', size: 'lg' },
  { name: 'HubSpot', color: '#FF7A59', icon: 'hubspot', size: 'md' },
  { name: 'Salesforce', color: '#00A1E0', icon: 'salesforce', size: 'lg' },
  { name: 'Amplitude', color: '#0061FF', icon: 'amplitude', size: 'lg' },
  { name: 'Mailchimp', color: '#FFE01B', icon: 'mailchimp', size: 'md' },
  { name: 'GitHub', color: '#181717', icon: 'github', size: 'md' },
  { name: 'Analytics', color: '#F9AB00', icon: 'analytics', size: 'md' },
  { name: 'Aspen', color: '#00C7B7', icon: 'aspen', size: 'sm' },
  { name: 'Dropbox', color: '#0061FF', icon: 'dropbox', size: 'md' },
  { name: 'Canva', color: '#00C4CC', icon: 'canva', size: 'sm' },
  { name: 'Intercom', color: '#1F8DED', icon: 'intercom', size: 'sm' },
  { name: 'Linear', color: '#5E6AD2', icon: 'linear', size: 'md' },
  { name: 'Airtable', color: '#18BFFF', icon: 'airtable', size: 'sm' },
  { name: 'Monday', color: '#FF3D57', icon: 'monday', size: 'sm' },
  { name: 'Zapier', color: '#FF4A00', icon: 'zapier', size: 'sm' },
  { name: 'Stripe', color: '#635BFF', icon: 'stripe', size: 'md' },
];

// ─── Icon SVG components ─────────────────────────────────────────

const IconSvg = ({ icon, color }: { icon: string; color: string }) => {
  const icons: Record<string, JSX.Element> = {
    slack: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" />
        <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" />
        <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" />
        <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
    notion: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill={color} d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.934-.56.934-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.746 0-.933-.234-1.494-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.187 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.233 4.763 7.278v-6.44l-1.215-.14c-.093-.513.28-.886.747-.933l3.222-.187zm-12.292-5.36l12.82-.793v1.912l-12.82.793V2.674z" />
      </svg>
    ),
    figma: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#F24E1E" d="M15.852 8.981h-4.588V0h4.588c2.476 0 4.49 2.014 4.49 4.49s-2.014 4.491-4.49 4.491z" />
        <path fill="#A259FF" d="M6.66 24h4.588v-8.981H6.66c-2.477 0-4.49-2.014-4.49-4.49s2.013-4.49 4.49-4.49h4.588v8.981H6.66c-2.477 0-4.49 2.013-4.49 4.49S4.183 24 6.66 24z" />
        <path fill="#1ABCFE" d="M15.852 24c2.476 0 4.49-2.014 4.49-4.49s-2.014-4.49-4.49-4.49-4.49 2.014-4.49 4.49 2.014 4.49 4.49 4.49z" />
        <path fill="#0ACF83" d="M6.66 8.981h4.588V0H6.66C4.183 0 2.17 2.014 2.17 4.49s2.013 4.491 4.49 4.491z" />
        <path fill="#FF7262" d="M6.66 17.019h4.588v-8.038H6.66c-2.477 0-4.49 2.014-4.49 4.019s2.013 4.019 4.49 4.019z" />
      </svg>
    ),
    github: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill={color} d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
    hubspot: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill={color} d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.194v.067a2.196 2.196 0 001.252 1.973v2.86a6.153 6.153 0 00-2.925 1.478l-7.97-6.2a2.544 2.544 0 00.089-.639A2.569 2.569 0 002.855 0 2.569 2.569 0 00.287 2.568a2.569 2.569 0 002.568 2.57c.58 0 1.12-.195 1.552-.522l7.839 6.098a6.158 6.158 0 00-.04 7.21l-2.385 2.385a2.02 2.02 0 00-.593-.095 2.041 2.041 0 102.04 2.04c0-.21-.035-.41-.094-.6l2.348-2.348a6.2 6.2 0 106.642-11.376zM17.161 18.28a3.595 3.595 0 110-7.19 3.595 3.595 0 010 7.19z" />
      </svg>
    ),
    salesforce: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill={color} d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.16 5.22c-.345 0-.69-.045-1.02-.105a3.9 3.9 0 01-3.315 1.86c-.57 0-1.11-.12-1.59-.345-.63 1.38-2.04 2.34-3.66 2.34-1.5 0-2.82-.84-3.51-2.07-.24.03-.48.06-.735.06-2.64 0-4.77-2.16-4.77-4.83 0-1.86 1.02-3.48 2.55-4.32-.18-.51-.27-1.05-.27-1.62 0-2.76 2.22-5.01 4.95-5.01 1.77 0 3.33.93 4.2 2.34l.336-.195z" />
      </svg>
    ),
    amplitude: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" fill="#0061FF" />
        <path fill="white" d="M12 6l4.5 9.5H7.5L12 6z" />
      </svg>
    ),
    analytics: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#F9AB00" d="M22 10h-2V4h2v6zm0 8h-2v-6h2v6zm-4-4h-2V4h2v10zm0 4h-2v-2h2v2zm-4 2h-2V8h2v12zm-4 0h-2v-8h2v8zm-4 0H4v-4h2v4z" />
      </svg>
    ),
    dropbox: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 13.25L6 9.5l6 3.75-6 3.75-6-3.75zm18-3.75l6 3.75-6 3.75-6-3.75 6-3.75zM6 18.25l6-3.75 6 3.75-6 3.75-6-3.75z" />
      </svg>
    ),
    linear: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M3.79 14.257l5.953 5.953a9.954 9.954 0 01-5.953-5.953zM2.009 12a9.97 9.97 0 002.542 6.67L11.67 11.55H2.009zm.772-2.538a9.954 9.954 0 015.953-5.953l-5.953 5.953zM12 2.009H4.33l8.887 8.887V2.009zM21.991 12a9.97 9.97 0 00-2.542-6.67L12.33 12.45h9.661zm-.772 2.538a9.954 9.954 0 01-5.953 5.953l5.953-5.953zM12 21.991h7.67l-8.887-8.887v8.887z" />
      </svg>
    ),
    gmail: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
      </svg>
    ),
    drive: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#4285F4" d="M7.71 15.99l-1.42 2.48-4.65-8.07 1.42-2.47z" />
        <path fill="#0066DA" d="M16.29 15.99H2.71l1.42 2.48h12.16z" />
        <path fill="#00AC47" d="M7.71 3l-6 10.4 1.42 2.47L9.13 5.47z" />
        <path fill="#00832D" d="M16.29 3H9.13l6 10.4h7.16z" />
        <path fill="#2684FC" d="M16.29 15.99l6-10.4-1.42-2.47-6 10.4z" />
        <path fill="#EA4335" d="M22.29 13.4l-1.42 2.47H7.71l1.42-2.47z" />
      </svg>
    ),
    mailchimp: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path fill="#FFE01B" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z" />
        <path fill="#241C15" d="M16.5 9.5c-.8 0-1.5.3-2 .8-.3-.5-.8-.8-1.5-.8-.5 0-1 .2-1.3.5v-.4h-1.5v5.8h1.5v-3.2c0-.6.4-1 1-1s.9.4.9 1v3.2h1.5v-3.2c0-.6.4-1 1-1s.9.4.9 1v3.2h1.5v-3.5c0-1.3-.9-2.4-2-2.4z" />
      </svg>
    ),
    canva: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" fill={color} />
        <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">C</text>
      </svg>
    ),
    intercom: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-5 15.5v-7h2v7H7zm4 1v-9h2v9h-2zm4-1v-7h2v7h-2z" />
      </svg>
    ),
    airtable: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M11.992.256L1.596 4.622a.4.4 0 000 .738l10.396 4.366a.4.4 0 00.316 0l10.396-4.366a.4.4 0 000-.738L12.308.256a.4.4 0 00-.316 0z" />
        <path fill="#2DCBC9" d="M12.5 11.276v10.95a.4.4 0 00.54.375l10.396-4.096a.4.4 0 00.264-.375V7.18a.4.4 0 00-.54-.375L12.764 10.9a.4.4 0 00-.264.376z" />
        <path fill="#F82B60" d="M11.5 11.276V22.23a.4.4 0 01-.54.375L.564 18.51a.4.4 0 01-.264-.375V7.18a.4.4 0 01.54-.375l10.396 4.096a.4.4 0 01.264.376z" />
      </svg>
    ),
    monday: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <circle cx="4" cy="12" r="3" fill="#FF3D57" />
        <circle cx="12" cy="12" r="3" fill="#00D647" />
        <circle cx="20" cy="12" r="3" fill="#0085FF" />
      </svg>
    ),
    zapier: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 18l-6-6 6-6 6 6-6 6z" />
      </svg>
    ),
    stripe: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
      </svg>
    ),
    aspen: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill={color} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    ),
  };
  return (
    icons[icon] || (
      <span className="text-lg font-bold" style={{ color }}>
        {icon[0].toUpperCase()}
      </span>
    )
  );
};

// ─── Capture icon positions ──────────────────────────────────────

const iconPositions = [
  { top: '2%', left: '25%' },
  { top: '5%', left: '55%' },
  { top: '8%', left: '78%' },
  { top: '12%', left: '8%' },
  { top: '18%', left: '38%' },
  { top: '15%', left: '65%' },
  { top: '25%', left: '18%' },
  { top: '28%', left: '48%' },
  { top: '22%', left: '82%' },
  { top: '38%', left: '5%' },
  { top: '35%', left: '30%' },
  { top: '40%', left: '58%' },
  { top: '42%', left: '85%' },
  { top: '52%', left: '15%' },
  { top: '55%', left: '42%' },
  { top: '50%', left: '72%' },
  { top: '65%', left: '28%' },
  { top: '68%', left: '55%' },
  { top: '72%', left: '80%' },
  { top: '78%', left: '10%' },
];

const sizeClasses: Record<string, string> = {
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

// ─── Main component ──────────────────────────────────────────────

export default function HowItWorksSection() {
  const [activeCase, setActiveCase] = useState(useCases[0].id);
  const [animationPhase, setAnimationPhase] = useState<
    'idle' | 'clicking' | 'clicked' | 'revealing'
  >('idle');
  const [visibleIcons, setVisibleIcons] = useState<number[]>([]);
  const activeData = useCases.find((uc) => uc.id === activeCase)!;

  // Auto-advance tabs
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCase((current) => {
        const currentIndex = useCases.findIndex((uc) => uc.id === current);
        const nextIndex = (currentIndex + 1) % useCases.length;
        return useCases[nextIndex].id;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Capture animation sequence
  useEffect(() => {
    if (activeCase !== 'capture') {
      setAnimationPhase('idle');
      setVisibleIcons([]);
      return;
    }

    setAnimationPhase('idle');
    setVisibleIcons([]);

    const clickTimeout = setTimeout(() => setAnimationPhase('clicking'), 500);
    const clickedTimeout = setTimeout(() => setAnimationPhase('clicked'), 1000);
    const revealTimeout = setTimeout(() => {
      setAnimationPhase('revealing');
      toolIcons.forEach((_, index) => {
        setTimeout(() => {
          setVisibleIcons((prev) => [...prev, index]);
        }, index * 60);
      });
    }, 1300);

    return () => {
      clearTimeout(clickTimeout);
      clearTimeout(clickedTimeout);
      clearTimeout(revealTimeout);
    };
  }, [activeCase]);

  return (
    <section className="bg-krama-background py-20 px-6 border-t border-krama-border">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left Column – Content */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Layers className="w-5 h-5 text-krama-primary" strokeWidth={1.5} />
              <span className="uppercase tracking-[0.2em] text-xs font-semibold text-krama-primary">
                HOW IT WORKS
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold text-krama-primary leading-tight mb-6 font-serif">
              {activeData.headline}
            </h2>

            <p className="text-krama-text-body leading-relaxed mb-10 max-w-md">
              {activeData.description}
            </p>

            {/* Progress dots */}
            <div className="flex gap-2 mb-8">
              {useCases.map((uc) => (
                <div
                  key={uc.id}
                  className={`h-1 w-8 rounded-full transition-colors ${
                    uc.id === activeCase ? 'bg-krama-primary' : 'bg-krama-border'
                  }`}
                />
              ))}
            </div>

            {/* Tab list */}
            <div className="space-y-0">
              {useCases.map((uc) => (
                <button
                  key={uc.id}
                  onClick={() => setActiveCase(uc.id)}
                  className={`w-full text-left py-4 border-t border-krama-border transition-colors ${
                    uc.id === activeCase
                      ? 'text-krama-primary font-medium'
                      : 'text-krama-text-body hover:text-krama-primary'
                  }`}
                >
                  {uc.title}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column – Animation */}
          <div className="relative min-h-[450px] hidden lg:block">
            {activeCase === 'capture' ? (
              <>
                {/* Krama App Mockup */}
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 z-20 transition-all duration-500 ${
                    animationPhase === 'revealing'
                      ? 'opacity-0 scale-90'
                      : 'opacity-100 scale-100'
                  }`}
                >
                  <div className="bg-krama-card border border-krama-border rounded-xl shadow-lg p-4 min-w-[280px]">
                    {/* App header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src={logoImage} alt="Krama" className="w-6 h-6 rounded-full" />
                        <span className="text-sm font-medium text-krama-primary">Krama</span>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-krama-muted flex items-center justify-center">
                        <span className="text-[10px]">👤</span>
                      </div>
                    </div>

                    {/* Session info */}
                    <div className="flex items-center justify-between text-xs text-krama-text-body mb-3">
                      <span>My tracks</span>
                      <div className="flex items-center gap-2">
                        <span>Capture a</span>
                        <span className="font-medium text-krama-primary">25 min</span>
                        <span>session</span>
                      </div>
                    </div>

                    {/* Track item */}
                    <div className="flex items-center justify-between bg-krama-muted/50 rounded-lg p-3 relative">
                      <div>
                        <p className="text-sm font-medium text-krama-primary">Krama</p>
                        <p className="text-xs text-krama-text-body">
                          Last worked: 1 hour ago •{' '}
                          <span className="text-krama-accent">2 sessions to review</span>
                        </p>
                      </div>

                      {/* Start session button with click animation */}
                      <div className="relative">
                        <button
                          className={`bg-krama-primary text-white text-xs px-4 py-2 rounded-md font-medium flex items-center gap-1 transition-all duration-200 ${
                            animationPhase === 'clicking' ? 'scale-95 opacity-80' : ''
                          } ${animationPhase === 'clicked' ? 'bg-krama-accent' : ''}`}
                        >
                          Start session
                          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M3 4.5L6 7.5L9 4.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>

                        {/* Animated cursor */}
                        <div
                          className={`absolute transition-all duration-500 ${
                            animationPhase === 'idle'
                              ? 'bottom-[-30px] right-[-20px] opacity-0'
                              : animationPhase === 'clicking'
                                ? 'bottom-[8px] right-[40px] opacity-100 scale-90'
                                : animationPhase === 'clicked'
                                  ? 'bottom-[8px] right-[40px] opacity-100'
                                  : 'bottom-[20px] right-[60px] opacity-0'
                          }`}
                        >
                          <MousePointer2
                            className={`w-5 h-5 text-krama-primary fill-krama-primary/20 transition-transform ${
                              animationPhase === 'clicking' ? 'rotate-[-10deg]' : ''
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Icons Cloud */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-full h-full">
                    {toolIcons.map((tool, index) => {
                      const pos = iconPositions[index % iconPositions.length];
                      const sizeClass = sizeClasses[tool.size] || sizeClasses.md;
                      const isVisible = visibleIcons.includes(index);

                      return (
                        <div
                          key={tool.name}
                          className={`absolute ${sizeClass} bg-krama-card rounded-xl shadow-sm border border-krama-border flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-lg hover:-translate-y-1 ${
                            isVisible
                              ? 'opacity-100 scale-100 translate-y-0'
                              : 'opacity-0 scale-75 translate-y-4'
                          }`}
                          style={{ top: pos.top, left: pos.left }}
                          title={tool.name}
                        >
                          <IconSvg icon={tool.icon} color={tool.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : activeCase === 'analyze' ? (
              <AnalyzeAnimation isActive={activeCase === 'analyze'} />
            ) : activeCase === 'optimize' ? (
              <OptimizeAnimation isActive={activeCase === 'optimize'} />
            ) : (
              <ExecuteAnimation isActive={activeCase === 'execute'} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
