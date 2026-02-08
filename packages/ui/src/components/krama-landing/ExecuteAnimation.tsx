import { useState, useEffect } from 'react';
import { Check, Clock, RefreshCw } from 'lucide-react';

interface ExecuteAnimationProps {
  isActive: boolean;
}

const tasks = [
  { id: 1, text: "Sort emails" },
  { id: 2, text: "Update spreadsheets" },
  { id: 3, text: "Generate reports" },
  { id: 4, text: "Sync data across tools" },
];

const ExecuteAnimation = ({ isActive }: ExecuteAnimationProps) => {
  const [phase, setPhase] = useState<'idle' | 'manual' | 'automating' | 'running' | 'improving'>('idle');
  const [automatedTasks, setAutomatedTasks] = useState<number[]>([]);
  const [checkedTasks, setCheckedTasks] = useState<number[]>([]);

  useEffect(() => {
    if (!isActive) {
      setPhase('idle');
      setAutomatedTasks([]);
      setCheckedTasks([]);
      return;
    }

    setPhase('manual');
    setAutomatedTasks([]);
    setCheckedTasks([]);

    const automateTimers = tasks.map((task, index) => {
      return setTimeout(() => {
        setPhase('automating');
        setAutomatedTasks(prev => [...prev, task.id]);
        setTimeout(() => {
          setCheckedTasks(prev => [...prev, task.id]);
        }, 200);
      }, 800 + (index * 400));
    });

    const runningTimer = setTimeout(() => {
      setPhase('running');
    }, 3000);

    const improvingTimer = setTimeout(() => {
      setPhase('improving');
    }, 4000);

    return () => {
      automateTimers.forEach(timer => clearTimeout(timer));
      clearTimeout(runningTimer);
      clearTimeout(improvingTimer);
    };
  }, [isActive]);

  const isTaskAutomated = (taskId: number) => automatedTasks.includes(taskId);
  const isTaskChecked = (taskId: number) => checkedTasks.includes(taskId);

  return (
    <div
      className="relative w-full h-full min-h-[400px] flex flex-col p-8 overflow-hidden rounded-xl"
      style={{ backgroundColor: 'hsl(var(--krama-background))' }}
    >
      {/* Title */}
      <div className="mb-6">
        <h3 className="text-2xl font-bold mb-2 text-krama-primary">
          Execute
        </h3>
        <p className="text-sm text-krama-muted-foreground">
          Step-by-step guidance to implement changes
        </p>
      </div>

      {/* Task List */}
      <div
        className={`flex-1 flex flex-col justify-center transition-all duration-700 ${
          phase === 'running' || phase === 'improving' ? 'opacity-70' : 'opacity-100'
        }`}
      >
        <div className="space-y-4 max-w-sm mx-auto w-full">
          {tasks.map((task) => {
            const automated = isTaskAutomated(task.id);
            const checked = isTaskChecked(task.id);

            return (
              <div
                key={task.id}
                className={`
                  flex items-center gap-4 py-3 px-4 rounded-lg
                  transition-all duration-500 ease-out
                  ${automated ? 'shadow-sm' : 'bg-transparent'}
                `}
                style={{
                  backgroundColor: automated ? 'rgba(255,255,255,0.5)' : 'transparent',
                  transform: automated ? 'translateX(0)' : 'translateX(-20px)',
                }}
              >
                <div
                  className="w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ease-out"
                  style={{
                    borderColor: automated ? 'hsl(var(--krama-primary))' : '#999',
                    backgroundColor: checked ? 'hsl(var(--krama-primary))' : 'transparent',
                    boxShadow: checked ? '0 0 12px hsla(var(--krama-primary), 0.4)' : 'none',
                  }}
                >
                  <Check
                    className={`w-4 h-4 transition-all duration-300 ${
                      checked ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                    }`}
                    style={{ color: 'white' }}
                    strokeWidth={3}
                  />
                </div>

                <span
                  className={`flex-1 font-medium transition-all duration-500`}
                  style={{
                    color: automated ? 'hsl(var(--krama-foreground))' : '#999',
                    opacity: automated ? 1 : 0.6,
                  }}
                >
                  {task.text}
                </span>

                <div
                  className={`
                    px-2 py-1 rounded text-xs font-semibold
                    transition-all duration-300 ease-out
                    ${automated ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}
                  `}
                  style={{
                    backgroundColor: automated ? 'hsla(var(--krama-primary), 0.15)' : 'transparent',
                    color: 'hsl(var(--krama-primary))',
                  }}
                >
                  auto
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Running automatically indicator */}
      <div
        className={`text-center transition-all duration-500 ${
          phase === 'running' || phase === 'improving' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <p className="text-lg font-semibold mb-2 text-krama-primary">
          Running automatically
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-krama-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Daily at 8 AM</span>
        </div>
      </div>

      {/* Keep improving indicator */}
      <div
        className={`absolute bottom-6 right-6 flex items-center gap-2 transition-all duration-500 ${
          phase === 'improving' ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <RefreshCw
          className="w-5 h-5 animate-spin text-krama-muted-foreground"
          style={{ animationDuration: '3s' }}
        />
        <span className="text-sm text-krama-muted-foreground">
          Keep improving
        </span>
      </div>
    </div>
  );
};

export default ExecuteAnimation;
