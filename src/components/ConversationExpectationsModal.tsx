import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, X, CheckCircle2, MessageCircle, Brain, Target } from 'lucide-react';

interface ConversationExpectationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string;
  onStartConversation: () => void;
}

const SoundWave: React.FC<{ isActive: boolean; volume: number }> = ({ isActive, volume }) => {
  return (
    <div className="flex items-center justify-center space-x-1 h-8">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-primary rounded-full"
          animate={{
            height: isActive ? [4, Math.max(4, volume * 32), 4] : 4,
          }}
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

const ConversationExpectationsModal: React.FC<ConversationExpectationsModalProps> = ({
  isOpen,
  onClose,
  selectedCategory,
  onStartConversation,
}) => {
  const [isTesting, setIsTesting] = useState(false);
  const [volume, setVolume] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();

  const getCategoryTitle = (category: string) => {
    const titles = {
      education: 'Education & Learning',
      jobs: 'Jobs & Roles',
      projects: 'Projects & Work',
      jobsearch: 'Job Search',
      interviews: 'Interview Loops',
      events: 'Events & Networking',
    };
    return titles[category as keyof typeof titles] || category;
  };

  const startMicrophoneTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsTesting(true);
      monitorAudioLevel();
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const monitorAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    
    const updateVolume = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setVolume(average / 255);
      
      if (isTesting) {
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      }
    };
    
    updateVolume();
  };

  const stopMicrophoneTest = () => {
    setIsTesting(false);
    setVolume(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopMicrophoneTest();
    };
  }, []);

  const expectations = [
    {
      icon: <MessageCircle className="w-5 h-5" />,
      title: "Natural Conversation",
      description: "Speak naturally about your experience. I'll ask follow-up questions to understand the details."
    },
    {
      icon: <Brain className="w-5 h-5" />,
      title: "Smart Understanding",
      description: "I'll capture key information like dates, skills, achievements, and challenges automatically."
    },
    {
      icon: <Target className="w-5 h-5" />,
      title: "Structured Output",
      description: "Your conversation will be organized into a clear milestone on your career journey map."
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full bg-background border border-border">
        <DialogHeader className="relative">
          <DialogTitle className="text-2xl font-semibold text-foreground mb-2">
            Here's what to expect
          </DialogTitle>
          <p className="text-muted-foreground">
            Adding <span className="text-primary font-medium">{getCategoryTitle(selectedCategory)}</span> to your journey
          </p>
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <div className="py-6 space-y-6">
          {/* Expectations */}
          <div className="space-y-4">
            {expectations.map((expectation, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start space-x-3 p-4 rounded-lg bg-card border border-border"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  {expectation.icon}
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">
                    {expectation.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {expectation.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Microphone Test Section */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
              <Mic className="w-5 h-5 mr-2 text-primary" />
              Microphone Setup
            </h3>
            
            <AnimatePresence mode="wait">
              {!isTesting ? (
                <motion.div
                  key="initial"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={startMicrophoneTest}
                      variant="outline"
                      className="flex-1 border-border hover:bg-accent"
                    >
                      <Mic className="w-4 h-4 mr-2" />
                      Test your microphone
                    </Button>
                    <Button
                      onClick={onStartConversation}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      Start your conversation
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="testing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-primary">
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">Microphone is on</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Speak to test your audio
                      </div>
                    </div>
                    <SoundWave isActive={true} volume={volume} />
                  </div>
                  
                  <Button
                    onClick={stopMicrophoneTest}
                    variant="outline"
                    className="w-full border-border hover:bg-accent"
                  >
                    <MicOff className="w-4 h-4 mr-2" />
                    Stop testing
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConversationExpectationsModal;