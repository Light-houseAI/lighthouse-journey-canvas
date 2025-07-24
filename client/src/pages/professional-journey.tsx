import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { ArrowRight } from "lucide-react";
import { FaMicrophone, FaTimes } from 'react-icons/fa';
import { useAuth } from "@/hooks/useAuth";
import MilestoneNode from "@/components/MilestoneNode";
import VoiceChatPanel from "@/components/VoiceChatPanel";

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
  const { user } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedMilestone, setSelectedMilestone] = useState<any>(null);
  const [isVoicePanelOpen, setIsVoicePanelOpen] = useState(false);
  const [hasStartedOnboarding, setHasStartedOnboarding] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

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

  const addMilestone = useCallback((milestone: MilestoneData) => {
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

  const addSubMilestone = useCallback((parentNodeId: string, subMilestone: any) => {
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
  }, [nodes, setNodes, setEdges, handleNodeClick]);

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

  // Load saved projects and add as sub-nodes
  useEffect(() => {
    if (savedProjects && savedProjects.length > 0 && nodes.length > 0) {
      // Add saved projects as sub-milestones using updateMilestone
      savedProjects.forEach((project: any, index: number) => {
        // Find the parent node (most recent job or matching organization)
        const parentNode = nodes.find(node => 
          project.organization && node.data.organization && 
          node.data.organization.toLowerCase().includes(project.organization.toLowerCase())
        ) || nodes[nodes.length - 1]; // Default to most recent node

        if (parentNode && updateMilestone) {
          setTimeout(() => {
            // Create a sub-milestone for this saved project
            const subMilestone = {
              id: project.id,
              title: project.title,
              type: 'project' as const,
              date: project.date,
              description: project.description,
              skills: project.skills || [],
              organization: project.organization,
            };
            
            updateMilestone(parentNode.id, `Added saved project: ${project.title} - ${project.description}`);
          }, (index + 1) * 500); // Stagger the additions
        }
      });
    }
  }, [savedProjects, nodes, updateMilestone]);

  // Update existing nodes to include the click handler when it changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map(node => ({
        ...node,
        data: {
          ...node.data,
          onNodeClick: handleNodeClick
        }
      }))
    );
  }, [handleNodeClick, setNodes]);



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
              onClick={() => setLocation("/")}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Complete Setup <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
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
            color="rgba(168, 85, 247, 0.2)"
          />
        </ReactFlow>
      </motion.div>

      {/* Voice Chat Panel */}
      <VoiceChatPanel
        isOpen={isVoicePanelOpen}
        onClose={() => setIsVoicePanelOpen(false)}
        onMilestoneAdded={addMilestone}
        existingNodes={nodes}
        onMilestoneUpdated={updateMilestone}
        onSubMilestoneAdded={addSubMilestone}
        profileData={profile}
        userInterest={user?.interest}
      />

      {/* Floating Action Button - Only show when voice panel is closed */}
      <AnimatePresence>
        {!isVoicePanelOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1, boxShadow: "0 0 30px rgba(168, 85, 247, 0.6)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsVoicePanelOpen(true)}
            className="
              fixed bottom-4 left-4 z-50 w-14 h-14 rounded-full
              bg-gradient-to-r from-purple-600 to-pink-600
              shadow-xl hover:shadow-2xl
              flex items-center justify-center
              transition-all duration-300 ease-in-out
            "
            style={{
              boxShadow: "0 8px 32px rgba(168, 85, 247, 0.4)",
            }}
          >
            <FaMicrophone className="w-5 h-5 text-white" />
          </motion.button>
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