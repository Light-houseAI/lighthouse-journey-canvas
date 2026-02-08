import { useState, useEffect } from 'react';
import { MessageSquare, FileText, GitPullRequest, Check, Sparkles } from 'lucide-react';

interface OptimizeAnimationProps {
  isActive: boolean;
}

const recommendations = [
  {
    icon: MessageSquare,
    title: 'Slack → Email → Slack loops',
    subtitle: 'Set async response windows to reduce context switches',
  },
  {
    icon: FileText,
    title: 'Notion doc creation: 8 min avg',
    subtitle: 'Use templates to cut setup time by 60%',
  },
  {
    icon: GitPullRequest,
    title: 'GitHub PR reviews delayed 4+ hrs',
    subtitle: 'Enable priority notifications for faster turnaround',
  },
];

const OptimizeAnimation = ({ isActive }: OptimizeAnimationProps) => {
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'cards' | 'complete'>('idle');
  const [visibleCards, setVisibleCards] = useState<number[]>([]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setVisibleCards([]);
      setProgress(0);
      return;
    }

    setPhase('analyzing');
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 4;
      });
    }, 50);

    const cardsTimer = setTimeout(() => {
      setPhase('cards');
      clearInterval(progressInterval);
      setProgress(100);
    }, 1500);

    const card1Timer = setTimeout(() => setVisibleCards([0]), 1600);
    const card2Timer = setTimeout(() => setVisibleCards([0, 1]), 2000);
    const card3Timer = setTimeout(() => setVisibleCards([0, 1, 2]), 2400);

    const completeTimer = setTimeout(() => {
      setPhase('complete');
    }, 3000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(cardsTimer);
      clearTimeout(card1Timer);
      clearTimeout(card2Timer);
      clearTimeout(card3Timer);
      clearTimeout(completeTimer);
    };
  }, [isActive]);

  return (
    <div className="relative w-full h-full min-h-[320px] flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Analysis Phase */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-500 ${
          phase === 'analyzing' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Circular Progress Ring */}
        <div className="relative w-24 h-24 mb-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              className="text-krama-muted"
            />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="hsl(var(--krama-primary))"
              strokeWidth="4"
              strokeLinecap="round"
              className="transition-all duration-100"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-krama-primary animate-pulse" />
          </div>
        </div>
        <p className="text-sm text-krama-muted-foreground font-medium">Analyzing workflow...</p>
      </div>

      {/* Cards Phase */}
      <div
        className={`w-full max-w-sm space-y-3 transition-opacity duration-300 ${
          phase === 'cards' || phase === 'complete' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {recommendations.map((rec, index) => {
          const Icon = rec.icon;
          const isVisible = visibleCards.includes(index);
          const isComplete = phase === 'complete';

          return (
            <div
              key={index}
              className={`
                relative bg-krama-card rounded-xl p-4 shadow-md border-l-4 border-krama-primary
                transform transition-all duration-500 ease-out
                ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
                ${isComplete ? 'shadow-lg' : ''}
              `}
              style={{
                transitionDelay: isVisible ? '0ms' : `${index * 100}ms`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-krama-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-krama-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-krama-foreground text-sm">{rec.title}</h4>
                  <p className="text-xs text-krama-muted-foreground mt-0.5">{rec.subtitle}</p>
                </div>
                {/* Checkmark badge */}
                <div
                  className={`
                    w-6 h-6 rounded-full bg-krama-primary flex items-center justify-center flex-shrink-0
                    transform transition-all duration-300 delay-200
                    ${isComplete ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}
                  `}
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </div>
              </div>
            </div>
          );
        })}

        <p
          className={`
            text-center text-xs text-krama-muted-foreground mt-4 pt-2
            transition-all duration-500 delay-300
            ${phase === 'complete' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
        >
          Tailored to your actual workflow
        </p>
      </div>
    </div>
  );
};

export default OptimizeAnimation;
