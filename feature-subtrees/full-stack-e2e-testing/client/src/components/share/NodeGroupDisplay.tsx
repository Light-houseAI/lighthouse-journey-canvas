/**
 * NodeGroupDisplay Component
 * 
 * Displays timeline nodes grouped by type with enhanced visual design
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Briefcase, 
  GraduationCap, 
  FolderOpen, 
  Calendar, 
  Target, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface TimelineNode {
  id: string;
  type: string;
  title?: string;
  description?: string;
  meta?: {
    title?: string;
    company?: string;
    position?: string;
    institution?: string;
    degree?: string;
    [key: string]: any;
  };
}

interface NodeGroupDisplayProps {
  nodes: TimelineNode[];
  title?: string;
  subtitle?: string;
}

// Node type configuration
const NODE_TYPE_CONFIG = {
  job: {
    icon: Briefcase,
    label: 'Jobs',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    gradient: 'from-blue-500 to-blue-600'
  },
  education: {
    icon: GraduationCap,
    label: 'Education',
    color: 'bg-green-50 text-green-700 border-green-200',
    gradient: 'from-green-500 to-green-600'
  },
  project: {
    icon: FolderOpen,
    label: 'Projects',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    gradient: 'from-purple-500 to-purple-600'
  },
  event: {
    icon: Calendar,
    label: 'Events',
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    gradient: 'from-orange-500 to-orange-600'
  },
  action: {
    icon: Target,
    label: 'Actions',
    color: 'bg-red-50 text-red-700 border-red-200',
    gradient: 'from-red-500 to-red-600'
  },
  careerTransition: {
    icon: ArrowRight,
    label: 'Career Transitions',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    gradient: 'from-indigo-500 to-indigo-600'
  }
};

// Helper function to get the correct title field based on node type
const getNodeDisplayTitle = (node: TimelineNode): string => {
  switch (node.type) {
    case 'job':
      return node.meta?.company || 'Untitled Job';
    case 'education':
      return node.meta?.institution || 'Untitled Education';
    default:
      return node.meta?.title || node.title || 'Untitled';
  }
};

export const NodeGroupDisplay: React.FC<NodeGroupDisplayProps> = ({ 
  nodes, 
  title = "Selected Nodes",
  subtitle = "Timeline nodes to be shared"
}) => {
  // Group nodes by type
  const groupedNodes = nodes.reduce((groups, node) => {
    const type = node.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(node);
    return groups;
  }, {} as Record<string, TimelineNode[]>);

  if (nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-8 text-muted-foreground"
      >
        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No nodes selected</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-3">
        {Object.entries(groupedNodes).map(([nodeType, typeNodes]) => {
          const config = NODE_TYPE_CONFIG[nodeType as keyof typeof NODE_TYPE_CONFIG] || {
            icon: FolderOpen,
            label: nodeType,
            color: 'bg-gray-50 text-gray-700 border-gray-200',
            gradient: 'from-gray-500 to-gray-600'
          };
          
          const Icon = config.icon;

          return (
            <motion.div
              key={nodeType}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border border-border/50 hover:border-border transition-colors">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${config.color} shrink-0`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm text-foreground">{config.label}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {typeNodes.length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        {typeNodes.slice(0, 3).map((node, index) => (
                          <motion.div
                            key={node.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="text-xs text-muted-foreground line-clamp-1"
                          >
                            • {getNodeDisplayTitle(node)}
                          </motion.div>
                        ))}
                        
                        {typeNodes.length > 3 && (
                          <div className="text-xs text-muted-foreground/70">
                            +{typeNodes.length - 3} more...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between pt-2 border-t border-border/50"
      >
        <span className="text-xs text-muted-foreground">
          Total: {nodes.length} node{nodes.length === 1 ? '' : 's'}
        </span>
        <span className="text-xs text-muted-foreground">
          {Object.keys(groupedNodes).length} type{Object.keys(groupedNodes).length === 1 ? '' : 's'}
        </span>
      </motion.div>
    </motion.div>
  );
};