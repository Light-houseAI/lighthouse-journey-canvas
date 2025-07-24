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
import { motion } from 'framer-motion';
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import MilestoneNode from "@/components/MilestoneNode";

interface Experience {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  description?: string;
  location?: string;
}

interface Education {
  institution: string;
  degree: string;
  field?: string;
  startDate: string;
  endDate?: string;
  description?: string;
}

interface MilestoneData {
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["/api/profile"],
    enabled: !!user,
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback((milestoneData: any) => {
    setSelectedMilestone(milestoneData);
  }, []);

  useEffect(() => {
    if (!profile?.filteredData) return;

    const milestones: Node[] = [];
    const connections: Edge[] = [];
    
    const nodeSpacing = 300;
    const baseY = 300;
    let nodeIndex = 0;

    // Add education milestones
    if (profile.filteredData.education) {
      profile.filteredData.education.forEach((edu: Education) => {
        const milestone: Node = {
          id: `edu-${nodeIndex}`,
          type: 'milestone',
          position: { x: 200 + (nodeIndex * nodeSpacing), y: baseY },
          data: {
            title: edu.degree || 'Education',
            type: 'education',
            date: edu.startDate ? new Date(edu.startDate).getFullYear().toString() : 'Unknown',
            description: edu.description || `Studies at ${edu.institution}`,
            skills: [],
            organization: edu.institution,
            onNodeClick: handleNodeClick,
          },
        };
        milestones.push(milestone);
        nodeIndex++;
      });
    }

    // Add experience milestones
    if (profile.filteredData.experiences) {
      profile.filteredData.experiences.forEach((exp: Experience) => {
        const milestone: Node = {
          id: `exp-${nodeIndex}`,
          type: 'milestone',
          position: { x: 200 + (nodeIndex * nodeSpacing), y: baseY },
          data: {
            title: exp.position || 'Position',
            type: 'job',
            date: exp.startDate ? new Date(exp.startDate).getFullYear().toString() : 'Unknown',
            description: exp.description || `Working at ${exp.company}`,
            skills: [],
            organization: exp.company,
            onNodeClick: handleNodeClick,
          },
        };
        milestones.push(milestone);
        nodeIndex++;
      });
    }

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