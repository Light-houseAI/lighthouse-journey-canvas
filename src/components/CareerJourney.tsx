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
import { FaMicrophone, FaTimes } from 'react-icons/fa';
import MilestoneNode from './MilestoneNode';
import VoiceChatPanel from './VoiceChatPanel';

const nodeTypes = {
  milestone: MilestoneNode,
};

// Initial sample career journey data - arranged horizontally in chronological order
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'milestone',
    position: { x: 200, y: 300 },
    data: {
      title: 'High School Graduation',
      type: 'education',
      date: '2018',
      description: 'Completed high school with focus on mathematics and science',
      skills: ['Problem Solving', 'Academic Writing'],
      organization: 'Central High School',
    },
  },
  {
    id: '2',
    type: 'milestone',
    position: { x: 500, y: 300 },
    data: {
      title: 'University - Computer Science',
      type: 'education',
      date: '2022',
      description: 'Bachelor of Science in Computer Science',
      skills: ['Programming', 'Algorithms', 'Software Design'],
      organization: 'State University',
    },
  },
  {
    id: '3',
    type: 'milestone',
    position: { x: 800, y: 300 },
    data: {
      title: 'Internship at TechCorp',
      type: 'job',
      date: '2021',
      description: 'Software development intern working on mobile applications',
      skills: ['React Native', 'Team Collaboration', 'Agile Development'],
      organization: 'TechCorp',
    },
  },
  {
    id: '4',
    type: 'milestone',
    position: { x: 1100, y: 300 },
    data: {
      title: 'Full-Stack Developer',
      type: 'job',
      date: '2022',
      description: 'First full-time role building web applications',
      skills: ['React', 'Node.js', 'Database Design', 'API Development'],
      organization: 'StartupCo',
    },
  },
];

const initialEdges: Edge[] = [
  { 
    id: 'e1-2', 
    source: '1', 
    target: '2', 
    type: 'straight',
    style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
    className: 'career-path-edge'
  },
  { 
    id: 'e2-3', 
    source: '2', 
    target: '3', 
    type: 'straight',
    style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
    className: 'career-path-edge'
  },
  { 
    id: 'e3-4', 
    source: '3', 
    target: '4', 
    type: 'straight',
    style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
    className: 'career-path-edge'
  },
];

interface Milestone extends Record<string, unknown> {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

const CareerJourney: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(true);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addMilestone = useCallback((milestone: Milestone) => {
    // Calculate position for new node in horizontal layout
    const nodeSpacing = 300;
    const baseY = 300;
    const newX = nodes.length > 0 
      ? Math.max(...nodes.map(node => node.position.x)) + nodeSpacing
      : 200;

    const newNode: Node = {
      id: milestone.id,
      type: 'milestone',
      position: { 
        x: newX, 
        y: baseY 
      },
      data: milestone as Record<string, unknown>,
    };

    setNodes((nds) => [...nds, newNode]);
    
    // Auto-connect to the most recent node with straight line
    if (nodes.length > 0) {
      const lastNodeId = nodes[nodes.length - 1].id;
      const newEdge: Edge = {
        id: `e${lastNodeId}-${milestone.id}`,
        source: lastNodeId,
        target: milestone.id,
        type: 'straight',
        style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
        className: 'career-path-edge',
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
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Lighthouse AI
            </h1>
            <p className="text-muted-foreground">
              Visualize your career journey with AI guidance
            </p>
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
          nodesDraggable={false}
          fitView
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          minZoom={0.3}
          maxZoom={2}
          className="career-journey-flow"
          style={{ 
            background: 'transparent',
          }}
          panOnScroll={true}
          zoomOnScroll={false}
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

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1, boxShadow: "0 0 30px hsl(var(--primary) / 0.6)" }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsVoicePanelOpen(!isVoicePanelOpen)}
        className="
          fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full
          bg-gradient-to-r from-primary to-accent
          shadow-xl hover:shadow-2xl
          flex items-center justify-center
          transition-all duration-300 ease-in-out
        "
        style={{
          boxShadow: "0 8px 32px hsl(var(--primary) / 0.4)",
        }}
      >
        <motion.div
          initial={false}
          animate={{ rotate: isVoicePanelOpen ? 90 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {isVoicePanelOpen ? (
            <FaTimes className="w-5 h-5 text-white" />
          ) : (
            <FaMicrophone className="w-5 h-5 text-white" />
          )}
        </motion.div>
      </motion.button>
    </div>
  );
};

export default CareerJourney;