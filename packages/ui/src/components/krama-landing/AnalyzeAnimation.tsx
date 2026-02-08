import { useState, useEffect } from 'react';
import { Mail, ListTodo, FileText, MessageSquare, StickyNote, Check, Activity } from 'lucide-react';

const inputSources = [
  { icon: Mail, label: 'Inbox (42)', rotation: -3 },
  { icon: ListTodo, label: 'Tasks', rotation: 2 },
  { icon: StickyNote, label: 'Notes', rotation: -1 },
  { icon: FileText, label: 'Q3 Report', rotation: 3 },
  { icon: MessageSquare, label: 'Slack #dev', rotation: -2 },
];

const outputItems = [
  { title: '3 Tasks Identified', description: 'Extracted from Slack & Email threads automatically.' },
  { title: '2 Hours Captured', description: 'Logged to Timesheet based on active document time.' },
  { title: '5 Insights Generated', description: 'Summary created for Q3 planning meeting.' },
];

interface AnalyzeAnimationProps {
  isActive: boolean;
}

const AnalyzeAnimation = ({ isActive }: AnalyzeAnimationProps) => {
  const [phase, setPhase] = useState<'idle' | 'input' | 'processing' | 'output'>('idle');
  const [visibleInputs, setVisibleInputs] = useState<number[]>([]);
  const [visibleOutputs, setVisibleOutputs] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setVisibleInputs([]);
      setVisibleOutputs([]);
      return;
    }

    setPhase('input');
    setVisibleInputs([]);
    setVisibleOutputs([]);

    inputSources.forEach((_, index) => {
      setTimeout(() => {
        setVisibleInputs((prev) => [...prev, index]);
      }, 300 + index * 120);
    });

    const processingStart = setTimeout(() => {
      setPhase('processing');
    }, 1200);

    const outputStart = setTimeout(() => {
      setPhase('output');

      outputItems.forEach((_, index) => {
        setTimeout(() => {
          setVisibleOutputs((prev) => [...prev, index]);
        }, index * 150);
      });
    }, 2200);

    return () => {
      clearTimeout(processingStart);
      clearTimeout(outputStart);
    };
  }, [isActive]);

  return (
    <div className="absolute inset-0 flex items-center justify-center gap-12">
      {/* Left side - Input sources */}
      <div className="relative w-48 h-80">
        {inputSources.map((source, index) => {
          const positions = [
            { top: '0%', left: '30%' },
            { top: '20%', left: '55%' },
            { top: '40%', left: '5%' },
            { top: '58%', left: '40%' },
            { top: '75%', left: '15%' },
          ];
          const pos = positions[index];
          const isVisible = visibleInputs.includes(index);
          const Icon = source.icon;

          return (
            <div
              key={source.label}
              className={`absolute bg-krama-card rounded-lg shadow-md border border-krama-border px-3 py-2 flex items-center gap-2 transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
              }`}
              style={{
                top: pos.top,
                left: pos.left,
                transform: isVisible ? `rotate(${source.rotation}deg)` : undefined,
              }}
            >
              <Icon className="w-4 h-4 text-krama-muted-foreground" strokeWidth={1.5} />
              <span className="text-xs text-krama-primary font-medium whitespace-nowrap">
                {source.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Center - Processing indicator */}
      <div className="flex flex-col items-center">
        <div
          className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${
            phase === 'processing'
              ? 'bg-krama-primary scale-110'
              : phase === 'output'
                ? 'bg-krama-primary'
                : 'bg-krama-muted'
          }`}
        >
          <div
            className={`absolute inset-0 rounded-full border-2 border-krama-primary transition-opacity ${
              phase === 'processing' ? 'opacity-100 animate-ping' : 'opacity-0'
            }`}
            style={{ animationDuration: '1.5s' }}
          />
          <Activity
            className={`w-7 h-7 transition-colors duration-300 ${
              phase === 'processing' || phase === 'output' ? 'text-white' : 'text-krama-muted-foreground'
            }`}
            strokeWidth={1.5}
          />
        </div>
        <p
          className={`text-[10px] text-krama-muted-foreground mt-3 tracking-wide transition-opacity ${
            phase === 'processing' ? 'opacity-100' : 'opacity-50'
          }`}
        >
          {phase === 'output' ? 'COMPLETE' : 'ANALYZING'}
        </p>
      </div>

      {/* Right side - Output card */}
      <div
        className={`w-64 bg-krama-primary rounded-xl overflow-hidden shadow-lg transition-all duration-700 ${
          phase === 'output' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
        }`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Session Organized</span>
          <span className="text-[10px] font-medium bg-white/20 text-white px-2 py-0.5 rounded">99%</span>
        </div>

        <div className="bg-krama-card px-4 py-3 space-y-3">
          {outputItems.map((item, index) => {
            const isVisible = visibleOutputs.includes(index);

            return (
              <div
                key={item.title}
                className={`flex items-start gap-2 transition-all duration-400 ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-krama-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-krama-primary" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-xs font-medium text-krama-primary">{item.title}</p>
                  <p className="text-[10px] text-krama-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AnalyzeAnimation;
