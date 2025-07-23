import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion } from 'framer-motion';
import MilestoneNode from './MilestoneNode';
import MilestoneDetailsPanel from './MilestoneDetailsPanel';
import VoiceChatPanel from './VoiceChatPanel';

const nodeTypes = {
  milestone: MilestoneNode,
};

// Initial sample career journey data
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'milestone',
    position: { x: 150, y: 200 },
    data: {
      title: 'High School',
      type: 'education',
      date: '2018',
      description: 'Completed high school with focus on mathematics and science, developing strong analytical and problem-solving skills.',
      skills: ['Problem Solving', 'Academic Writing', 'Mathematics'],
      organization: 'Lincoln High School',
    },
    draggable: false,
  },
  {
    id: '2',
    type: 'milestone',
    position: { x: 350, y: 150 },
    data: {
      title: 'Computer Science Degree',
      type: 'education',
      date: '2018-2022',
      description: 'Bachelor of Science in Computer Science with focus on software engineering and algorithms.',
      skills: ['Programming', 'Algorithms', 'Software Design', 'Data Structures'],
      organization: 'Tech University',
    },
    draggable: false,
  },
  {
    id: '3',
    type: 'milestone',
    position: { x: 550, y: 100 },
    data: {
      title: 'Software Internship',
      type: 'work',
      date: 'Summer 2021',
      description: 'Software development intern working on mobile applications and gaining hands-on experience in the tech industry.',
      skills: ['React Native', 'Team Collaboration', 'Agile Development', 'Git'],
      organization: 'TechCorp Inc.',
    },
    draggable: false,
  },
  {
    id: '4',
    type: 'milestone',
    position: { x: 750, y: 200 },
    data: {
      title: 'Full-Stack Developer',
      type: 'work',
      date: '2022-Present',
      description: 'First full-time role building modern web applications using cutting-edge technologies and best practices.',
      skills: ['React', 'Node.js', 'Database Design', 'API Development', 'TypeScript'],
      organization: 'StartupXYZ',
    },
    draggable: false,
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
  type: 'education' | 'work' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

const CareerJourney: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedMilestone(node.data as Milestone);
    setIsDetailsPanelOpen(true);
  }, []);

  const addMilestone = useCallback((milestone: Milestone) => {
    const newNode: Node = {
      id: milestone.id,
      type: 'milestone',
      position: { 
        x: Math.random() * 800 + 100, 
        y: Math.random() * 600 + 100 
      },
      data: milestone as Record<string, unknown>,
      draggable: false,
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
      {/* Career Journey Visualization */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="w-full h-full"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          className="career-journey-flow"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--background)/0.8) 100%)',
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={30}
            size={2}
            color="hsl(var(--primary) / 0.1)"
          />
        </ReactFlow>
      </motion.div>

      {/* Milestone Details Panel */}
      <MilestoneDetailsPanel
        isOpen={isDetailsPanelOpen}
        milestone={selectedMilestone}
        onClose={() => {
          setIsDetailsPanelOpen(false);
          setSelectedMilestone(null);
        }}
      />

      {/* Voice Chat Panel */}
      <VoiceChatPanel 
        isOpen={isVoicePanelOpen}
        onClose={() => setIsVoicePanelOpen(false)}
        onMilestoneAdded={addMilestone}
      />

      {/* Floating Voice Assistant Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsVoicePanelOpen(!isVoicePanelOpen)}
        className={`
          fixed bottom-6 right-6 z-30
          w-16 h-16 rounded-full
          voice-panel glass
          border border-primary/30 hover:border-primary
          flex items-center justify-center
          text-2xl
          transition-all duration-300
          ${isVoicePanelOpen ? 'mr-[420px]' : ''}
        `}
      >
        🎙️
      </motion.button>
    </div>
  );
};

export default CareerJourney;