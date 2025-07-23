import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import MilestoneNode from './MilestoneNode';
import VoiceChatPanel from './VoiceChatPanel';

const nodeTypes = {
  milestone: MilestoneNode,
};

// Initial sample career journey data
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'milestone',
    position: { x: 100, y: 100 },
    data: {
      title: 'High School Graduation',
      type: 'education',
      date: '2018',
      description: 'Completed high school with focus on mathematics and science',
      skills: ['Problem Solving', 'Academic Writing'],
    },
  },
  {
    id: '2',
    type: 'milestone',
    position: { x: 300, y: 200 },
    data: {
      title: 'University - Computer Science',
      type: 'education',
      date: '2022',
      description: 'Bachelor of Science in Computer Science',
      skills: ['Programming', 'Algorithms', 'Software Design'],
    },
  },
  {
    id: '3',
    type: 'milestone',
    position: { x: 500, y: 150 },
    data: {
      title: 'Internship at TechCorp',
      type: 'job',
      date: '2021',
      description: 'Software development intern working on mobile applications',
      skills: ['React Native', 'Team Collaboration', 'Agile Development'],
    },
  },
  {
    id: '4',
    type: 'milestone',
    position: { x: 700, y: 250 },
    data: {
      title: 'Full-Stack Developer',
      type: 'job',
      date: '2022',
      description: 'First full-time role building web applications',
      skills: ['React', 'Node.js', 'Database Design', 'API Development'],
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep', animated: true },
  { id: 'e2-3', source: '2', target: '3', type: 'smoothstep', animated: true },
  { id: 'e3-4', source: '3', target: '4', type: 'smoothstep', animated: true },
];

interface Milestone extends Record<string, unknown> {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill';
  date: string;
  description: string;
  skills: string[];
}

const CareerJourney: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addMilestone = useCallback((milestone: Milestone) => {
    const newNode: Node = {
      id: milestone.id,
      type: 'milestone',
      position: { 
        x: Math.random() * 800 + 100, 
        y: Math.random() * 600 + 100 
      },
      data: milestone as Record<string, unknown>,
    };

    setNodes((nds) => [...nds, newNode]);
    
    // Auto-connect to the most recent node
    if (nodes.length > 0) {
      const lastNodeId = nodes[nodes.length - 1].id;
      const newEdge: Edge = {
        id: `e${lastNodeId}-${milestone.id}`,
        source: lastNodeId,
        target: milestone.id,
        type: 'smoothstep',
        animated: true,
      };
      setEdges((eds) => [...eds, newEdge]);
    }
  }, [nodes, setNodes, setEdges]);

  return (
    <div className="w-full h-screen relative overflow-hidden">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 p-6"
      >
        <div className="glass rounded-2xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Lighthouse AI
              </h1>
              <p className="text-muted-foreground">
                Visualize your career journey with AI guidance
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsVoicePanelOpen(!isVoicePanelOpen)}
              className="glass rounded-xl px-4 py-2 border border-primary/30 hover:border-primary transition-all duration-300"
            >
              🎙️ Voice Assistant
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Career Journey Visualization */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full h-full pt-24"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="career-journey-flow"
          style={{ 
            background: 'transparent',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(var(--primary) / 0.2)"
          />
        </ReactFlow>
      </motion.div>

      {/* Voice Chat Panel */}
      <VoiceChatPanel 
        isOpen={isVoicePanelOpen}
        onClose={() => setIsVoicePanelOpen(false)}
        onMilestoneAdded={addMilestone}
      />
    </div>
  );
};

export default CareerJourney;