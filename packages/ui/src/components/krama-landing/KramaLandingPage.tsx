import logoImage from '../../assets/images/logo.png';
import HowItWorksSection from './HowItWorksSection';
import UseCasesSection from './UseCasesSection';
import WaitlistForm from './WaitlistForm';
import WorkflowComparison from './WorkflowComparison';

// Header Component - Clean header with just the logo
function Header() {
  return (
    <header className="bg-krama-background py-4 px-6 border-b border-krama-border">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src={logoImage} 
            alt="Krama" 
            className="w-8 h-8 rounded-full"
          />
          <span 
            className="text-2xl font-bold bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, hsl(160 35% 50%) 0%, hsl(200 30% 60%) 40%, hsl(260 35% 60%) 100%)' }}
          >
            Krama
          </span>
        </div>
      </div>
    </header>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="bg-krama-background min-h-[80vh] relative">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[80vh]">
          {/* Left Content */}
          <div className="py-16">
            <div className="inline-block border border-krama-primary px-3 py-1 mb-8">
              <span className="uppercase tracking-[0.2em] text-xs font-semibold text-krama-primary">
                AI-POWERED WORKSPACE
              </span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-krama-primary leading-[1] mb-8 font-serif">
              Your workflow,<br />
              understood.
            </h1>
            
            <p className="text-lg text-krama-text-body max-w-md mb-6 leading-relaxed">
              Insights that help you spot inefficiencies, automate busywork, and do your best work—every time.
            </p>
            
            <p className="text-sm text-krama-accent font-medium mb-6">
              We're onboarding early users now. Request access to be in the first cohort.
            </p>
            
            <WaitlistForm />
          </div>
          
          {/* Right Content - Workflow Comparison Animation */}
          <div className="hidden lg:block relative h-full min-h-[500px]">
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: 'linear-gradient(to right, hsl(200 20% 80%) 1px, transparent 1px), linear-gradient(to bottom, hsl(200 20% 80%) 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }}
            />
            
            <div className="absolute inset-4 z-10">
              <WorkflowComparison />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Features Section
const personas = [
  {
    title: "The Productive Skeptic",
    painPoint: "\"I use AI constantly but I'm not getting better—just faster at producing work that needs heavy editing.\"",
    solution: "Stop guessing where AI helps. Krama shows you exactly which parts of your workflow to automate and which need your real attention.",
  },
  {
    title: "The Solo Optimizer",
    painPoint: "\"I've streamlined what I can, but I have no idea if my workflows are actually good or just familiar.\"",
    solution: "See your work patterns clearly. Discover inefficiencies you've gone blind to—like the 7-minute task that could take 2.",
  },
  {
    title: "The Distributed Team Lead",
    painPoint: "\"My team says AI made them faster, but I can't see what's actually working across time zones.\"",
    solution: "Get visibility into real workflows. See what your team actually does, share what works, and scale improvements without micromanaging.",
  },
  {
    title: "The Privacy-Conscious Professional",
    painPoint: "\"Every tool wants access to everything. I need real value before I let something watch how I work.\"",
    solution: "Start with one workflow. Get a concrete win in your first session—then decide. All processing happens locally. Your data stays yours.",
  },
];

function FeaturesSection() {
  return (
    <section className="bg-krama-background py-20 px-6 border-t border-krama-border">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-krama-primary mb-4 font-serif">
            Built for people who want to get better at their work.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {personas.map((persona, index) => (
            <div 
              key={index} 
              className="bg-krama-card rounded-xl border border-krama-border p-8 flex flex-col hover:border-krama-primary/50 transition-colors"
            >
              <h3 className="text-xl font-bold text-krama-primary mb-4 font-serif">
                {persona.title}
              </h3>
              
              <div className="mb-6">
                <p className="text-krama-muted-foreground italic text-sm leading-relaxed">
                  {persona.painPoint}
                </p>
              </div>
              
              <div className="mt-auto">
                <p className="text-krama-text-body text-sm leading-relaxed">
                  {persona.solution}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="bg-krama-background py-20 px-6 border-t border-krama-border">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold text-krama-primary leading-tight mb-6 font-serif">
              Ready to transform<br />
              how you work?
            </h2>
            
            <p className="text-krama-text-body leading-relaxed mb-6">
              Join Krama. Be among the first to experience:
            </p>
            
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-krama-text-body">
                <span className="text-krama-accent font-bold">✓</span>
                <span>Automatic workflow capture</span>
              </li>
              <li className="flex items-start gap-3 text-krama-text-body">
                <span className="text-krama-accent font-bold">✓</span>
                <span>Personalized insights to elevate your workflow with single click</span>
              </li>
              <li className="flex items-start gap-3 text-krama-text-body">
                <span className="text-krama-accent font-bold">✓</span>
                <span>Priority support & feature access</span>
              </li>
            </ul>
          </div>
          
          <div className="lg:border-l border-krama-border lg:pl-16">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="py-12 bg-slate-800 border-t border-white/10">
      <div className="container mx-auto px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <img 
              src={logoImage} 
              alt="Krama" 
              className="w-8 h-8 rounded-full"
            />
            <span className="text-lg font-semibold text-white">
              Krama
            </span>
          </div>
          <p className="text-sm text-white/60">
            © 2025 Krama Inc. - All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export default function KramaLandingPage() {
  return (
    <div className="min-h-screen bg-krama-background">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <UseCasesSection />
      <CTASection />
      <Footer />
    </div>
  );
}
