import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatOverlayProps {
  messages: Message[];
  isVisible: boolean;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ messages, isVisible }) => {
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const maxMessages = 6;

  useEffect(() => {
    // Keep only the last 6 messages
    const recentMessages = messages.slice(-maxMessages);
    setVisibleMessages(recentMessages);
  }, [messages]);

  if (!isVisible || visibleMessages.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 pointer-events-none">
      <div className="flex flex-col-reverse gap-2 max-w-sm">
        <AnimatePresence mode="popLayout">
          {visibleMessages.map((message, index) => {
            const isOldest = index === 0 && visibleMessages.length === maxMessages;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                animate={{ 
                  opacity: isOldest ? 0.3 : 0.85,
                  y: 0,
                  scale: 1
                }}
                exit={{ 
                  opacity: 0, 
                  y: -10, 
                  scale: 0.95,
                  transition: { duration: 0.3 }
                }}
                transition={{ 
                  duration: 0.4,
                  ease: "easeOut"
                }}
                className={`
                  px-3 py-2 rounded-lg text-sm max-w-xs break-words
                  shadow-lg backdrop-blur-sm
                  ${message.type === 'user' 
                    ? 'bg-primary/20 text-white border border-primary/30 ml-8' 
                    : 'bg-background/15 text-white border border-white/20'
                  }
                `}
                style={{
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="flex items-start gap-2">
                  <span className={`
                    text-xs font-medium opacity-70 shrink-0
                    ${message.type === 'user' ? 'text-primary-foreground' : 'text-white'}
                  `}>
                    {message.type === 'user' ? 'You' : 'Navi'}
                  </span>
                  <span className="text-white/90 leading-relaxed">
                    {message.content.length > 80 
                      ? message.content.substring(0, 80) + '...'
                      : message.content
                    }
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ChatOverlay;
