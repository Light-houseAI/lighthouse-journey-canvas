import React, { useCallback, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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

// Function to parse start year from date strings
const parseStartYear = (dateStr: string, fullDateStr?: string): number => {
  if (fullDateStr) {
    const match = fullDateStr.match(/(\w+)\s+(\d{4})/);
    if (match) {
      const month = match[1];
      const year = parseInt(match[2]);
      // Convert month to decimal for more precise ordering
      const monthMap: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      return year + (monthMap[month] || 0) / 12;
    }
  }
  
  const match = dateStr.match(/(\d{4})/);
  return match ? parseInt(match[1]) : 2023;
};

// Function to calculate spacing based on temporal distance
const calculateSpacing = (yearDiff: number): number => {
  if (yearDiff < 1) return 200;  // Under 1 year apart
  if (yearDiff <= 3) return 280; // 1-3 years apart
  return 360; // Over 3 years apart
};

// Function to calculate chronological positions with anti-overlap logic
const calculateChronologicalPositions = (nodesData: any[]) => {
  // Sort nodes by start year (excluding child nodes)
  const mainTimelineNodes = nodesData.filter(node => 
    node.data.type !== 'projects' || node.id === '5' // Keep checkout optimization as it's part of main timeline
  );
  
  const sortedNodes = [...mainTimelineNodes].sort((a, b) => {
    const yearA = parseStartYear(a.data.date, a.data.fullDate);
    const yearB = parseStartYear(b.data.date, b.data.fullDate);
    return yearA - yearB;
  });

  let currentX = 200; // Starting X position
  const baseY = 300;
  const positions: Record<string, { x: number; y: number }> = {};

  sortedNodes.forEach((node, index) => {
    if (index === 0) {
      positions[node.id] = { x: currentX, y: baseY };
    } else {
      const prevNode = sortedNodes[index - 1];
      const currentYear = parseStartYear(node.data.date, node.data.fullDate);
      const prevYear = parseStartYear(prevNode.data.date, prevNode.data.fullDate);
      const yearDiff = Math.abs(currentYear - prevYear);
      
      const spacing = calculateSpacing(yearDiff);
      currentX += spacing;
      
      // Check for potential overlap and nudge vertically if needed
      let yOffset = 0;
      const sameYearNodes = sortedNodes.slice(0, index).filter(prevNode => {
        const prevYear = parseStartYear(prevNode.data.date, prevNode.data.fullDate);
        return Math.abs(currentYear - prevYear) < 0.5; // Same year or very close
      });
      
      if (sameYearNodes.length > 0) {
        // Stagger vertically for nodes in the same time period
        yOffset = (sameYearNodes.length % 2 === 0) ? -50 : 50;
      }
      
      positions[node.id] = { x: currentX, y: baseY + yOffset };
    }
  });

  return positions;
};

// Initial sample career journey data with raw positioning data
const rawNodesData = [
  {
    id: '2',
    data: {
      title: 'B.S. in Computer Science',
      type: 'education',
      date: '2018 to 2022',
      description: 'Bachelor of Science in Computer Science',
      skills: ['Programming', 'Algorithms', 'Software Design'],
      organization: 'University of California, Los Angeles',
      tags: ['degree', 'computer science']
    },
  },
  {
    id: '3',
    data: {
      title: 'Data Analyst Intern',
      type: 'jobs',
      date: '2021',
      fullDate: 'Sep 2021 to Dec 2021',
      description: 'Data analysis intern working on financial technology products',
      skills: ['Data Analysis', 'SQL', 'Python', 'Financial Modeling'],
      organization: 'SoFi',
      tags: ['internship', 'data analysis', 'fintech']
    },
  },
  {
    id: '4',
    selected: true, // Mark as active node
    data: {
      title: 'Job search',
      type: 'jobsearch',
      date: 'Jun 2025 to present',
      fullDate: 'Jun 2025 to present',
      description: 'Actively seeking new opportunities in software development',
      skills: ['React', 'Node.js', 'Database Design', 'API Development'],
      tags: ['job search', 'software development']
    },
  },
  {
    id: '7',
    data: {
      title: 'Data Analyst Intern',
      type: 'jobs',
      date: '2024',
      fullDate: 'May 2024 to August 2024',
      description: 'Data analysis internship at Google working on large-scale data projects',
      skills: ['Data Analysis', 'BigQuery', 'Python', 'Machine Learning'],
      organization: 'Google',
      tags: ['internship', 'data analysis', 'tech']
    },
  },
  {
    id: '8',
    data: {
      title: 'Masters in Information Systems',
      type: 'education',
      date: '2023 to 2025',
      fullDate: 'Sep 2023 to May 2025',
      description: 'Master of Information Systems degree',
      skills: ['Information Systems', 'Data Management', 'Systems Analysis', 'Technology Strategy'],
      organization: 'University of Maryland',
      tags: ['degree', 'masters', 'information systems']
    },
  },
];

// Calculate chronological positions
const chronologicalPositions = calculateChronologicalPositions(rawNodesData);

// Create initial nodes with calculated positions
const initialNodes: Node[] = [
  ...rawNodesData.map(nodeData => ({
    id: nodeData.id,
    type: 'milestone',
    position: chronologicalPositions[nodeData.id],
    selected: nodeData.selected,
    data: nodeData.data,
  })),
  // Child nodes for Job search (positioned using same spacing logic)
    {
      id: '5',
      type: 'milestone',
      position: { x: chronologicalPositions['4'].x + 200, y: 650 }, // Apply under 1 year spacing (200px)
      selected: true, // Mark as active node
      data: {
        title: 'Job search prep',
        type: 'projects',
        date: 'Jun 2025 to present',
        description: 'Preparing for job search and improving technical skills',
        skills: ['React', 'A/B Testing', 'Analytics', 'UX Optimization'],
      tags: ['optimization', 'ecommerce'],
      documentation: {
        overview: {
          icon: '🧾',
          title: 'Project Overview',
          content: 'This project explores opportunities to streamline the checkout experience for an e-commerce platform. The goal is to reduce friction, improve conversion rates, and deliver a smoother path from cart to confirmation.',
          visual: 'checkout-ui'
        },
        problem: {
          icon: '🛠',
          title: 'Problem Statement',
          content: 'Current checkout flows are lengthy, require too many form fields, and often cause shoppers to abandon their carts. High abandonment rates directly impact revenue and overall customer satisfaction.',
          visual: 'abandonment-chart'
        },
        strategy: {
          icon: '🧪',
          title: 'Strategy',
          content: 'We tested simplified form designs, explored guest checkout options, and introduced progress indicators to make the process more transparent. Iterative prototyping and A/B testing guided decisions and validated improvements.',
          visual: 'wireframe-variations'
        },
        research: {
          icon: '🔍',
          title: 'Research',
          content: 'Initial customer interviews revealed frustration with repeated data entry and unclear payment options. Competitor analysis showed that leading retailers use autofill, wallet integrations, and streamlined steps to reduce friction.',
          visual: 'persona-competitor'
        },
        visuals: {
          icon: '🎨',
          title: 'Placeholder Visuals',
          content: 'Please insert temporary visual components (e.g. illustrations, sample charts, or icon placeholders) to accompany each card until real assets are added. These help provide a sense of structure and completeness during early-stage reviews.',
          visual: 'placeholder-visual'
        }
      }
    },
  },
  {
    id: '6',
    type: 'milestone',
    position: { x: chronologicalPositions['4'].x + 400, y: 650 }, // Continue spacing pattern
    selected: true, // Mark as active node
    data: {
      title: 'Interview loop',
      type: 'interviews',
      date: 'Jul 2025 to present',
      description: 'Currently interviewing for Data Analyst position at PayPal',
      skills: ['Data Analysis', 'SQL', 'Python', 'Business Intelligence'],
      organization: 'PayPal',
      tags: ['interviews', 'data analyst', 'retail'],
      jobPostingUrl: 'https://careers.walmart.com/data-analyst-position',
      interviewRounds: [
        {
          id: 1,
          title: 'Recruiter Screen',
          status: 'completed',
          date: 'Jul 22, 2025',
          description: 'Initial conversation about role expectations and background'
        },
        {
          id: 2,
          title: 'Online Analytics Challenge',
          status: 'completed', 
          date: 'Jul 29, 2025',
          description: 'Technical assessment covering SQL, data interpretation, and business metrics'
        },
        {
          id: 3,
          title: 'Behavioral Interview',
          status: 'upcoming',
          date: 'Aug 5, 2025',
          description: 'Discussion of past experiences, problem-solving approach, and cultural fit using STAR method'
        },
        {
          id: 4,
          title: 'Final Interview',
          status: 'pending',
          date: 'Aug 12, 2025',
          description: 'Meet with hiring manager and team leads'
        }
      ]
    },
  },
];

// Generate edges based on chronological order
const generateChronologicalEdges = (sortedNodeIds: string[]): Edge[] => {
  const edges: Edge[] = [];
  
  for (let i = 0; i < sortedNodeIds.length - 1; i++) {
    const sourceId = sortedNodeIds[i];
    const targetId = sortedNodeIds[i + 1];
    
    edges.push({
      id: `e${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: 'straight',
      style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
      className: 'career-path-edge'
    });
  }
  
  return edges;
};

// Get chronologically sorted node IDs
const sortedNodeIds = [...rawNodesData]
  .sort((a, b) => {
    const yearA = parseStartYear(a.data.date, a.data.fullDate);
    const yearB = parseStartYear(b.data.date, b.data.fullDate);
    return yearA - yearB;
  })
  .map(node => node.id);

const initialEdges: Edge[] = [
  ...generateChronologicalEdges(sortedNodeIds),
  // Connecting edge from Job search to Job preparation
  { 
    id: 'e4-5', 
    source: '4', 
    sourceHandle: 'bottom',
    target: '5', 
    targetHandle: 'left',
    type: 'smoothstep',
    style: { stroke: 'rgba(255, 255, 255, 0.5)', strokeWidth: 2, strokeDasharray: '5,5' },
    className: 'career-path-edge'
  },
  // Connecting edge from Job preparation to Interview loop
  { 
    id: 'e5-6', 
    source: '5', 
    sourceHandle: 'right',
    target: '6', 
    targetHandle: 'left',
    type: 'smoothstep',
    style: { stroke: 'rgba(255, 255, 255, 0.5)', strokeWidth: 2, strokeDasharray: '5,5' },
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
  const [dialogVisibleOnNode, setDialogVisibleOnNode] = useState<string>('6'); // Start with Interview loop node
  const [expandedParent, setExpandedParent] = useState<string>('4'); // Track which parent has expanded children, default to '4' (Job search)

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
    // Find all active nodes in the new order: Interview loop, Job search prep, Job search
    const activeNodeIds = ['6', '5', '4']; // Interview loop (Dec 2025), Job search prep (Jun 2025), Job search (Jun 2025)
    const nextIndex = (activeNodeIndex + 1) % activeNodeIds.length;
    setActiveNodeIndex(nextIndex);
    
    // Move dialog to next active node without changing visual state
    setDialogVisibleOnNode(activeNodeIds[nextIndex]);
  }, [activeNodeIndex]);

  const handleDismissDialog = useCallback(() => {
    // Just hide the dialog without affecting node visual state
    setDialogVisibleOnNode('');
  }, []);

  const handleToggleChildren = useCallback((parentId: string) => {
    setExpandedParent(current => current === parentId ? '' : parentId);
  }, []);

  // Define parent-child relationships
  const parentChildMap: Record<string, string[]> = {
    '4': ['5', '6'], // Job search -> Job preparation, Interview loop
  };

  // Update existing nodes to include the click handler and conversation starter
  React.useEffect(() => {
    setNodes((nds) => 
      nds.map(node => {
        const hasChildren = parentChildMap[node.id];
        const isChild = Object.values(parentChildMap).flat().includes(node.id);
        const shouldShow = !isChild || expandedParent === Object.keys(parentChildMap).find(parentId => 
          parentChildMap[parentId].includes(node.id)
        );
        
        // Define which nodes should remain active (glowing) regardless of selection
        const permanentlyActiveNodes = ['4', '5', '6']; // Job search, Job search prep, Interview loop
        const isActive = permanentlyActiveNodes.includes(node.id);
        
        return {
          ...node,
          hidden: !shouldShow,
          data: {
            ...node.data,
            onNodeClick: handleNodeClick,
            onStartConversation: handleStartConversation,
            onMoveToNext: handleMoveToNextActiveNode,
            onDismiss: handleDismissDialog,
            showDialog: dialogVisibleOnNode === node.id,
            hasChildren: !!hasChildren,
            isExpanded: expandedParent === node.id,
            onToggleChildren: hasChildren ? () => handleToggleChildren(node.id) : undefined,
            isActive: isActive // Add persistent active state
          }
        };
      })
    );
  }, [handleNodeClick, handleStartConversation, handleMoveToNextActiveNode, handleDismissDialog, dialogVisibleOnNode, expandedParent, handleToggleChildren, setNodes]);

  // Update edges visibility based on expanded state
  React.useEffect(() => {
    setEdges((eds) =>
      eds.map(edge => {
        const isChildEdge = Object.values(parentChildMap).flat().some(childId => 
          edge.source === childId || edge.target === childId
        );
        
        if (!isChildEdge) return edge;
        
        // Find which parent this edge belongs to
        const parentId = Object.keys(parentChildMap).find(parentId => 
          parentChildMap[parentId].includes(edge.source) || parentChildMap[parentId].includes(edge.target)
        );
        
        return {
          ...edge,
          hidden: parentId !== expandedParent
        };
      })
    );
  }, [expandedParent, setEdges]);

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
          onPaneClick={(event) => {
            // Prevent clearing node selection by stopping the event
            event.preventDefault();
          }}
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
        isActive={selectedMilestone?.title === 'Job search' || selectedMilestone?.title === 'Interview loop'}
      />
    </div>
  );
};

export default CareerJourney;