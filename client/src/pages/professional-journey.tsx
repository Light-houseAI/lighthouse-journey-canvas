import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Background,
  BackgroundVariant,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, LogOut, Brain, X } from "lucide-react";
import { FaMicrophone, FaTimes, FaRobot } from 'react-icons/fa';
import { useAuth } from "@/hooks/useAuth";
import { NodeFactory } from '@/components/nodes';
import OverlayChat from "@/components/OverlayChat";
import TimelineScrubber from "@/components/TimelineScrubber";
import SkillDashboard from "@/components/SkillDashboard";
import { compareAsc,parse } from 'date-fns';


// Helper function to extract string values from potentially complex data structures
function extractStringValue(value: any): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    // Handle common object structures like { name: "value" } or { role: "value" }
    return value.name || value.role || value.title || value.value || String(value);
  }
  return undefined;
}

// Helper function to format date ranges
function formatDateRange(startDate: Date | undefined, endDate: Date | undefined): string {
  if (!startDate) return 'Unknown';

  const start = new Date(startDate);
  // Check if date is valid
  if (isNaN(start.getTime())) return 'Unknown';

  const startFormatted = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  if (!endDate) {
    return `${startFormatted} - Present`;
  }

  const end = new Date(endDate);
  // Check if end date is valid
  if (isNaN(end.getTime())) {
    return `${startFormatted} - Present`;
  }

  const endFormatted = end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return `${startFormatted} - ${endFormatted}`;
}

// Helper function to calculate duration
function calculateDuration(startDate: Date | undefined, endDate: Date | undefined): string {
  if (!startDate) return '';

  const start = new Date(startDate);
  // Check if start date is valid
  if (isNaN(start.getTime())) return '';

  const end = endDate ? new Date(endDate) : new Date();
  // Check if end date is valid (when provided)
  if (endDate && isNaN(end.getTime())) {
    // Use current date if end date is invalid
    end.setTime(new Date().getTime());
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44)); // Average days per month

  if (diffMonths === 0) {
    return '1 month'; // Minimum duration
  }

  if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''}`;
  }

  const years = Math.floor(diffMonths / 12);
  const remainingMonths = diffMonths % 12;

  if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  }

  return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
}

// Timeline Y positions with proper padding
const PRIMARY_TIMELINE_Y = 300;
const TIMELINE_PADDING = 300; // Increased padding between timeline levels to prevent overlap
const SECONDARY_TIMELINE_Y = PRIMARY_TIMELINE_Y + TIMELINE_PADDING;
const PROJECT_TIMELINE_Y = SECONDARY_TIMELINE_Y + TIMELINE_PADDING; // Projects branch below experiences

// Determine if a node should be on the primary timeline
function isPrimaryTimelineNode(type: string): boolean {
  const primaryTypes = ['education', 'job', 'experience'];
  return primaryTypes.includes(type);
}

// Calculate position for timeline nodes with straight-line alignment
// @ts-ignore - Complex type inference issues
function getTimelinePosition(
  type: string,
  item: any,
  allItems: any[],
  primaryTimelineNodes: any[],
  isOverlapping: boolean = false
): { x: number; y: number } {
  const nodeSpacing = 500; // Increased horizontal spacing between primary nodes
  const startX = 200; // Starting X position

  if (isPrimaryTimelineNode(type)) {
    if (isOverlapping) {
      // Overlapping primary nodes go to secondary timeline
      // Find the primary node this overlaps with and align X position
      const itemDate = item.sortDate;
      let closestPrimaryNode: { node: any; index: number } | null = null;
      let minDateDiff = Infinity;

      primaryTimelineNodes.forEach((primaryNode, index) => {
        const primaryDate = primaryNode.sortDate;
        const dateDiff = Math.abs(itemDate.getTime() - primaryDate.getTime());

        if (dateDiff < minDateDiff) {
          minDateDiff = dateDiff;
          closestPrimaryNode = { node: primaryNode, index };
        }
      });

      if (closestPrimaryNode) {
        // Align X with the primary node but place on secondary timeline
        const alignedX = startX + ((closestPrimaryNode as any).index * nodeSpacing);
        return {
          x: alignedX,
          y: SECONDARY_TIMELINE_Y // Straight line on secondary timeline
        };
      }
    }

    // Primary timeline position - straight horizontal line
    const primaryIndex = primaryTimelineNodes.findIndex(pNode => pNode === item);
    return {
      x: startX + (primaryIndex * nodeSpacing),
      y: PRIMARY_TIMELINE_Y // Perfectly straight primary timeline
    };
  } else {
    // Non-primary nodes: align with closest primary node by date
    const itemDate = item.sortDate;
    let closestPrimaryNode: { node: any; index: number } | null = null;
    let minDateDiff = Infinity;

    primaryTimelineNodes.forEach((primaryNode, index) => {
      const primaryDate = primaryNode.sortDate;
      const dateDiff = Math.abs(itemDate.getTime() - primaryDate.getTime());

      if (dateDiff < minDateDiff) {
        minDateDiff = dateDiff;
        closestPrimaryNode = { node: primaryNode, index };
      }
    });

    // Branch Y positions with proper spacing from secondary timeline
    const branchYPositions = {
      // Above primary timeline
      certification: PRIMARY_TIMELINE_Y - TIMELINE_PADDING,
      achievement: PRIMARY_TIMELINE_Y - (TIMELINE_PADDING * 1.5),

      // Below secondary timeline
      project: SECONDARY_TIMELINE_Y + TIMELINE_PADDING,
      side_project: SECONDARY_TIMELINE_Y + (TIMELINE_PADDING * 1.5),
      volunteering: SECONDARY_TIMELINE_Y + (TIMELINE_PADDING * 2),
      skill: SECONDARY_TIMELINE_Y + (TIMELINE_PADDING * 0.7),
      event: SECONDARY_TIMELINE_Y + (TIMELINE_PADDING * 0.5),
      transition: SECONDARY_TIMELINE_Y + (TIMELINE_PADDING * 0.3),
    };

    if (closestPrimaryNode) {
      // Align X exactly with the primary node - no horizontal offset
      const alignedX = startX + ((closestPrimaryNode as any).index * nodeSpacing);

      return {
        x: alignedX, // Perfectly aligned X position
        y: branchYPositions[type as keyof typeof branchYPositions] || (SECONDARY_TIMELINE_Y + TIMELINE_PADDING)
      };
    }

    // Fallback: use primary timeline spacing
    const allItemIndex = allItems.findIndex(nodeItem => nodeItem === item);
    return {
      x: startX + (allItemIndex * nodeSpacing),
      y: branchYPositions[type as keyof typeof branchYPositions] || (SECONDARY_TIMELINE_Y + TIMELINE_PADDING)
    };
  }
}

// Calculate branch offset for sub-milestones based on type and count
function getBranchOffset(type: string, count: number): number {
  const branchOffsets = {
    project: 50 + (count * 30),          // Work projects branch below
    side_project: 120 + (count * 30),    // Side projects further below
    achievement: -50 - (count * 30),     // Achievements branch above
    certification: -80 - (count * 30),   // Certifications branch above
    volunteering: 150 + (count * 30),    // Volunteering branches below
    update: 20 + (count * 25),           // Regular updates close to parent
  };

  return branchOffsets[type as keyof typeof branchOffsets] || (30 + (count * 25));
}

// Helper function to check if two date ranges overlap
function datesOverlap(start1?: Date, end1?: Date, start2?: Date, end2?: Date): boolean {
  if (!start1 || !start2) return false;
  
  const end1Date = end1 || new Date(); // If no end date, assume ongoing
  const end2Date = end2 || new Date();
  
  return start1 <= end2Date && start2 <= end1Date;
}

// Helper function to get active/ongoing projects for a parent node
function getActiveProjects(parentNode: any): any[] {
  const projects = parentNode.data.originalData?.projects || [];
  const currentDate = new Date();
  
  return projects.filter((project: any) => {
    // If project has no end date or end date is "Present", consider it active
    if (!project.end || project.end.toLowerCase() === 'present' || project.end.toLowerCase() === 'current') {
      return true;
    }
    
    // Try to parse the end date and check if it's in the future
    try {
      const endDate = parse(project.end, 'MMM yyyy', new Date());
      return endDate >= currentDate;
    } catch {
      // If we can't parse the date, assume it's active
      return true;
    }
  }).map((project: any) => ({
    name: project.title || project.name || 'Unnamed Project',
    organization: project.organization || project.company,
    duration: project.duration,
    description: project.description
  }));
}

// Helper function to get active projects from profile data structure
function getActiveProjectsFromProfile(experienceData: any): any[] {
  const projects = experienceData.projects || [];
  const currentDate = new Date();
  
  return projects.filter((project: any) => {
    // If project has no end date or end date is "Present", consider it active
    const endValue = extractStringValue(project.end);
    if (!endValue || endValue.toLowerCase() === 'present' || endValue.toLowerCase() === 'current') {
      return true;
    }
    
    // Try to parse the end date and check if it's in the future
    try {
      const endDate = parse(endValue, 'MMM yyyy', new Date());
      return endDate >= currentDate;
    } catch {
      // If we can't parse the date, assume it's active
      return true;
    }
  }).map((project: any) => ({
    name: extractStringValue(project.title) || extractStringValue(project.name) || 'Unnamed Project',
    organization: extractStringValue(project.organization) || extractStringValue(project.company),
    duration: extractStringValue(project.duration),
    description: extractStringValue(project.description)
  }));
}

// Calculate positions for projects as a secondary timeline below experience
function calculateProjectPositions(
  projects: any[], 
  experiencePosition: { x: number; y: number },
  startX: number,
  nodeSpacing: number
): Array<{ project: any; position: { x: number; y: number }; level: number }> {
  const projectPositions: Array<{ 
    project: any; 
    position: { x: number; y: number }; 
    level: number;
    startDate?: Date;
    endDate?: Date;
  }> = [];

  // Parse project dates and sort by start date
  const projectsWithDates = projects.map(project => ({
    ...project,
    startDate: project.start ? parse(project.start, 'MMM yyyy', new Date()) : undefined,
    endDate: project.end ? parse(project.end, 'MMM yyyy', new Date()) : undefined,
  })).sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.getTime() - b.startDate.getTime();
  });

  // Position projects on timeline levels based on overlaps
  projectsWithDates.forEach((project, index) => {
    // Find the lowest level where this project doesn't overlap with existing projects
    let level = 0;
    let levelFound = false;
    
    while (!levelFound) {
      const projectsOnLevel = projectPositions.filter(p => p.level === level);
      const hasOverlap = projectsOnLevel.some(existingProject => 
        datesOverlap(
          project.startDate, 
          project.endDate,
          existingProject.startDate,
          existingProject.endDate
        )
      );
      
      if (!hasOverlap) {
        levelFound = true;
      } else {
        level++;
      }
    }
    
    // Calculate X position based on chronological order in the timeline
    let xPosition: number;
    if (project.startDate) {
      // Position based on actual date within the experience timeline
      const experienceStartX = experiencePosition.x - 100; // Start secondary timeline a bit left of experience
      const timelineWidth = 800; // Width of the project timeline
      
      // For now, use index-based positioning, but this could be enhanced with actual date-based positioning
      xPosition = experienceStartX + (index * nodeSpacing * 0.8); // Slightly tighter spacing for projects
    } else {
      // No date info, position based on index
      xPosition = experiencePosition.x + (index * nodeSpacing * 0.8);
    }
    
    const yPosition = experiencePosition.y + 200 + (level * 100); // Each level is 100px below the previous
    
    projectPositions.push({
      project,
      position: { x: xPosition, y: yPosition },
      level,
      startDate: project.startDate,
      endDate: project.endDate
    });
  });

  return projectPositions;
}

// Get edge styling based on connection type
function getEdgeStyle(type: string): React.CSSProperties {
  const edgeStyles = {
    project: {
      stroke: '#10b981',
      strokeWidth: 2,
      strokeDasharray: '5,5'
    },
    side_project: {
      stroke: '#f59e0b',
      strokeWidth: 2,
      strokeDasharray: '3,3'
    },
    achievement: {
      stroke: '#8b5cf6',
      strokeWidth: 3,
      strokeDasharray: '1,1'
    },
    certification: {
      stroke: '#06b6d4',
      strokeWidth: 2,
      strokeDasharray: '2,2'
    },
    volunteering: {
      stroke: '#ef4444',
      strokeWidth: 2,
      strokeDasharray: '4,4'
    },
    update: {
      stroke: '#6b7280',
      strokeWidth: 1,
      strokeDasharray: '2,1'
    },
    main: {
      stroke: 'rgba(255, 255, 255, 0.3)',
      strokeWidth: 2
    }
  };

  return edgeStyles[type as keyof typeof edgeStyles] || edgeStyles.project;
}

interface Experience {
  title?: string;
  company?: string;
  position?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
}

interface Education {
  school?: string;
  institution?: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  description?: string;
}

interface MilestoneData {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  startDate?: Date;
  endDate?: Date;
  description: string;
  skills: string[];
  organization?: string;
}

const nodeTypes = {
  milestone: NodeFactory,
};

export default function ProfessionalJourney() {
  const [, setLocation] = useLocation();
  const [showChatPrompt, setShowChatPrompt] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);
  const [addingMilestoneFor, setAddingMilestoneFor] = useState<string | null>(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [isSkillDashboardOpen, setIsSkillDashboardOpen] = useState(false);
  const [focusedExperience, setFocusedExperience] = useState<string | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  // Effect to show chat prompt for new and returning users
  useEffect(() => {
    if (user && profile && !showChatPrompt) {
      // Check if user has completed onboarding
      const hasCompletedOnboarding = user.hasCompletedOnboarding;

      if (!hasCompletedOnboarding) {
        // New user needs onboarding - show chat prompt immediately
        const timer = setTimeout(() => {
          setShowChatPrompt(true);
          setIsVoicePanelOpen(true); // Automatically open chat for new users
        }, 500);

        return () => clearTimeout(timer);
      } else {
        // Returning user - show chat prompt after brief delay
        const timer = setTimeout(() => {
          setShowChatPrompt(true);
        }, 1500);

        return () => clearTimeout(timer);
      }
    }
  }, [user, profile, showChatPrompt]);

  const { data: savedProjects } = useQuery({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback((milestoneData: any, nodeId?: string) => {
    console.log('Node clicked:', milestoneData, 'nodeId:', nodeId); // Debug log
    console.log('Original data:', milestoneData.originalData); // Debug log
    console.log('Projects in data:', milestoneData.originalData?.projects); // Debug log
    
    // Check if this is an experience node (type 'job' from experience data)
    if (milestoneData.type === 'job' && milestoneData.originalData?.projects && milestoneData.originalData.projects.length > 0) {
      console.log('Experience node clicked with projects'); // Debug log
      
      // Toggle focus mode for this experience
      if (focusedExperience === nodeId) {
        console.log('Exiting focus mode'); // Debug log
        setFocusedExperience(null); // Exit focus mode
      } else {
        console.log('Entering focus mode for:', nodeId); // Debug log
        setFocusedExperience(nodeId || ''); // Enter focus mode
        
        // Navigate to the focused node with zoom
        if (nodeId && reactFlowInstance.current) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: [{ id: nodeId }],
              duration: 800,
              padding: 0.3,
            });
          }, 100);
        }
      }
    } else {
      console.log('Regular milestone clicked or no projects'); // Debug log
      // Normal milestone selection for non-experience nodes
      setSelectedMilestone(milestoneData);
    }
  }, [focusedExperience]);

  // Navigate to a specific node on the timeline with smooth animation
  const navigateToNode = useCallback((nodeId: string, highlightDuration: number = 3000) => {
    console.log('Navigating to node:', nodeId);

    if (!reactFlowInstance.current) {
      console.warn('ReactFlow instance not available');
      return;
    }

    // Check if fitView method exists
    if (typeof reactFlowInstance.current.fitView !== 'function') {
      console.error('fitView method not available on ReactFlow instance');
      return;
    }

    // @ts-ignore - Type inference issue with nodes state
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      // Try to find node by organization or title
      // @ts-ignore - Type inference issue with nodes state
      const foundNode = nodes.find(n => {
        const data = n.data as any;
        return (
          data?.organization?.toLowerCase?.()?.includes?.(nodeId.toLowerCase()) ||
          data?.title?.toLowerCase?.()?.includes?.(nodeId.toLowerCase())
        );
      });
      if (!foundNode) {
        console.log('Node not found:', nodeId);
        return;
      }
      nodeId = foundNode.id;
    }

    try {
      // Highlight the node
      setHighlightedNodeId(nodeId);

      // Navigate to the node with smooth animation
      reactFlowInstance.current.fitView({
        nodes: [{ id: nodeId }],
        duration: 800,
        padding: 0.3,
      });

      // Remove highlight after duration
      setTimeout(() => {
        setHighlightedNodeId(null);
      }, highlightDuration);

      console.log('Successfully navigated to node:', nodeId);
    } catch (error) {
      console.error('Error navigating to node:', error);
    }
  }, [nodes]);

  // Navigate to a specific year on the timeline
  const navigateToYear = useCallback((year: number) => {
    console.log('Navigating to year:', year);

    // Add a small delay to ensure ReactFlow instance is fully initialized
    const tryNavigate = () => {
      if (!reactFlowInstance.current) {
        console.warn('ReactFlow instance not available');
        return false;
      }

      // Check if fitView method exists
      if (typeof reactFlowInstance.current.fitView !== 'function') {
        console.error('fitView method not available on ReactFlow instance');
        return false;
      }

      return true;
    };

    // Try immediate navigation, if fails, retry after short delay
    if (!tryNavigate()) {
      setTimeout(() => {
        if (!tryNavigate()) {
          console.error('ReactFlow instance still not ready after delay');
          return;
        }
        performNavigation();
      }, 100);
      return;
    }

    performNavigation();

    function performNavigation() {
      // Find nodes that match the year
      const nodesForYear = nodes.filter(node => {
        const nodeData = node.data;

        if (nodeData.startDate) {
          const startYear = new Date(nodeData.startDate as string).getFullYear();
          const endYear = nodeData.endDate ? new Date(nodeData.endDate as string).getFullYear() : startYear;
          return year >= startYear && year <= endYear;
        }

        if (nodeData.date) {
          const nodeYear = parseInt(nodeData.date as string);
          return nodeYear === year;
        }

        return false;
      });

      console.log('Nodes for year', year, ':', nodesForYear);

      if (nodesForYear.length > 0) {
        try {
          // Navigate to the nodes using fitView
          reactFlowInstance.current!.fitView({
            nodes: nodesForYear.map(node => ({ id: node.id })),
            duration: 800,
            padding: 0.2,
            maxZoom: 1.2,
            minZoom: 0.5
          });

          // Highlight all nodes for this year
          nodesForYear.forEach((node, index) => {
            setTimeout(() => {
              setHighlightedNodeId(node.id);
              setTimeout(() => setHighlightedNodeId(null), 2000);
            }, index * 100); // Stagger highlights
          });

          console.log('Successfully navigated to year', year);
        } catch (error) {
          console.error('Error navigating to year:', error);
        }
      } else {
        console.log('No nodes found for year', year);
      }
    }
  }, [nodes]);

  // Listen for navigation events from chat
  useEffect(() => {
    const handleTimelineNavigation = (event: CustomEvent) => {
      const { nodeId, entity } = event.detail;
      if (nodeId) {
        navigateToNode(nodeId);
      } else if (entity) {
        // Find node by entity name (company, title, etc.)
        navigateToNode(entity);
      }
    };

    window.addEventListener('navigateTimeline', handleTimelineNavigation as EventListener);
    return () => window.removeEventListener('navigateTimeline', handleTimelineNavigation as EventListener);
  }, [navigateToNode]);

  const addMilestone = useCallback(async (milestone: MilestoneData) => {
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
      data: {
        ...milestone,
        onNodeClick: handleNodeClick
      },
    };

    // @ts-ignore - Type inference issue with React Flow state
    setNodes((nds: Node[]) => [...nds, newNode]);

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

    // Save milestone to database and vector store
    try {
      const response = await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ milestone }),
      });

      const result = await response.json();
      
      if (result.success && result.shouldFocus) {
        // Focus on the newly created node
        setTimeout(() => {
          navigateToNode(milestone.id);
        }, 500); // Small delay to ensure node is rendered
      }

      // Invalidate and refetch projects data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      console.log('Milestone saved to PostgreSQL and Vector DB:', result);
    } catch (error) {
      console.error('Failed to save milestone:', error);
    }
  }, [nodes, setNodes, setEdges, handleNodeClick]);

  const updateMilestone = useCallback((nodeId: string, update: string) => {
    // @ts-ignore - Type inference issue with React Flow state  
    setNodes((nds: Node[]) =>
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              description: node.data.description
                ? `${node.data.description}\n\nUpdate: ${update}`
                : `Update: ${update}`,
              // Add a visual indicator that this node was updated
              isUpdated: true,
            }
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const addSubMilestone = useCallback(async (parentNodeId: string, subMilestone: any) => {
    console.log('Adding sub-milestone:', subMilestone, 'to parent:', parentNodeId);

    // Use functional update to access current nodes state
    setNodes((currentNodes) => {
      console.log('Current nodes in callback:', currentNodes.map(n => ({ id: n.id, title: n.data.title })));

      // Find the parent node position
      const parentNode = currentNodes.find(node => node.id === parentNodeId);
      if (!parentNode) {
        console.log('Parent node not found:', parentNodeId, 'Available nodes:', currentNodes.map(n => n.id));
        // Create the node with a default position
        const subNode: Node = {
          id: subMilestone.id || `sub-${Date.now()}-${Math.random()}`,
          type: 'milestone',
          position: { x: 400, y: 300 },
          data: {
            title: subMilestone.title,
            type: subMilestone.type || 'update',
            description: subMilestone.description,
            dateRange: subMilestone.dateRange,
            location: subMilestone.location,
            organization: subMilestone.parentOrganization,
            isSubMilestone: true,
            parentId: parentNodeId,
            starDetails: subMilestone.starDetails,
            onNodeClick: handleNodeClick,
            onDelete: handleNodeDelete,
            onEdit: (nodeId: string, newTitle: string, newDescription: string) => {
              setNodes(nodes => nodes.map(node =>
                node.id === nodeId
                  ? { ...node, data: { ...node.data, title: newTitle, description: newDescription } }
                  : node
              ));
            }
          },
        };

        console.log('Creating sub-milestone node without parent:', subNode);
        return [...currentNodes, subNode];
      }

      // Calculate position relative to parent with smart branch positioning
      const existingSubMilestones = currentNodes.filter(node =>
        node.data.isSubMilestone && node.data.parentId === parentNodeId
      );

      const totalSubCount = existingSubMilestones.length;

      // Determine branch positioning based on sub-milestone type
      const subType = subMilestone.type || 'project';
      const branchYOffset = getBranchOffset(subType, totalSubCount);

      // Position sub-milestones with intelligent spacing
      const xPosition = parentNode.position.x + 250 + (totalSubCount * 200); // Horizontal branching
      const yPosition = parentNode.position.y + branchYOffset; // Vertical offset for different types

      const subNode: Node = {
        id: subMilestone.id || `sub-${Date.now()}-${Math.random()}`,
        type: 'milestone',
        position: { x: xPosition, y: yPosition },
        data: {
          title: subMilestone.title,
          type: subMilestone.type || 'update',
          description: subMilestone.description,
          dateRange: subMilestone.dateRange,
          location: subMilestone.location,
          organization: subMilestone.parentOrganization,
          isSubMilestone: true,
          parentId: parentNodeId,
          starDetails: subMilestone.starDetails,
          onNodeClick: handleNodeClick,
          onDelete: handleNodeDelete,
          onEdit: (nodeId: string, newTitle: string, newDescription: string) => {
            setNodes(nodes => nodes.map(node =>
              node.id === nodeId
                ? { ...node, data: { ...node.data, title: newTitle, description: newDescription } }
                : node
            ));
          }
        },
      };

      console.log('Creating sub-milestone node with parent:', subNode);
      return [...currentNodes, subNode];
    });

    // Add the edge after nodes are updated with smart edge styling
    setTimeout(() => {
      setEdges((currentEdges) => {
        const edgeStyle = getEdgeStyle(subMilestone.type || 'project');
        const newEdge: Edge = {
          id: `e${parentNodeId}-${subMilestone.id}`,
          source: parentNodeId,
          target: subMilestone.id,
          type: 'smoothstep',
          style: edgeStyle,
          className: `${subMilestone.type || 'project'}-edge`,
        };

        console.log('Creating sub-milestone edge:', newEdge);
        return [...currentEdges, newEdge];
      });
    }, 100);

    // Save sub-milestone to database
    try {
      const milestoneToSave = {
        ...subMilestone,
        id: subMilestone.id || `sub-${Date.now()}-${Math.random()}`,
        parentId: parentNodeId,
        isSubMilestone: true
      };

      console.log('Saving milestone:', milestoneToSave);

      const response = await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ milestone: milestoneToSave }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Save milestone response:', result);

      if (result.success && result.shouldFocus) {
        // Focus on the newly created sub-milestone
        setTimeout(() => {
          navigateToNode(milestoneToSave.id);
        }, 500); // Small delay to ensure node is rendered
      }

      // Invalidate and refetch projects data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error('Failed to save sub-milestone:', error);
    }
  }, [nodes, setNodes, setEdges, handleNodeClick, queryClient]);



  const handleNodeDelete = useCallback(async (nodeId: string) => {
    // Find edges connected to the node being deleted
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    const outgoingEdges = edges.filter(edge => edge.source === nodeId);

    // Create new edges to maintain the flow
    const newEdges: Edge[] = [];
    incomingEdges.forEach(inEdge => {
      outgoingEdges.forEach(outEdge => {
        // Connect each parent to each child of the deleted node
        const newEdge: Edge = {
          id: `e-${inEdge.source}-${outEdge.target}`,
          source: inEdge.source,
          target: outEdge.target,
          type: outEdge.type,
          style: outEdge.style,
          className: outEdge.className,
        };
        newEdges.push(newEdge);
      });
    });

    // Update edges: remove old ones and add new connections
    setEdges((eds) => [
      ...eds.filter(edge => edge.source !== nodeId && edge.target !== nodeId),
      ...newEdges
    ]);

    // Remove node from UI
    setNodes((nds: Node[]) => nds.filter(node => node.id !== nodeId));

    // Invalidate and refetch projects data
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  }, [edges, setNodes, setEdges, queryClient]);

  // Auto-start onboarding chat when profile loads (only if not completed)
  useEffect(() => {
    if (profile && !isLoading && !hasStartedOnboarding) {
      const hasCompletedOnboarding = (profile as any).user?.hasCompletedOnboarding;

      if (!hasCompletedOnboarding) {
        setHasStartedOnboarding(true);
        // Auto-open voice panel and start onboarding
        setTimeout(() => {
          setIsVoicePanelOpen(true);
        }, 1000);
      }
    }
  }, [profile, isLoading, hasStartedOnboarding]);

  useEffect(() => {
    if (!(profile as any)?.filteredData) return;

    console.log('Profile filteredData:', (profile as any).filteredData); // Debug log

    const milestones: Node[] = [];
    const connections: Edge[] = [];

    const nodeSpacing = 300;
    const baseY = 300;
    let nodeIndex = 0;

    // Combine and sort all timeline items by date
    const allItems: Array<{type: 'education' | 'experience', data: Education | Experience, sortDate: Date}> = [];

    // Add education items (only if they have valid dates)
    if ((profile as any).filteredData.education) {
      (profile as any).filteredData.education.forEach((edu: any) => {
        const startDate = edu.start;
        const endDate = edu.end === 'Present' ? Date.now().toLocaleString() : edu.end;
        edu.end = endDate; // Normalize end date to current date if 'Present'
        if (startDate) {
          const parsedDate = parse(startDate, 'MMM yyyy', new Date());
          // Only add if the date is valid
          if (!isNaN(parsedDate.getTime())) {
            allItems.push({
              type: 'education',
              data: edu,
              sortDate: parsedDate
            });
          } else {
            console.warn('Invalid education date:', startDate, edu);
          }
        }
      });
    }

    // Add experience items (only if they have valid dates)
    if ((profile as any).filteredData.experiences) {
      (profile as any).filteredData.experiences.forEach((exp: any) => {
        const startDate = exp.start;
        const endDate = exp.end === 'Present' ? Date.now().toLocaleString() : exp.end;
        exp.end = endDate; // Normalize end date to current date if 'Present'
        if (startDate) {
          const parsedDate = parse(startDate, 'MMM yyyy', new Date());
          // Only add if the date is valid
          if (!isNaN(parsedDate.getTime())) {
            allItems.push({
              type: 'experience',
              data: exp,
              sortDate: parsedDate
            });
          } else {
            console.warn('Invalid experience date:', startDate, exp);
          }
        }
      });
    }

    // If no items have valid dates, add them anyway with placeholder dates
    if (allItems.length === 0) {
      // Add education items without date filtering
      if ((profile as any).filteredData.education) {
        (profile as any).filteredData.education.forEach((edu: any, index: number) => {
          allItems.push({
            type: 'education',
            data: edu,
            sortDate: new Date(2000 + index) // Placeholder date
          });
        });
      }

      // Add experience items without date filtering
      if ((profile as any).filteredData.experiences) {
        (profile as any).filteredData.experiences.forEach((exp: any, index: number) => {
          allItems.push({
            type: 'experience',
            data: exp,
            sortDate: new Date(2010 + index) // Placeholder date
          });
        });
      }
    }

    // Sort by date (oldest first for chronological order)
    allItems.sort((a, b) => compareAsc(a.sortDate, b.sortDate));

    console.log('All items to process:', allItems); // Debug log

    // Detect overlapping timeline periods for primary nodes
    const primaryItems = allItems.filter(item => isPrimaryTimelineNode(item.type));
    const overlappingItems = new Set<number>();

    for (let i = 0; i < primaryItems.length; i++) {
      const currentItem = primaryItems[i];
      const currentStart = currentItem.sortDate;
      const currentEnd = currentItem.data.end ? parse(currentItem.data.end, 'MMM yyyy', new Date()) : currentStart;

      for (let j = i + 1; j < primaryItems.length; j++) {
        const nextItem = primaryItems[j];
        const nextStart = nextItem.sortDate;
        const nextEnd = nextItem.data.end ? parse(nextItem.data.end, 'MMM yyyy', new Date()) : nextStart;

        // Check for overlap
        if (currentEnd >= nextStart && nextEnd >= currentStart) {
          overlappingItems.add(j); // Mark the later item as overlapping
        }
      }
    }

    console.log('Overlapping items detected:', overlappingItems); // Debug log

    // Get non-overlapping primary timeline nodes for positioning reference
    const nonOverlappingPrimaryItems = primaryItems.filter((item, index) => !overlappingItems.has(index));

    // Create milestones from sorted items with proper alignment
    allItems.forEach((item, allItemIndex) => {
      const startDate = item.data.start ? parse(item.data.start, 'MMM yyyy', new Date()) : undefined;
      const endDate = item.data.end ? parse(item.data.end, 'MMM yyyy', new Date()) : undefined;
      const dateRange = formatDateRange(startDate, endDate);
      const duration = calculateDuration(startDate, endDate);

      // Determine if this is an overlapping primary node
      const isPrimary = isPrimaryTimelineNode(item.type);
      const primaryIndex = isPrimary ? primaryItems.findIndex(pItem => pItem === item) : -1;
      const isOverlapping = isPrimary && overlappingItems.has(primaryIndex);

      // Calculate position using new timeline layout with proper alignment
      const position = getTimelinePosition(
        item.type,
        item,
        allItems,
        nonOverlappingPrimaryItems,
        isOverlapping
      );

      const milestone: Node = {
        id: `${item.type}-${nodeIndex}`,
        type: 'milestone',
        position: position,
        data: {
          title: item.type === 'education'
            ? 'Student'
            : extractStringValue((item.data as Experience).title) ||
              extractStringValue((item.data as Experience).position) || 'Role',
          type: item.type === 'education' ? 'education' : 'job',
          date: dateRange, // Use formatted date range instead of just year
          duration: duration, // Add duration information
          description: item.data.description ||
            (item.type === 'education'
              ? `${extractStringValue((item.data as Education).degree) ? extractStringValue((item.data as Education).degree) + ' at ' : 'Studies at '}${extractStringValue((item.data as Education).school) || extractStringValue((item.data as Education).institution)}`
              : `${extractStringValue((item.data as Experience).title) || extractStringValue((item.data as Experience).position) ? (extractStringValue((item.data as Experience).title) || extractStringValue((item.data as Experience).position)) + ' at ' : 'Working at '}${extractStringValue((item.data as Experience).company)}`),
          skills: item.type === 'education' && extractStringValue((item.data as Education).field)
            ? [extractStringValue((item.data as Education).field)!]
            : [],
          organization: item.type === 'education'
            ? extractStringValue((item.data as Education).school) || extractStringValue((item.data as Education).institution)
            : extractStringValue((item.data as Experience).company),
          startDate: startDate, // Store original start date
          endDate: endDate, // Store original end date
          originalData: item.data, // Store original data for voice updates
          onNodeClick: (data: any) => handleNodeClick(data, `${item.type}-${nodeIndex}`),
          onNodeDelete: handleNodeDelete,
          swimLane: item.type,
          isPrimaryTimeline: isPrimary && !isOverlapping, // Mark primary timeline nodes
          isOverlapping: isOverlapping, // Mark overlapping nodes
          isFocused: focusedExperience === `${item.type}-${nodeIndex}`, // Mark if this node is focused
          isBlurred: focusedExperience && focusedExperience !== `${item.type}-${nodeIndex}`, // Mark if this node should be blurred
          hasProjects: item.type === 'experience' && (item.data as any).projects && (item.data as any).projects.length > 0, // Mark if this experience has projects
        },
      };
      milestones.push(milestone);
      
      // Add project nodes if this experience is focused
      if (item.type === 'experience' && (item.data as any).projects && focusedExperience === `${item.type}-${nodeIndex}`) {
        console.log('Creating project nodes for focused experience:', `${item.type}-${nodeIndex}`); // Debug log
        const experienceProjects = (item.data as any).projects;
        
        // Define constants for project positioning (matching the getTimelinePosition function)
        const timelineNodeSpacing = 500; // Horizontal spacing between primary nodes
        const timelineStartX = 200; // Starting X position
        
        // Calculate project positions using the new secondary timeline system
        const projectPositions = calculateProjectPositions(
          experienceProjects, 
          position, 
          timelineStartX, 
          timelineNodeSpacing
        );
        
        projectPositions.forEach((projectInfo, projectIndex) => {
          const { project, position: projectPosition, level } = projectInfo;
          const projectStartDate = project.start ? parse(project.start, 'MMM yyyy', new Date()) : undefined;
          const projectEndDate = project.end ? parse(project.end, 'MMM yyyy', new Date()) : undefined;
          const projectDateRange = formatDateRange(projectStartDate, projectEndDate);
          const projectDuration = calculateDuration(projectStartDate, projectEndDate);
          
          const projectNodeId = `focused-project-${nodeIndex}-${projectIndex}`;
          
          const projectMilestone: Node = {
            id: projectNodeId,
            type: 'milestone',
            position: projectPosition,
            data: {
              title: project.title || 'Project',
              type: 'project',
              date: projectDateRange,
              duration: projectDuration,
              description: project.description || `Project: ${project.title}`,
              skills: project.technologies || [],
              organization: extractStringValue((item.data as Experience).company),
              startDate: projectStartDate,
              endDate: projectEndDate,
              originalData: project,
              parentExperience: milestone.id,
              onNodeClick: handleNodeClick,
              onNodeDelete: handleNodeDelete,
              swimLane: 'project',
              isPrimaryTimeline: false,
              isOverlapping: level > 0, // Projects on higher levels are overlapping
              projectUpdates: project.updates || [],
              isFocusedProject: true, // Mark as focused view project
              projectLevel: level, // Track which level this project is on
            },
          };
          
          milestones.push(projectMilestone);
          
          // Create secondary timeline connections
          const projectsOnSameLevel = projectPositions.filter(p => p.level === level);
          const indexOnLevel = projectsOnSameLevel.findIndex(p => p.project === project);
          
          if (indexOnLevel === 0) {
            // First project on this level - connect from bottom of experience to top of project
            connections.push({
              id: `${milestone.id}-${projectNodeId}`,
              source: milestone.id,
              sourceHandle: 'bottom',
              target: projectNodeId,
              targetHandle: 'top',
              type: 'straight',
              style: {
                stroke: '#f59e0b',
                strokeWidth: 3,
                strokeDasharray: '8,4',
              },
              className: 'experience-to-project-edge',
            });
          } else {
            // Not the first project - connect horizontally from previous project on same level
            const prevProjectOnLevel = projectsOnSameLevel[indexOnLevel - 1];
            const prevProjectId = `focused-project-${nodeIndex}-${projectPositions.indexOf(prevProjectOnLevel)}`;
            
            connections.push({
              id: `${prevProjectId}-${projectNodeId}`,
              source: prevProjectId,
              target: projectNodeId,
              type: 'straight',
              style: {
                stroke: '#10b981',
                strokeWidth: 2,
                strokeDasharray: '5,3',
              },
              className: 'project-timeline-edge',
            });
          }
        });
      }
      
      nodeIndex++;
    });

    // Separate primary and secondary timeline nodes
    const primaryTimelineNodes = milestones.filter(node =>
      isPrimaryTimelineNode((node.data as any).type) && node.position.y === PRIMARY_TIMELINE_Y
    ).sort((a, b) => a.position.x - b.position.x);

    const secondaryTimelineNodes = milestones.filter(node =>
      isPrimaryTimelineNode((node.data as any).type) && node.position.y === SECONDARY_TIMELINE_Y
    ).sort((a, b) => a.position.x - b.position.x);

    // Connect primary timeline nodes with solid line
    for (let i = 0; i < primaryTimelineNodes.length - 1; i++) {
      const currentNode = primaryTimelineNodes[i];
      const nextNode = primaryTimelineNodes[i + 1];

      const primaryEdge: Edge = {
        id: `primary-${currentNode.id}-${nextNode.id}`,
        source: currentNode.id,
        target: nextNode.id,
        type: 'straight',
        style: {
          stroke: '#4f46e5',
          strokeWidth: 4,
          zIndex: 10
        },
        className: 'primary-timeline-edge',
        zIndex: 10,
      };
      connections.push(primaryEdge);
    }

    // Connect secondary timeline nodes with dashed line
    for (let i = 0; i < secondaryTimelineNodes.length - 1; i++) {
      const currentNode = secondaryTimelineNodes[i];
      const nextNode = secondaryTimelineNodes[i + 1];

      const secondaryEdge: Edge = {
        id: `secondary-${currentNode.id}-${nextNode.id}`,
        source: currentNode.id,
        target: nextNode.id,
        type: 'straight',
        style: {
          stroke: '#8b5cf6',
          strokeWidth: 3,
          strokeDasharray: '8,4',
          zIndex: 9
        },
        className: 'secondary-timeline-edge',
        zIndex: 9,
      };
      connections.push(secondaryEdge);
    }

    // Create branch connections from primary nodes to overlapping/branch nodes
    const branchNodes = milestones.filter(node =>
      !isPrimaryTimelineNode((node.data as any).type) || node.position.y !== PRIMARY_TIMELINE_Y
    );

    branchNodes.forEach(branchNode => {
      // Find the primary timeline node that this branch should connect to
      // Use X position alignment to determine the connection
      let closestPrimaryNode = null;
      let minXDiff = Infinity;

      primaryTimelineNodes.forEach(primaryNode => {
        const xDiff = Math.abs(branchNode.position.x - primaryNode.position.x);

        // If nodes are aligned (same X position), prioritize this connection
        if (xDiff < minXDiff) {
          minXDiff = xDiff;
          closestPrimaryNode = primaryNode;
        }
      });

      // Create branch connection if we found an aligned primary node
      if (closestPrimaryNode && minXDiff < 100) { // Allow small tolerance for alignment
        const branchEdge: Edge = {
          id: `branch-${closestPrimaryNode.id}-${branchNode.id}`,
          source: closestPrimaryNode.id,
          target: branchNode.id,
          type: 'smoothstep',
          style: {
            stroke: '#6b7280',
            strokeWidth: 2,
            strokeDasharray: '5,5',
            zIndex: 5
          },
          className: 'branch-edge',
          zIndex: 5,
        };
        connections.push(branchEdge);
      }
    });

    setNodes(milestones as any);
    setEdges(connections as any);
  }, [profile, handleNodeClick, setNodes, setEdges, focusedExperience]);

  // Load saved projects and voice updates as sub-nodes
  useEffect(() => {
    if (savedProjects && Array.isArray(savedProjects) && savedProjects.length > 0 && nodes.length > 0) {
      savedProjects.forEach((savedItem: any) => {
        // Check if this is a voice update/sub-milestone
        if (savedItem.isSubMilestone && savedItem.parentId) {
          console.log('Loading saved milestone:', savedItem);
          // This is a voice update - ensure it's displayed
          const parentNode = nodes.find(node => node.id === savedItem.parentId);
          if (parentNode && !nodes.some(n => n.id === savedItem.id)) {
            console.log('Creating sub-milestone node from saved data for parent:', parentNode.id);

            // Count existing sub-milestones for this parent to position correctly
            const existingSubMilestones = nodes.filter(n =>
              n.data.isSubMilestone && n.data.parentId === savedItem.parentId
            );
            const totalSubCount = existingSubMilestones.length;

            // Recreate the sub-milestone node with smart positioning
            const branchYOffset = getBranchOffset(savedItem.type || 'project', totalSubCount);
            const subNode: Node = {
              id: savedItem.id,
              type: 'milestone',
              position: {
                x: parentNode.position.x + 250 + (totalSubCount * 200), // Horizontal branching
                y: parentNode.position.y + branchYOffset // Smart vertical positioning
              },
              data: {
                ...savedItem,
                onNodeClick: handleNodeClick,
                onNodeDelete: handleNodeDelete,
              },
            };

            console.log('Adding saved sub-milestone node:', subNode);
            setNodes((nds: Node[]) => [...nds, subNode]);

            // Create edge with smart styling
            const edgeStyle = getEdgeStyle(savedItem.type || 'project');
            const edge: Edge = {
              id: `e-${savedItem.parentId}-${savedItem.id}`,
              source: savedItem.parentId,
              target: savedItem.id,
              type: 'smoothstep',
              style: edgeStyle,
              className: `${savedItem.type || 'project'}-edge`,
            };

            console.log('Adding saved sub-milestone edge:', edge);
            setEdges((eds) => [...eds, edge]);
          } else {
            console.log('Parent node not found or milestone already exists for:', savedItem.parentId, 'existing nodes:', nodes.map(n => n.id));
          }
        } else {
          // Original project logic
          const parentNode = nodes.find(node =>
            savedItem.organization && (node.data as any).organization &&
            (node.data as any).organization.toLowerCase().includes(savedItem.organization.toLowerCase())
          ) || nodes[nodes.length - 1];

          if (parentNode && updateMilestone && !nodes.some(n => n.id === `project-${savedItem.id}`)) {
            updateMilestone(parentNode.id, `Added saved project: ${savedItem.title} - ${savedItem.description}`);
          }
        }
      });
    }
  }, [savedProjects, nodes, updateMilestone, handleNodeClick, setNodes, setEdges]);

  // Update existing nodes to include the click handler and highlighting when it changes
  useEffect(() => {
    setNodes((nds: Node[]) =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          onNodeClick: handleNodeClick,
          onNodeDelete: handleNodeDelete,
          isHighlighted: highlightedNodeId === node.id,
        },
        style: {
          ...node.style,
          ...(highlightedNodeId === node.id && {
            boxShadow: '0 0 20px rgba(168, 85, 247, 0.8)',
            transform: 'scale(1.05)',
            zIndex: 1000,
          })
        }
      }))
    );
  }, [handleNodeClick, handleNodeDelete, setNodes, highlightedNodeId]);



  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading your professional journey...</p>
        </div>
      </div>
    );
  }

  if (!profile || nodes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto">
            <ArrowRight className="h-8 w-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">No Journey Data</h2>
          <p className="text-purple-200">No professional experience or education data found.</p>
          <Button onClick={() => setLocation("/")} className="bg-purple-600 hover:bg-purple-700">
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 left-0 right-0 z-10 p-6"
      >
        <div className="glass rounded-2xl px-6 py-4 bg-slate-900/80 backdrop-blur-sm border border-purple-500/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Your Professional Journey
              </h1>
              <p className="text-purple-200">
                Interactive career path visualization powered by AI
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* <Button
                onClick={() => setIsSkillDashboardOpen(true)}
                variant="outline"
                size="sm"
                className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white"
              >
                <Brain className="w-4 h-4 mr-2" />
                Skills
              </Button> */}
              <Button
                onClick={async () => {
                  try {
                    await fetch('/api/logout', { method: 'POST' });
                    setLocation('/signin');
                  } catch (error) {
                    console.error('Logout failed:', error);
                  }
                }}
                variant="outline"
                size="sm"
                className="bg-slate-800/50 border-purple-500/30 text-purple-200 hover:bg-purple-500/20 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Focus Mode Exit Button */}
      {focusedExperience && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-24 right-6 z-20"
        >
          <Button
            onClick={() => {
              setFocusedExperience(null);
              // Reset zoom to show full timeline
              setTimeout(() => {
                reactFlowInstance.current?.fitView({
                  duration: 800,
                  padding: 0.2,
                });
              }, 100);
            }}
            variant="outline"
            size="sm"
            className="bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/40 hover:text-white backdrop-blur-sm"
          >
            <X className="w-4 h-4 mr-2" />
            Exit Focus Mode
          </Button>
        </motion.div>
      )}

      {/* Career Journey Visualization */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`w-full h-full pt-24 transition-all duration-300 ${
          isVoicePanelOpen && !isChatMinimized ? 'pr-96' : ''
        }`}
      >
        {/* Primary Timeline Background Indicator */}
        <div
          className="absolute z-0 bg-gradient-to-r from-indigo-500/30 via-blue-500/40 to-indigo-500/30 h-1 rounded-full"
          style={{
            top: `${PRIMARY_TIMELINE_Y + 120}px`, // Adjust for header offset and positioning
            left: '150px',
            right: '150px',
            boxShadow: '0 0 20px rgba(79, 70, 229, 0.5)',
            filter: 'blur(0.5px)'
          }}
        />

        {/* Secondary Timeline Background Indicator */}
        <div
          className="absolute z-0 bg-gradient-to-r from-purple-500/20 via-violet-500/30 to-purple-500/20 h-1 rounded-full"
          style={{
            top: `${SECONDARY_TIMELINE_Y + 120}px`, // Adjust for header offset and positioning
            left: '150px',
            right: '150px',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
            filter: 'blur(0.5px)'
          }}
        />
        <ReactFlow
          onInit={(instance) => { reactFlowInstance.current = instance; }}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          onPaneClick={() => {
            if (isVoicePanelOpen && !isChatMinimized) {
              setIsChatMinimized(true);
            }
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
            color="rgba(168, 85, 247, 0.2)"
          />
        </ReactFlow>
      </motion.div>

      {/* Overlay Chat */}
      <OverlayChat
        isOpen={isVoicePanelOpen}
        isMinimized={isChatMinimized}
        onClose={() => setIsVoicePanelOpen(false)}
        onMinimize={() => setIsChatMinimized(!isChatMinimized)}
        onOpen={() => {
          setIsChatMinimized(false);
          setIsVoicePanelOpen(true);
        }}
        onMilestoneAdded={addMilestone}
        onMilestoneUpdated={updateMilestone}
        onAddMilestone={addSubMilestone}
        onProfileUpdated={() => {
          // Refresh profile and project data when profile is updated
          queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        }}
        userId={user?.id || ''}
      />

      {/* Timeline Scrubber */}
      {/* <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40 w-96 max-w-[90vw]">
        <TimelineScrubber
          nodes={nodes}
          onTimelineNavigate={navigateToYear}
          className="transition-all duration-300"
        />
      </div> */}

      {/* Enhanced Floating Action Button with Chat Prompt */}
      <AnimatePresence>
        {!isVoicePanelOpen && (
          <div className="fixed bottom-4 left-4 z-50">
            {/* Chat Prompt Bubble */}
            {showChatPrompt && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.8 }}
                className="absolute bottom-16 left-0 w-64 bg-slate-800/95 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-4 shadow-2xl"
                style={{
                  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(168, 85, 247, 0.2)",
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <FaRobot className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-purple-100 text-sm leading-relaxed">
                      {user && !user.hasCompletedOnboarding
                        ? `Ready to start your journey! Click the microphone to begin onboarding.`
                        : `Welcome back${(profile as any)?.filteredData?.name ? `, ${(profile as any).filteredData.name}` : ''}! Good to see you again. Do you have time to talk about your current projects?`
                      }
                    </p>
                    <button
                      onClick={() => setShowChatPrompt(false)}
                      className="absolute top-2 right-2 w-4 h-4 text-purple-400 hover:text-white opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <FaTimes className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {/* Chat bubble arrow */}
                <div className="absolute bottom-[-8px] left-8 w-4 h-4 bg-slate-800/95 border-r border-b border-purple-500/30 transform rotate-45"></div>
              </motion.div>
            )}

            {/* Enhanced Glowing Chat Icon */}
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                boxShadow: showChatPrompt
                  ? ["0 0 20px rgba(168, 85, 247, 0.4)", "0 0 40px rgba(168, 85, 247, 0.8)", "0 0 20px rgba(168, 85, 247, 0.4)"]
                  : "0 8px 32px rgba(168, 85, 247, 0.4)"
              }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.1, boxShadow: "0 0 50px rgba(168, 85, 247, 0.8)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setShowChatPrompt(false);
                setIsVoicePanelOpen(true);
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: showChatPrompt ? Infinity : 0,
                  repeatType: "reverse"
                }
              }}
              className={`
                w-14 h-14 rounded-full
                bg-gradient-to-r from-purple-600 to-pink-600
                shadow-xl hover:shadow-2xl
                flex items-center justify-center
                transition-all duration-300 ease-in-out
                ${showChatPrompt ? 'animate-pulse' : ''}
              `}
            >
              <FaMicrophone className="w-5 h-5 text-white" />

              {/* Notification Dot for New Users */}
              {showChatPrompt && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-slate-900"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-full h-full bg-red-400 rounded-full"
                  />
                </motion.div>
              )}
            </motion.button>
          </div>
        )}
      </AnimatePresence>

      {/* Selected milestone details */}
      {selectedMilestone && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-24 right-6 w-80 bg-slate-900/90 backdrop-blur-sm rounded-2xl border border-purple-500/20 p-6"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white">{selectedMilestone.title}</h3>
              <p className="text-purple-200 text-sm">{selectedMilestone.organization}</p>
              <p className="text-purple-300 text-xs">{selectedMilestone.date}</p>
            </div>
            <div>
              <p className="text-purple-100 text-sm leading-relaxed">
                {selectedMilestone.description}
              </p>
            </div>
            {selectedMilestone.skills && selectedMilestone.skills.length > 0 && (
              <div>
                <p className="text-purple-200 text-xs mb-2">Skills:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedMilestone.skills.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-purple-500/20 text-purple-200 text-xs rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={() => setSelectedMilestone(null)}
              variant="outline"
              size="sm"
              className="w-full border-purple-500/30 text-purple-200 hover:bg-purple-500/20"
            >
              Close
            </Button>
          </div>
        </motion.div>
      )}

      {/* Skill Dashboard */}
      <SkillDashboard
        isOpen={isSkillDashboardOpen}
        onClose={() => setIsSkillDashboardOpen(false)}
        userId={user?.id || ''}
        careerGoal={user?.interest}
      />
    </div>
  );
}
