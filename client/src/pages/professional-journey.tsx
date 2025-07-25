import React, { useState, useEffect, useCallback } from "react";
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, LogOut } from "lucide-react";
import { FaMicrophone, FaTimes, FaRobot } from 'react-icons/fa';
import { useAuth } from "@/hooks/useAuth";
import MilestoneNode from "@/components/MilestoneNode";
import OverlayChat from "@/components/OverlayChat";

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

interface Experience {
  title?: string;
  company?: string;
  position?: string;
  start?: string;
  startDate?: string;
  end?: string;
  endDate?: string;
  description?: string;
  location?: string;
}

interface Education {
  school?: string;
  institution?: string;
  degree?: string;
  field?: string;
  start?: string;
  startDate?: string;
  end?: string;
  endDate?: string;
  description?: string;
}

interface MilestoneData {
  id: string;
  title: string;
  type: 'education' | 'job' | 'transition' | 'skill' | 'event' | 'project';
  date: string;
  description: string;
  skills: string[];
  organization?: string;
}

const nodeTypes = {
  milestone: MilestoneNode,
};

export default function ProfessionalJourney() {
  const [, setLocation] = useLocation();
  const [showChatPrompt, setShowChatPrompt] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [isChatMinimized, setIsChatMinimized] = useState(false);
  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);
  const [addingMilestoneFor, setAddingMilestoneFor] = useState<string | null>(null);

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

  const handleNodeClick = useCallback((milestoneData: any) => {
    setSelectedMilestone(milestoneData);
  }, []);

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

    // Save milestone to database
    try {
      await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ milestone }),
      });
      
      // Invalidate and refetch projects data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error('Failed to save milestone:', error);
    }
  }, [nodes, setNodes, setEdges, handleNodeClick]);

  const updateMilestone = useCallback((nodeId: string, update: string) => {
    setNodes((nds) =>
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
    
    // Find the parent node position
    const parentNode = nodes.find(node => node.id === parentNodeId);
    if (!parentNode) {
      console.log('Parent node not found:', parentNodeId);
      return;
    }

    // Count existing sub-milestones for this parent to position them sequentially
    const existingSubMilestones = nodes.filter(node => 
      node.data.isSubMilestone && 
      edges.some(edge => edge.source === parentNodeId && edge.target === node.id)
    );

    // Also count sub-milestones that are being added in the current batch
    const allSubMilestonesForParent = nodes.filter(node => 
      node.data.isSubMilestone && node.data.parentId === parentNodeId
    );

    console.log('Existing sub-milestones for parent:', existingSubMilestones.length);
    console.log('All sub-milestones for parent:', allSubMilestonesForParent.length);

    // Calculate hierarchical positioning based on milestone type
    let baseYOffset = 150;
    let spacingBetweenSubs = 120;
    let xPosition = parentNode.position.x;
    let yPosition = parentNode.position.y + baseYOffset;

    // Use the total count including nodes that might not have edges yet
    const totalSubCount = Math.max(existingSubMilestones.length, allSubMilestonesForParent.length);

    // If this is an update being added to a project, position it differently
    if (subMilestone.type === 'update' && parentNode.data.type === 'project') {
      // Position updates horizontally next to the project
      const projectUpdates = allSubMilestonesForParent.filter(node => node.data.type === 'update');
      xPosition = parentNode.position.x + 200 + (projectUpdates.length * 150);
      yPosition = parentNode.position.y;
      spacingBetweenSubs = 150;
    } else if (subMilestone.type === 'project') {
      // Position projects below the main job/education node with proper spacing
      yPosition = parentNode.position.y + baseYOffset + (totalSubCount * spacingBetweenSubs);
      xPosition = parentNode.position.x + (totalSubCount * 40) - 20; // Reduced horizontal offset
    } else {
      // Default positioning for other types
      yPosition = parentNode.position.y + baseYOffset + (totalSubCount * spacingBetweenSubs);
      xPosition = parentNode.position.x + (totalSubCount * 40) - 20;
    }

    // Create a sub-milestone node positioned based on type
    const subNode: Node = {
      id: `sub-${subMilestone.id || Date.now()}-${Math.random()}`,
      type: 'milestone',
      position: {
        x: xPosition,
        y: yPosition
      },
      data: {
        ...subMilestone,
        title: subMilestone.title,
        type: subMilestone.type || 'project',
        isSubMilestone: true,
        parentId: parentNodeId,
        onNodeClick: handleNodeClick,
      },
    };

    setNodes((nds) => [...nds, subNode]);

    // Create connection from parent to sub-milestone
    const edgeStyle = subMilestone.type === 'update' 
      ? { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '3,3' } // Green for updates
      : { stroke: '#fbbf24', strokeWidth: 2, strokeDasharray: '5,5' }; // Yellow for projects

    const newEdge: Edge = {
      id: `e${parentNodeId}-${subNode.id}`,
      source: parentNodeId,
      target: subNode.id,
      type: 'smoothstep',
      style: edgeStyle,
      className: 'sub-milestone-edge',
    };

    setEdges((eds) => [...eds, newEdge]);

    // Update parent node to indicate it has sub-milestones
    setNodes((nds) =>
      nds.map(node => {
        if (node.id === parentNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              hasSubMilestones: true,
              isUpdated: true,
            }
          };
        }
        return node;
      })
    );

    // Save sub-milestone to database
    try {
      const milestoneToSave = {
        ...subMilestone,
        id: subNode.id,
        parentId: parentNodeId,
        isSubMilestone: true
      };
      
      await fetch('/api/save-milestone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ milestone: milestoneToSave }),
      });
      
      // Invalidate and refetch projects data
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    } catch (error) {
      console.error('Failed to save sub-milestone:', error);
    }
  }, [nodes, setNodes, setEdges, handleNodeClick, queryClient]);

  // Handle adding new sub-milestone
  const handleAddSubMilestone = useCallback((parentNodeId: string) => {
    console.log('handleAddSubMilestone called with parentNodeId:', parentNodeId);
    setAddingMilestoneFor(parentNodeId);
    setIsChatMinimized(false);
    setIsVoicePanelOpen(true);
    
    // Find the parent node for context
    console.log('Looking for parentNodeId:', parentNodeId, 'in nodes with IDs:', nodes.map(n => n.id));
    const parentNode = nodes.find(node => node.id === parentNodeId);
    console.log('Found parent node:', parentNode);
    if (parentNode) {
      // Send a message to the chat to start gathering details
      setTimeout(() => {
        // This will trigger the chat to start asking for milestone details
        const chatEvent = new CustomEvent('addMilestone', { 
          detail: { 
            parentNodeId, 
            parentTitle: parentNode.data.title,
            parentType: parentNode.data.type,
            parentOrganization: parentNode.data.organization
          } 
        });
        console.log('Dispatching addMilestone event with detail:', chatEvent.detail);
        window.dispatchEvent(chatEvent);
      }, 500);
    } else {
      console.log('Parent node not found for parentNodeId:', parentNodeId);
    }
  }, [nodes, setIsVoicePanelOpen, setIsChatMinimized]);

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
    setNodes((nds) => nds.filter(node => node.id !== nodeId));
    
    // Invalidate and refetch projects data
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  }, [edges, setNodes, setEdges, queryClient]);

  // Auto-start onboarding chat when profile loads (only if not completed)
  useEffect(() => {
    if (profile && !isLoading && !hasStartedOnboarding) {
      const hasCompletedOnboarding = profile.user?.hasCompletedOnboarding;
      
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
    if (!profile?.filteredData) return;

    const milestones: Node[] = [];
    const connections: Edge[] = [];
    
    const nodeSpacing = 300;
    const baseY = 300;
    let nodeIndex = 0;

    // Combine and sort all timeline items by date
    const allItems: Array<{type: 'education' | 'experience', data: Education | Experience, sortDate: Date}> = [];

    // Add education items (only if they have dates)
    if (profile.filteredData.education) {
      profile.filteredData.education.forEach((edu: Education) => {
        const hasDate = edu.start || edu.startDate;
        if (hasDate) {
          allItems.push({
            type: 'education',
            data: edu,
            sortDate: edu.start ? new Date(edu.start) : new Date(edu.startDate!)
          });
        }
      });
    }

    // Add experience items (only if they have dates)
    if (profile.filteredData.experiences) {
      profile.filteredData.experiences.forEach((exp: Experience) => {
        const hasDate = exp.start || exp.startDate;
        if (hasDate) {
          allItems.push({
            type: 'experience',
            data: exp,
            sortDate: exp.start ? new Date(exp.start) : new Date(exp.startDate!)
          });
        }
      });
    }

    // Sort by date (oldest first for chronological order)
    allItems.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    // Create milestones from sorted items
    allItems.forEach((item) => {
      const milestone: Node = {
        id: `${item.type}-${nodeIndex}`,
        type: 'milestone',
        position: { x: 200 + (nodeIndex * nodeSpacing), y: baseY },
        data: {
          title: item.type === 'education' 
            ? 'Student'
            : extractStringValue((item.data as Experience).title) || 
              extractStringValue((item.data as Experience).position) || 'Role',
          type: item.type === 'education' ? 'education' : 'job',
          date: (item.data.start || item.data.startDate) 
            ? new Date(item.data.start || item.data.startDate!).getFullYear().toString() 
            : new Date().getFullYear().toString(),
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
          originalData: item.data, // Store original data for voice updates
          onNodeClick: handleNodeClick,
          onNodeDelete: handleNodeDelete,
          onAddSubMilestone: () => handleAddSubMilestone(milestone.id),
        },
      };
      milestones.push(milestone);
      nodeIndex++;
    });

    // Create connections between consecutive nodes
    for (let i = 0; i < milestones.length - 1; i++) {
      const edge: Edge = {
        id: `e${milestones[i].id}-${milestones[i + 1].id}`,
        source: milestones[i].id,
        target: milestones[i + 1].id,
        type: 'straight',
        style: { stroke: 'rgba(255, 255, 255, 0.3)', strokeWidth: 2 },
        className: 'career-path-edge',
      };
      connections.push(edge);
    }

    setNodes(milestones);
    setEdges(connections);
  }, [profile, handleNodeClick, setNodes, setEdges]);

  // Load saved projects and voice updates as sub-nodes
  useEffect(() => {
    if (savedProjects && savedProjects.length > 0 && nodes.length > 0) {
      savedProjects.forEach((savedItem: any) => {
        // Check if this is a voice update/sub-milestone
        if (savedItem.isSubMilestone && savedItem.parentId) {
          // This is a voice update - ensure it's displayed
          const parentNode = nodes.find(node => node.id === savedItem.parentId);
          if (parentNode && !nodes.some(n => n.id === savedItem.id)) {
            // Recreate the sub-milestone node
            const subNode: Node = {
              id: savedItem.id,
              type: 'milestone',
              position: {
                x: parentNode.position.x + 50,
                y: parentNode.position.y + 150 + (Math.random() * 100)
              },
              data: {
                ...savedItem,
                onNodeClick: handleNodeClick,
                onNodeDelete: handleNodeDelete,
              },
            };
            
            setNodes((nds) => [...nds, subNode]);
            
            // Create edge
            const edge: Edge = {
              id: `e-${savedItem.parentId}-${savedItem.id}`,
              source: savedItem.parentId,
              target: savedItem.id,
              type: 'smoothstep',
              style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '3,3' },
            };
            
            setEdges((eds) => [...eds, edge]);
          }
        } else {
          // Original project logic
          const parentNode = nodes.find(node => 
            savedItem.organization && node.data.organization && 
            node.data.organization.toLowerCase().includes(savedItem.organization.toLowerCase())
          ) || nodes[nodes.length - 1];

          if (parentNode && updateMilestone && !nodes.some(n => n.id === `project-${savedItem.id}`)) {
            updateMilestone(parentNode.id, `Added saved project: ${savedItem.title} - ${savedItem.description}`);
          }
        }
      });
    }
  }, [savedProjects, nodes, updateMilestone, handleNodeClick, setNodes, setEdges]);

  // Update existing nodes to include the click handler when it changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          onNodeClick: handleNodeClick,
          onNodeDelete: handleNodeDelete
        }
      }))
    );
  }, [handleNodeClick, handleNodeDelete, setNodes]);



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
      </motion.div>

      {/* Career Journey Visualization */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className={`w-full h-full pt-24 transition-all duration-300 ${
          isVoicePanelOpen && !isChatMinimized ? 'pr-96' : ''
        }`}
      >
        <ReactFlow
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
        onMilestoneAdded={addMilestone}
        existingNodes={nodes}
        onMilestoneUpdated={updateMilestone}
        onSubMilestoneAdded={addSubMilestone}
        profileData={profile}
        userInterest={user?.interest}
        userData={user}
      />

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
                        : `Welcome back${profile?.filteredData?.name ? `, ${profile.filteredData.name}` : ''}! Good to see you again. Do you have time to talk about your current projects?`
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
    </div>
  );
}