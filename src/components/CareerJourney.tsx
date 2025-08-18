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
import { motion, AnimatePresence } from 'framer-motion';
import { FaMicrophone, FaTimes } from 'react-icons/fa';
import MilestoneNode from './MilestoneNode';
import FloatingAddButton from './FloatingAddButton';
import MilestoneDetailPanel from './MilestoneDetailPanel';
import ConversationPage from './ConversationPage';

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
      tags: ['graduation', 'education']
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
      tags: ['degree', 'computer science']
    },
  },
  {
    id: '3',
    type: 'milestone',
    position: { x: 800, y: 300 },
    data: {
      title: 'Internship at TechCorp',
      type: 'jobs',
      date: '2021',
      description: 'Software development intern working on mobile applications',
      skills: ['React Native', 'Team Collaboration', 'Agile Development'],
      organization: 'TechCorp',
      tags: ['internship', 'mobile development']
    },
  },
  {
    id: '4',
    type: 'milestone',
    position: { x: 1100, y: 300 },
    selected: true, // Mark as active node
    data: {
      title: 'Full-Stack Developer',
      type: 'jobs',
      date: '2022 to present',
      description: 'First full-time role building web applications',
      skills: ['React', 'Node.js', 'Database Design', 'API Development'],
      organization: 'StartupCo',
      tags: ['full-time', 'web development']
    },
  },
  // Child nodes for Full-Stack Developer
  {
    id: '5',
    type: 'milestone',
    position: { x: 1200, y: 650 },
    selected: true, // Mark as active node to get orbit animation
    data: {
      title: 'Checkout optimization',
      type: 'projects',
      date: '2023',
      description: 'Improved checkout flow resulting in 15% conversion increase',
      skills: ['React', 'A/B Testing', 'Analytics', 'UX Optimization'],
      organization: 'StartupCo',
      tags: ['optimization', 'ecommerce']
    },
  },
  {
    id: '6',
    type: 'milestone',
    position: { x: 1500, y: 650 },
    data: {
      title: 'Mentorship',
      type: 'events',
      date: '2023',
      description: 'Started mentoring junior developers in the team',
      skills: ['Leadership', 'Teaching', 'Code Review', 'Team Building'],
      organization: 'StartupCo',
      tags: ['mentorship', 'leadership']
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
  // Connecting edge from Full-Stack Developer to child timeline
  { 
    id: 'e4-5', 
    source: '4', 
    sourceHandle: 'bottom',
    target: '5', 
    targetHandle: 'left',
    type: 'smoothstep',
    style: { stroke: 'rgba(255, 255, 255, 0.5)', strokeWidth: 2 },
    className: 'career-path-edge'
  },
  // Horizontal connection between child nodes
  { 
    id: 'e5-6', 
    source: '5', 
    target: '6', 
    type: 'straight',
    style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
    className: 'career-path-edge'
  },
];

interface Milestone extends Record<string, unknown> {
  id: string;
  title: string;
  type: 'education' | 'jobs' | 'projects' | 'jobsearch' | 'interviews' | 'events';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
  tags?: string[];
}

const CareerJourney: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [showConversation, setShowConversation] = useState(false);
  const [conversationCategory, setConversationCategory] = useState<string>('');
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [dialogVisibleOnNode, setDialogVisibleOnNode] = useState<string>('4'); // Track which node should show dialog

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const addMilestone = useCallback((milestone: Milestone) => {
    // Calculate position for new node in horizontal layout with animation
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
      data: { 
        ...milestone as Record<string, unknown>,
        onNodeClick: handleNodeClick,
        isNew: true // Flag for animation
      },
    };

    setNodes((nds) => [...nds, newNode]);
    
    // Auto-connect to the most recent node with soft curved line
    if (nodes.length > 0) {
      const lastNodeId = nodes[nodes.length - 1].id;
      const newEdge: Edge = {
        id: `e${lastNodeId}-${milestone.id}`,
        source: lastNodeId,
        target: milestone.id,
        type: 'smoothstep',
        style: { stroke: 'rgba(255, 255, 255, 0.4)', strokeWidth: 2 },
        className: 'career-path-edge',
        animated: true,
      };
      setEdges((eds) => [...eds, newEdge]);
    }

    // Remove the isNew flag after animation
    setTimeout(() => {
      setNodes((nds) => 
        nds.map(node => 
          node.id === milestone.id 
            ? { ...node, data: { ...node.data, isNew: false } }
            : node
        )
      );
    }, 600);
  }, [nodes, setNodes, setEdges]);

  const handleNodeClick = useCallback((milestoneData: any) => {
    setSelectedMilestone(milestoneData);
    setIsDetailPanelOpen(true);
  }, []);

  const handleCategorySelect = useCallback((categoryId: string) => {
    setConversationCategory(categoryId);
    setShowConversation(true);
  }, []);

  const handleConversationComplete = useCallback((data: any) => {
    // Create milestone from conversation data
    const newMilestone: Milestone = {
      id: Date.now().toString(),
      title: `New ${data.category}`,
      type: data.category === 'education' ? 'education' : 
            data.category === 'jobs' ? 'jobs' :
            data.category === 'projects' ? 'projects' :
            data.category === 'jobsearch' ? 'jobsearch' :
            data.category === 'interviews' ? 'interviews' : 'events',
      date: new Date().getFullYear().toString(),
      description: data.transcript || 'Added via conversation',
      skills: [],
      organization: '',
      tags: []
    };
    
    addMilestone(newMilestone);
    setShowConversation(false);
    setConversationCategory('');
  }, [addMilestone]);

  const handleConversationBack = useCallback(() => {
    setShowConversation(false);
    setConversationCategory('');
  }, []);

  const handleStartConversation = useCallback(() => {
    setConversationCategory('general');
    setShowConversation(true);
  }, []);

  const handleMoveToNextActiveNode = useCallback(() => {
    // Find all active nodes (nodes with selected: true)
    const activeNodeIds = ['4', '5']; // Full-Stack Developer and Checkout optimization
    const nextIndex = (activeNodeIndex + 1) % activeNodeIds.length;
    setActiveNodeIndex(nextIndex);
    
    // Move dialog to next active node without changing visual state
    setDialogVisibleOnNode(activeNodeIds[nextIndex]);
  }, [activeNodeIndex]);

  const handleDismissDialog = useCallback(() => {
    // Just hide the dialog without affecting node visual state
    setDialogVisibleOnNode('');
  }, []);

  // Update existing nodes to include the click handler and conversation starter
  React.useEffect(() => {
    setNodes((nds) => 
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          onNodeClick: handleNodeClick,
          onStartConversation: handleStartConversation,
          onMoveToNext: handleMoveToNextActiveNode,
          onDismiss: handleDismissDialog,
          showDialog: dialogVisibleOnNode === node.id
        }
      }))
    );
  }, [handleNodeClick, handleStartConversation, handleMoveToNextActiveNode, handleDismissDialog, dialogVisibleOnNode, setNodes]);

  // Show conversation page if active
  if (showConversation) {
    return (
      <ConversationPage
        selectedCategory={conversationCategory}
        onBack={handleConversationBack}
        onComplete={handleConversationComplete}
      />
    );
  }

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

      {/* Floating Add Button */}
      <FloatingAddButton onCategorySelect={handleCategorySelect} />

      {/* Milestone Detail Panel */}
      <MilestoneDetailPanel
        isOpen={isDetailPanelOpen}
        onClose={() => setIsDetailPanelOpen(false)}
        milestone={selectedMilestone}
        isActive={selectedMilestone?.title === 'Full-Stack Developer'}
      />
    </div>
  );
};

export default CareerJourney;