import { useState, useEffect, useRef } from 'react';
import { Sparkles, Zap, CheckCircle } from 'lucide-react';

interface Pill {
  id: number;
  label: string;
  active: boolean;
  processing: boolean;
}

interface AISuggestion {
  id: number;
  originalLabel: string;
  improvedLabel: string;
  improvement: string;
  visible: boolean;
  completed: boolean;
}

interface PersonaConfig {
  title: string;
  subtitle: string;
  orchestrationLabel: string;
  pills: string[];
  aiSuggestions: { original: string; improved: string; improvement: string }[];
}

const personas: PersonaConfig[] = [
  {
    title: 'Product Manager',
    subtitle: 'Manual Prioritization Required',
    orchestrationLabel: 'Roadmap Optimized',
    pills: ['Backlog Review', 'Stakeholder Input', 'Priority Scoring', 'Sprint Planning', 'Resource Allocation', 'Timeline Sync'],
    aiSuggestions: [
      { original: 'Priority Scoring', improved: 'Auto-Prioritize', improvement: '+24%' },
      { original: 'Sprint Planning', improved: 'Sprint Optimizer', improvement: '+18%' },
      { original: 'Resource Allocation', improved: 'Smart Allocation', improvement: '+31%' },
    ],
  },
  {
    title: 'Software Engineer',
    subtitle: 'Manual Debugging Required',
    orchestrationLabel: 'Code Deployed',
    pills: ['Bug Triage', 'Code Review', 'Unit Testing', 'CI/CD Pipeline', 'Deployment', 'Monitoring Setup'],
    aiSuggestions: [
      { original: 'Bug Triage', improved: 'Auto-Triage', improvement: '+42%' },
      { original: 'Code Review', improved: 'AI Code Review', improvement: '+35%' },
      { original: 'Unit Testing', improved: 'Test Generator', improvement: '+28%' },
    ],
  },
  {
    title: 'Founder',
    subtitle: 'Manual Oversight Required',
    orchestrationLabel: 'Business Scaled',
    pills: ['Investor Updates', 'Metric Tracking', 'Team Sync', 'Budget Review', 'Strategy Pivot', 'Growth Analysis'],
    aiSuggestions: [
      { original: 'Metric Tracking', improved: 'Auto-Dashboard', improvement: '+45%' },
      { original: 'Budget Review', improved: 'Smart Forecasting', improvement: '+22%' },
      { original: 'Growth Analysis', improved: 'Growth Engine', improvement: '+38%' },
    ],
  },
];

const WorkflowComparison = () => {
  const [currentPersona, setCurrentPersona] = useState(0);
  const [leftPills, setLeftPills] = useState<Pill[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [leftTimer, setLeftTimer] = useState(0);
  const [rightTimer, setRightTimer] = useState(0);
  const [systemOptimized, setSystemOptimized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const initializePills = (personaIndex: number) => {
    return personas[personaIndex].pills.map((label, index) => ({
      id: index + 1,
      label,
      active: false,
      processing: false,
    }));
  };

  const initializeAiSuggestions = (personaIndex: number) => {
    return personas[personaIndex].aiSuggestions.map((suggestion, index) => ({
      id: index + 1,
      originalLabel: suggestion.original,
      improvedLabel: suggestion.improved,
      improvement: suggestion.improvement,
      visible: false,
      completed: false,
    }));
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const runAnimation = (personaIndex: number) => {
    if (isRunning) return;
    
    const pills = initializePills(personaIndex);
    const suggestions = initializeAiSuggestions(personaIndex);
    setLeftPills(pills);
    setAiSuggestions(suggestions);
    setIsRunning(true);
    setLeftTimer(0);
    setRightTimer(0);
    setSystemOptimized(false);
    setShowImpact(false);

    timerRef.current = setInterval(() => {
      setLeftTimer(prev => prev + 1);
    }, 100);

    pills.forEach((_, index) => {
      setTimeout(() => {
        setLeftPills(currentPills => 
          currentPills.map((p, i) => 
            i === index ? { ...p, processing: true } : p
          )
        );
      }, index * 800);

      setTimeout(() => {
        setLeftPills(currentPills => 
          currentPills.map((p, i) => 
            i === index ? { ...p, processing: false, active: true } : p
          )
        );
      }, index * 800 + 600);
    });

    const leftDuration = pills.length * 800 + 600;
    
    setTimeout(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      
      timerRef.current = setInterval(() => {
        setRightTimer(prev => prev + 1);
      }, 50);

      suggestions.forEach((_, index) => {
        setTimeout(() => {
          setAiSuggestions(currentSuggestions =>
            currentSuggestions.map((s, i) =>
              i === index ? { ...s, visible: true } : s
            )
          );
        }, index * 200);

        setTimeout(() => {
          setAiSuggestions(currentSuggestions =>
            currentSuggestions.map((s, i) =>
              i === index ? { ...s, completed: true } : s
            )
          );
        }, index * 200 + 300);
      });

      setTimeout(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setShowImpact(true);
        setSystemOptimized(true);
        setIsRunning(false);
        
        setTimeout(() => {
          const nextPersona = (personaIndex + 1) % personas.length;
          setCurrentPersona(nextPersona);
          setLeftPills(initializePills(nextPersona).map(p => ({ ...p, active: false, processing: false })));
          setAiSuggestions(initializeAiSuggestions(nextPersona));
          setLeftTimer(0);
          setRightTimer(0);
          setSystemOptimized(false);
          setShowImpact(false);
          runAnimation(nextPersona);
        }, 3000);
      }, 800);
    }, leftDuration);
  };

  useEffect(() => {
    setLeftPills(initializePills(0));
    setAiSuggestions(initializeAiSuggestions(0));
    const timeout = setTimeout(() => runAnimation(0), 1000);
    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const persona = personas[currentPersona];

  return (
    <div className="w-full h-full min-h-[400px] border border-krama-border rounded-lg overflow-hidden bg-krama-foreground text-krama-background flex flex-col">
      <div className="flex-1 grid grid-cols-[1fr_60px_1fr] border-t border-krama-background/20">
        {/* Left Panel */}
        <div className="p-3 flex flex-col border-r border-krama-background/20">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full border border-krama-background/40 flex items-center justify-center">
                  <span className="text-[8px]">👤</span>
                </div>
                <h3 className="text-xs font-medium font-sans">{persona.title}</h3>
              </div>
              <p className="text-[10px] opacity-60 mt-0.5 font-sans">{persona.subtitle}</p>
            </div>
            <span className="text-[10px] border border-krama-background/40 rounded-full px-1.5 py-0.5 font-mono">
              {formatTime(leftTimer)}
            </span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {leftPills.map((pill) => (
              <div
                key={pill.id}
                className={`
                  text-[10px] border rounded-full px-2 py-1 transition-all duration-200
                  flex items-center gap-1 font-sans
                  ${pill.active 
                    ? 'bg-krama-background text-krama-foreground border-krama-background' 
                    : 'border-krama-background/40'
                  }
                  ${pill.processing ? 'border-krama-background/80' : ''}
                `}
                style={pill.processing ? {
                  background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)'
                } : undefined}
              >
                {pill.processing && (
                  <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                )}
                {pill.label}
              </div>
            ))}
          </div>
        </div>

        {/* Center - Lighthouse */}
        <div className="flex items-center justify-center border-r border-krama-background/20 relative overflow-hidden">
          <div className="relative w-10 h-20">
            <svg viewBox="0 0 50 100" className="w-full h-full stroke-current fill-none stroke-[1.5]">
              <path d="M15 95 L20 50 L30 50 L35 95 Z" />
              <rect x="18" y="40" width="14" height="12" />
              <rect x="20" y="32" width="10" height="10" />
              <path d="M20 32 Q25 26 30 32" />
              <line x1="22" y1="60" x2="28" y2="60" />
              <line x1="21" y1="70" x2="29" y2="70" />
              <line x1="20" y1="80" x2="30" y2="80" />
            </svg>
            
            <div 
              className="absolute top-[28%] left-1/2 -translate-x-1/2 w-1 h-1 bg-krama-background rounded-full"
              style={{
                boxShadow: '0 0 15px 8px rgba(255,255,255,0.8)',
                animation: 'pulse-beacon 2s infinite'
              }}
            />
          </div>
        </div>

        {/* Right Panel */}
        <div className="p-3 flex flex-col">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-krama-primary/20 border border-krama-primary/40 flex items-center justify-center">
                  <Sparkles className="w-2.5 h-2.5 text-krama-primary" />
                </div>
                <h3 className="text-xs font-medium font-sans">Krama</h3>
              </div>
              <p className="text-[10px] opacity-60 mt-0.5 font-sans">Smart Workflow</p>
            </div>
            <span className="text-[10px] border border-krama-background/40 rounded-full px-1.5 py-0.5 font-mono">
              {formatTime(rightTimer)}
            </span>
          </div>
          
          <div className="flex-1 flex flex-col gap-1.5">
            {aiSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`
                  border rounded-lg p-2 transition-all duration-300
                  ${suggestion.visible 
                    ? 'opacity-100 translate-y-0 border-krama-primary/40 bg-krama-primary/5' 
                    : 'opacity-0 translate-y-2 border-krama-background/20'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {suggestion.completed ? (
                      <CheckCircle className="w-3 h-3 text-green-400" />
                    ) : (
                      <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    <span className="text-[10px] font-medium text-krama-primary font-sans">
                      {suggestion.improvedLabel}
                    </span>
                  </div>
                  <span className={`
                    text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-all duration-300 font-sans
                    ${suggestion.completed 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-krama-background/10 text-krama-background/60'
                    }
                  `}>
                    {suggestion.improvement}
                  </span>
                </div>
                <p className="text-[9px] opacity-50 mt-0.5 line-through font-sans">
                  was: {suggestion.originalLabel}
                </p>
              </div>
            ))}

            <div className={`
              mt-auto border border-krama-background/20 rounded-lg p-2 transition-all duration-500
              ${showImpact ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}>
              <p className="text-[8px] uppercase tracking-wider opacity-60 mb-1.5 font-sans">Expected Impact</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" />
                  <span className="text-xs font-bold font-sans">+27%</span>
                  <span className="text-[9px] opacity-60 font-sans">Speed</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-[9px] opacity-60 font-sans">3 tasks automated</span>
                </div>
              </div>
            </div>

            <div
              className={`
                text-[10px] border rounded-full px-3 py-1.5 text-center transition-all duration-300 font-sans
                ${systemOptimized 
                  ? 'bg-krama-background text-krama-foreground border-krama-background shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-100 opacity-100' 
                  : 'border-krama-background/40 scale-95 opacity-40'
                }
              `}
            >
              {persona.orchestrationLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Dots */}
      <div className="flex justify-center gap-2 py-2 border-t border-krama-background/20">
        {personas.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              if (!isRunning) {
                setCurrentPersona(index);
                runAnimation(index);
              }
            }}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${index === currentPersona 
                ? 'bg-krama-background w-6' 
                : 'bg-krama-background/40 hover:bg-krama-background/60'
              }
            `}
            aria-label={`View ${personas[index].title} workflow`}
          />
        ))}
      </div>

      <style>{`
        @keyframes pulse-beacon {
          0% { opacity: 0.3; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.5); }
          100% { opacity: 0.3; transform: translateX(-50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default WorkflowComparison;
