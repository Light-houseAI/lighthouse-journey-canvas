import {
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle,
  Code2,
  GraduationCap,
  Globe,
  Megaphone,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';

// ─── Persona data ────────────────────────────────────────────────

interface Persona {
  id: string;
  label: string;
  icon: React.ElementType;
  headline: string;
  benefits: string[];
  teaser: string;
  detail: PersonaDetail;
}

interface PersonaDetail {
  problem: string[];
  quote: { text: string; attribution: string };
  howKramaHelps: { title: string; points: string[] }[];
  idealFor: string[];
}

const personas: Persona[] = [
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    headline: 'Capture tribal knowledge. Standardize what works.',
    benefits: [
      'Automatically capture how top performers build campaigns',
      'Share proven workflows across time zones without scheduling syncs',
      'Surface existing templates before recreating from scratch',
    ],
    teaser:
      'New hires learn from real workflows, not outdated playbooks — and your team stops recreating work that already exists.',
    detail: {
      problem: [
        'New hires spend 3+ hours recreating reports that veterans build in minutes',
        "Campaign learnings live in people's heads, not systems",
        "Everyone uses ChatGPT differently — no one knows what's actually working",
      ],
      quote: {
        text: "We move so fast that we don't have time to document. When someone leaves, their knowledge leaves with them.",
        attribution: 'Marketing Lead, Fortune 500 Retailer',
      },
      howKramaHelps: [
        {
          title: 'Capture tribal knowledge automatically',
          points: [
            'Record how your best performers build campaigns, not just the final output',
            'New hires learn from real workflows, not outdated playbooks',
          ],
        },
        {
          title: 'Standardize what works',
          points: [
            'See which prompting techniques actually improve output quality',
            'Share proven workflows across time zones without scheduling syncs',
          ],
        },
        {
          title: 'Stop recreating from scratch',
          points: [
            'Surface existing templates and approaches before starting new work',
            'Connect "how Sarah built that deck" to the next person who needs it',
          ],
        },
      ],
      idealFor: [
        'Teams doing heavy presentation/content work',
        'Distributed teams with limited overlap hours',
        'Groups onboarding new hires frequently',
      ],
    },
  },
  {
    id: 'engineering',
    label: 'Engineering & Product',
    icon: Code2,
    headline: 'Optimize your AI tool usage. Stitch context across sessions.',
    benefits: [
      'See how your prompting patterns compare to effective approaches',
      'Multi-day projects tracked as continuous work, not isolated sessions',
      "Surface what's working in your workflow and identify inefficiencies",
    ],
    teaser:
      'Get recommendations based on your actual workflow — not generic tutorials — and pick up where you left off with full context.',
    detail: {
      problem: [
        "Everyone's prompting and workflow habits are different",
        "No way to know if you're using tools at 20% or 80% of their potential",
        'Context gets lost when switching between tools and sessions',
      ],
      quote: {
        text: "I built something in 3 days that used to take 3 weeks. But I have no idea if I'm even using Claude Code well.",
        attribution: 'Software Engineer',
      },
      howKramaHelps: [
        {
          title: 'Optimize your AI tool usage',
          points: [
            'See how your prompting patterns compare to effective approaches',
            'Get recommendations based on your actual workflow, not generic tutorials',
          ],
        },
        {
          title: 'Stitch context across sessions',
          points: [
            'Multi-day projects tracked as continuous work, not isolated sessions',
            'Pick up where you left off with full context',
          ],
        },
        {
          title: 'Learn from your own patterns',
          points: [
            "Surface what's working in your workflow",
            "Identify repeated inefficiencies you've stopped noticing",
          ],
        },
      ],
      idealFor: [
        'Engineers and PMs using AI-assisted development tools',
        'Teams adopting new AI tools and wanting faster ramp-up',
        'Individual contributors focused on continuous improvement',
      ],
    },
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Settings,
    headline: 'See task-level time allocation. Measure what matters.',
    benefits: [
      'Understand where hours actually go, not where people say they go',
      'Capture actual workflows as they happen — no documentation needed',
      'Compare approaches across team members with real data',
    ],
    teaser:
      "Turn your fastest performer's approach into a shareable reference and surface optimization opportunities with real data, not guesses.",
    detail: {
      problem: [
        'No visibility into how long tasks actually take',
        'Heavy reliance on spreadsheets and tribal knowledge',
        "Can't measure why one person is 3x faster than another",
      ],
      quote: {
        text: "We have 50 people and no standardized processes. I can't tell you why one tech resolves issues in 20 minutes while another takes an hour.",
        attribution: 'Operations Leader, Solar Company',
      },
      howKramaHelps: [
        {
          title: 'See task-level time allocation',
          points: [
            'Understand where hours actually go (not where people say they go)',
            'Identify bottlenecks across alert → troubleshoot → resolution workflows',
          ],
        },
        {
          title: 'Document processes without documentation',
          points: [
            'Capture actual workflows as they happen',
            "Turn your fastest performer's approach into a shareable reference",
          ],
        },
        {
          title: 'Measure what matters',
          points: [
            'Compare approaches across team members',
            'Surface optimization opportunities with real data, not guesses',
          ],
        },
      ],
      idealFor: [
        'Alert-driven or ticket-based teams',
        'Groups with high variance in individual performance',
        'Operations scaling from 10 → 50+ people',
      ],
    },
  },
  {
    id: 'small-business',
    label: 'Small Business Owners',
    icon: Briefcase,
    headline: 'Apply expert frameworks. Scale yourself before hiring.',
    benefits: [
      'Get specific next steps for your context, not generic advice',
      'See where your time actually goes across scattered priorities',
      'Create training material from your workflows without writing docs',
    ],
    teaser:
      'Document how you do things so you can eventually delegate — and build consistency into chaos without learning yet another tool.',
    detail: {
      problem: [
        '20+ daily priorities competing for attention, no consistent execution',
        "You know frameworks exist (Hormozi, etc.) but can't apply them to your specific context",
        'No time to learn new tools properly — you need results yesterday',
      ],
      quote: {
        text: "I want AI to take Alex Hormozi's frameworks and apply them to my specific business context. I don't have time to translate theory into action myself.",
        attribution: 'Home Services Business Owner',
      },
      howKramaHelps: [
        {
          title: 'Apply expert frameworks to your business',
          points: [
            'Capture your actual workflows, then get recommendations based on proven strategies',
            'Stop translating generic advice — get specific next steps for your context',
          ],
        },
        {
          title: 'Build consistency into chaos',
          points: [
            'See where your time actually goes across scattered priorities',
            'Identify which tasks drain hours without proportional results',
          ],
        },
        {
          title: 'Scale yourself before hiring',
          points: [
            'Document how you do things so you can eventually delegate',
            'Create training material from your workflows without writing documentation',
          ],
        },
      ],
      idealFor: [
        'Owners managing operations, sales, and marketing simultaneously',
        'Businesses with 1-10 employees scaling toward systems',
        'Operators who learn by doing, not reading',
      ],
    },
  },
  {
    id: 'remote',
    label: 'Remote / VA Teams',
    icon: Globe,
    headline: 'Coach asynchronously. Share knowledge at scale.',
    benefits: [
      'Review team workflows on your schedule, not theirs',
      'Best performer workflows become references for the entire team',
      'Identify who needs support before deadlines slip',
    ],
    teaser:
      'Provide feedback on actual work patterns — not self-reported summaries — and understand why some team members are 2-3x faster.',
    detail: {
      problem: [
        "Can't look over shoulders to coach in real-time",
        'Knowledge sharing requires scheduling calls nobody has time for',
        'Performance variance is invisible until deadlines slip',
      ],
      quote: {
        text: "I need real-time coaching for phone sales and client lifecycle management. My VAs are in the Philippines — I can't just walk over to their desk.",
        attribution: 'Business Owner, Unique Genius Network',
      },
      howKramaHelps: [
        {
          title: 'Coach asynchronously',
          points: [
            'Review team workflows on your schedule, not theirs',
            'Provide feedback on actual work patterns, not self-reported summaries',
          ],
        },
        {
          title: 'Share specialized knowledge at scale',
          points: [
            'Best performer workflows become references for entire team',
            'New hires learn from real examples, not outdated SOPs',
          ],
        },
        {
          title: 'See performance patterns',
          points: [
            'Identify who needs support before deadlines slip',
            'Understand why some team members are 2-3x faster than others',
          ],
        },
      ],
      idealFor: [
        'Teams with offshore or remote workers',
        'Managers overseeing 5+ distributed team members',
        'Organizations using VAs for specialized tasks (sales, support, admin)',
      ],
    },
  },
  {
    id: 'team-leaders',
    label: 'Team Leaders',
    icon: Users,
    headline: 'Get visibility without micromanaging.',
    benefits: [
      'See aggregate patterns across team workflows',
      'New hires learn from captured workflows of top performers',
      'Turn implicit knowledge into shareable references',
    ],
    teaser:
      'Identify bottlenecks and optimization opportunities with data — and reduce onboarding time so cross-functional learning happens naturally.',
    detail: {
      problem: [
        'No way to measure individual performance differences objectively',
        "Efficiency gains are limited when you don't know where time goes",
        'Onboarding takes months because knowledge transfer is ad-hoc',
      ],
      quote: {
        text: "I have 50 people and no standardized processes. I can't see task-level time allocation or why performance varies so much across the team.",
        attribution: 'Operations Leader',
      },
      howKramaHelps: [
        {
          title: 'Get visibility without micromanaging',
          points: [
            'See aggregate patterns across team workflows',
            'Identify bottlenecks and optimization opportunities with data',
          ],
        },
        {
          title: 'Reduce onboarding time',
          points: [
            'New hires learn from captured workflows of top performers',
            'Cross-functional learning happens without scheduling burden',
          ],
        },
        {
          title: 'Standardize what works',
          points: [
            'Surface approaches that drive results',
            'Turn implicit knowledge into shareable references',
          ],
        },
      ],
      idealFor: [
        'Managers overseeing 10+ individual contributors',
        'Leaders in fast-moving teams with high turnover',
        'Teams with significant performance variance across members',
      ],
    },
  },
  {
    id: 'analytics',
    label: 'Analytics Teams',
    icon: BarChart3,
    headline: 'Surface hidden efficiencies. Reduce redundant work.',
    benefits: [
      'Capture how power users leverage templates, shortcuts, and batch processing',
      'New hires see exactly how the best performers work',
      "Identify when someone's rebuilding what already exists",
    ],
    teaser:
      "Recommend optimizations based on tool capabilities you're not using — and connect similar workflows across team members.",
    detail: {
      problem: [
        'New employees manually recreate what veterans automate',
        'Efficiency tricks buried in documentation nobody reads',
        'Same reports rebuilt differently by different people',
      ],
      quote: {
        text: 'New employees spend 3+ hours manually building reports that advanced users create in minutes using templates and batch processing.',
        attribution: 'Enterprise Feedback Session',
      },
      howKramaHelps: [
        {
          title: 'Surface hidden efficiencies',
          points: [
            'Capture how power users leverage templates, shortcuts, and batch processing',
            "Recommend optimizations based on tool capabilities you're not using",
          ],
        },
        {
          title: 'Standardize report creation',
          points: [
            'Document actual workflows, not idealized processes',
            'New hires see exactly how the best performers work',
          ],
        },
        {
          title: 'Reduce redundant work',
          points: [
            "Identify when someone's rebuilding what already exists",
            'Connect similar workflows across team members',
          ],
        },
      ],
      idealFor: [
        'Teams using Adobe Analytics, Tableau, Looker, or similar tools',
        'Groups with mixed experience levels (junior to senior analysts)',
        'Reporting teams with recurring deliverables',
      ],
    },
  },
  {
    id: 'career',
    label: 'Career Transitioners',
    icon: GraduationCap,
    headline: 'Learn by doing, with feedback. Build proof of skills.',
    benefits: [
      'Capture your workflows and get recommendations for improvement',
      "Document what you've actually done, not just what you've learned",
      "Get specific guidance on tools you're learning",
    ],
    teaser:
      'See how your approach compares to effective patterns — and create portfolio evidence from real work sessions to accelerate your ramp-up.',
    detail: {
      problem: [
        "Generic tutorials don't match your specific context",
        "Hard to know if you're building good habits or bad ones",
        "No feedback loop on whether you're improving",
      ],
      quote: {
        text: "Students learn networking and interview skills 6-8 months too late. They don't understand the mechanics until they've already made mistakes.",
        attribution: 'Advisory Board Discussion',
      },
      howKramaHelps: [
        {
          title: 'Learn by doing, with feedback',
          points: [
            'Capture your workflows and get recommendations for improvement',
            'See how your approach compares to effective patterns',
          ],
        },
        {
          title: 'Build proof of skills',
          points: [
            "Document what you've actually done, not just what you've learned",
            'Create portfolio evidence from real work sessions',
          ],
        },
        {
          title: 'Accelerate ramp-up',
          points: [
            "Get specific guidance on tools you're learning",
            'Identify gaps in your workflow before they become habits',
          ],
        },
      ],
      idealFor: [
        'Professionals transitioning into new roles or industries',
        'Self-taught practitioners wanting validation',
        'Anyone ramping up on new tools (AI assistants, analytics platforms, etc.)',
      ],
    },
  },
];

// ─── Detail overlay ──────────────────────────────────────────────

function PersonaDetailView({
  persona,
  onClose,
}: {
  persona: Persona;
  onClose: () => void;
}) {
  const Icon = persona.icon;

  return (
    <div className="border border-krama-border rounded-xl bg-krama-card overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-krama-border bg-krama-muted">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-krama-primary" />
          <h3 className="text-xl font-bold text-krama-primary font-serif">
            {persona.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-krama-border/50 transition-colors text-krama-text-body"
          aria-label="Close details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-8 py-8 space-y-8">
        {/* The problem */}
        <div>
          <h4 className="uppercase tracking-[0.15em] text-xs font-semibold text-krama-primary mb-4">
            The Problem
          </h4>
          <ul className="space-y-2">
            {persona.detail.problem.map((p, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-krama-text-body leading-relaxed"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-krama-primary/40" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Quote */}
        <blockquote className="border-l-2 border-krama-primary/40 pl-4">
          <p className="text-sm italic text-krama-muted-foreground leading-relaxed">
            "{persona.detail.quote.text}"
          </p>
          <cite className="block mt-1 text-xs text-krama-muted-foreground not-italic">
            — {persona.detail.quote.attribution}
          </cite>
        </blockquote>

        {/* How Krama helps */}
        <div>
          <h4 className="uppercase tracking-[0.15em] text-xs font-semibold text-krama-primary mb-5">
            How Krama Helps
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {persona.detail.howKramaHelps.map((section, i) => (
              <div key={i}>
                <h5 className="text-sm font-bold text-krama-primary mb-3">
                  {section.title}
                </h5>
                <ul className="space-y-2">
                  {section.points.map((point, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-2 text-sm text-krama-text-body leading-relaxed"
                    >
                      <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-krama-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Ideal for */}
        <div className="border-t border-krama-border pt-6">
          <h4 className="uppercase tracking-[0.15em] text-xs font-semibold text-krama-primary mb-3">
            Ideal For
          </h4>
          <div className="flex flex-wrap gap-2">
            {persona.detail.idealFor.map((item, i) => (
              <span
                key={i}
                className="inline-block text-xs px-3 py-1.5 rounded-full border border-krama-primary/30 text-krama-primary bg-krama-primary/5"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────

function TabBar({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
    >
      {personas.map((p) => {
        const isActive = p.id === activeId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`
              whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all duration-200
              ${
                isActive
                  ? 'bg-krama-primary text-white border-krama-primary'
                  : 'bg-transparent text-krama-text-body border-krama-border hover:border-krama-primary/50 hover:text-krama-primary'
              }
            `}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main section ────────────────────────────────────────────────

export default function UseCasesSection() {
  const [activeTab, setActiveTab] = useState(personas[0].id);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const handleLearnMore = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // Scroll detail into view after a short delay for render
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  };

  const handleTabSelect = (id: string) => {
    setActiveTab(id);
    // Keep expanded view open if switching tabs and something was expanded
    if (expandedId && expandedId !== id) {
      setExpandedId(null);
    }
  };

  // Split personas for the two-row card grid — show the active tab's row
  // highlighted but display all 8 cards in a responsive grid
  const activePersona = personas.find((p) => p.id === activeTab);
  const expandedPersona = personas.find((p) => p.id === expandedId);

  return (
    <section className="bg-krama-background py-20 px-6 border-t border-krama-border">
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-block border border-krama-primary px-3 py-1 mb-4">
            <span className="uppercase tracking-[0.2em] text-xs font-semibold text-krama-primary">
              Use Cases
            </span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-krama-primary mb-3 font-serif">
            Built for every way you work.
          </h2>
          <p className="text-krama-text-body max-w-xl mx-auto leading-relaxed">
            Whether you're a solo operator or leading a 50-person team, Krama adapts to
            your workflow and delivers value from day one.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex justify-center mb-10">
          <TabBar activeId={activeTab} onSelect={handleTabSelect} />
        </div>

        {/* Featured persona card — large format like Delphi screenshot */}
        {activePersona && (
          <div
            className={`
              mb-10 grid grid-cols-1 lg:grid-cols-[280px_1fr] items-stretch rounded-xl border overflow-hidden transition-all duration-200
              ${expandedId === activePersona.id ? 'border-krama-primary shadow-md' : 'border-krama-border'}
            `}
          >
            {/* Left visual panel */}
            <div className="bg-krama-muted flex flex-col items-center justify-center p-8 gap-4 border-b lg:border-b-0 lg:border-r border-krama-border">
              <div className="w-16 h-16 rounded-2xl bg-krama-primary/10 flex items-center justify-center">
                <activePersona.icon className="w-8 h-8 text-krama-primary" />
              </div>
              <h3 className="text-xl font-bold text-krama-primary font-serif text-center">
                {activePersona.label}
              </h3>
            </div>

            {/* Right content panel */}
            <div className="bg-krama-card p-8">
              <h4 className="text-2xl font-bold text-krama-primary font-serif mb-4 leading-snug">
                {activePersona.headline}
              </h4>

              <ul className="space-y-3 mb-6">
                {activePersona.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-krama-text-body leading-relaxed"
                  >
                    <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-krama-accent" />
                    {benefit}
                  </li>
                ))}
              </ul>

              <p className="text-sm text-krama-muted-foreground leading-relaxed mb-6">
                {activePersona.teaser}
              </p>

              <button
                onClick={() => handleLearnMore(activePersona.id)}
                className="flex items-center gap-1.5 text-sm font-semibold text-krama-primary hover:text-krama-primary/80 transition-colors group"
              >
                {expandedId === activePersona.id
                  ? 'Hide details'
                  : `${activePersona.label} use cases`}
                <ArrowRight
                  className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                    expandedId === activePersona.id ? 'rotate-90' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Expanded detail view */}
        {expandedPersona && (
          <div ref={detailRef} className="mb-10">
            <PersonaDetailView
              persona={expandedPersona}
              onClose={() => setExpandedId(null)}
            />
          </div>
        )}

      </div>
    </section>
  );
}
