import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';

interface STARCard {
  id: string;
  title: string;
  description: string;
  content: string;
}

interface STARDocumentationPanelProps {
  isVisible: boolean;
}

const STARDocumentationPanel: React.FC<STARDocumentationPanelProps> = ({ isVisible }) => {
  const [cards, setCards] = useState<STARCard[]>([
    {
      id: 'situation',
      title: 'Situation',
      description: 'Describe the context of the situation. This could be a project, a challenge you faced, or an experience you had.',
      content: ''
    },
    {
      id: 'task',
      title: 'Task',
      description: 'Explain your specific responsibility or what you were tasked with accomplishing in that situation.',
      content: ''
    },
    {
      id: 'action',
      title: 'Action',
      description: 'Detail the actions you took to address the task or situation. Focus on your individual contributions, not just the team\'s efforts.',
      content: ''
    },
    {
      id: 'result',
      title: 'Result',
      description: 'What was achieved? Include impact, positive results, or lessons learned.',
      content: ''
    }
  ]);

  const [activeCard, setActiveCard] = useState('situation');

  const updateCardContent = (id: string, content: string) => {
    setCards(prev => prev.map(card => 
      card.id === id ? { ...card, content } : card
    ));
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-1/2 h-full bg-background border-l border-border/50 flex flex-col"
    >
      <div className="p-6 border-b border-border/30">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Prepare a STAR story
        </h2>
        <p className="text-sm text-muted-foreground">
          Create a structured story using the STAR method for your interview
        </p>
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-4">
          {cards.map((card, index) => (
            <Card
              key={card.id}
              className={`transition-all duration-200 cursor-pointer ${
                activeCard === card.id 
                  ? 'ring-2 ring-primary border-primary/50 bg-primary/5' 
                  : 'hover:border-primary/30'
              }`}
              onClick={() => setActiveCard(card.id)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    activeCard === card.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {index + 1}
                  </span>
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  {card.description}
                </p>
                <Textarea
                  placeholder={`Describe the ${card.title.toLowerCase()}...`}
                  value={card.content}
                  onChange={(e) => updateCardContent(card.id, e.target.value)}
                  className="min-h-[100px] resize-none"
                  onClick={(e) => e.stopPropagation()}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default STARDocumentationPanel;