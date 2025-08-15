import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, GraduationCap, Briefcase, FolderOpen, Search, Users, Calendar } from 'lucide-react';
import ConversationExpectationsModal from './ConversationExpectationsModal';

interface ExperienceCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface AddExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategorySelect: (categoryId: string) => void;
}

const categories: ExperienceCategory[] = [
  {
    id: 'education',
    title: 'Education & Learning',
    description: 'University degrees, certifications, courses, workshops, bootcamps, self-study',
    icon: <GraduationCap className="w-6 h-6" />,
    color: 'from-emerald-500 to-emerald-600'
  },
  {
    id: 'jobs',
    title: 'Jobs & Roles',
    description: 'Full-time roles, part-time work, freelance, internships, side gigs, volunteer positions',
    icon: <Briefcase className="w-6 h-6" />,
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'projects',
    title: 'Projects & Work',
    description: 'Personal or professional projects, portfolio updates, freelance work, side hustles',
    icon: <FolderOpen className="w-6 h-6" />,
    color: 'from-orange-500 to-orange-600'
  },
  {
    id: 'jobsearch',
    title: 'Job Search',
    description: 'Resume updates, applications submitted, networking efforts, job tracking milestones',
    icon: <Search className="w-6 h-6" />,
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'interviews',
    title: 'Interview Loops',
    description: 'Technical screens, phone interviews, on-site interviews, feedback cycles, offers, rejections',
    icon: <Users className="w-6 h-6" />,
    color: 'from-red-500 to-red-600'
  },
  {
    id: 'events',
    title: 'Events & Networking',
    description: 'Conferences, meetups, networking events, coaching sessions, mentorship calls, informational interviews',
    icon: <Calendar className="w-6 h-6" />,
    color: 'from-pink-500 to-pink-600'
  }
];

const AddExperienceModal: React.FC<AddExperienceModalProps> = ({ 
  isOpen, 
  onClose, 
  onCategorySelect 
}) => {
  const [showExpectations, setShowExpectations] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setShowExpectations(true);
  };

  const handleStartConversation = () => {
    onCategorySelect(selectedCategory);
    onClose();
    setShowExpectations(false);
  };

  const handleCloseExpectations = () => {
    setShowExpectations(false);
    setSelectedCategory('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full bg-background border border-border">
        <DialogHeader className="relative">
          <DialogTitle className="text-2xl font-semibold text-foreground mb-2">
            What would you like to add to your journey?
          </DialogTitle>
          <p className="text-muted-foreground">
            Select a category to add a new milestone to your career journey
          </p>
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-6">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              onClick={() => handleCategorySelect(category.id)}
              className="group relative p-6 rounded-xl border border-border bg-card hover:bg-accent/10 transition-all duration-200 text-left overflow-hidden"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Background gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-5 group-hover:opacity-10 transition-opacity duration-200`} />
              
              {/* Icon container */}
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${category.color} flex items-center justify-center text-white mb-4 relative z-10`}>
                {category.icon}
              </div>
              
              {/* Content */}
              <div className="relative z-10">
                <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-accent-foreground transition-colors">
                  {category.title}
                </h3>
                <p className="text-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
                  {category.description}
                </p>
              </div>
              
              {/* Hover border effect */}
              <div className={`absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-current opacity-0 group-hover:opacity-20 transition-opacity duration-200`} 
                   style={{ color: `hsl(var(--primary))` }} />
            </motion.button>
          ))}
        </div>
      </DialogContent>

      <ConversationExpectationsModal
        isOpen={showExpectations}
        onClose={handleCloseExpectations}
        selectedCategory={selectedCategory}
        onStartConversation={handleStartConversation}
      />
    </Dialog>
  );
};

export default AddExperienceModal;