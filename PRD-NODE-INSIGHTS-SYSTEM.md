# PRD: Node Insights System with Magic UI Components

## 1. Overview

Implement a comprehensive CRUD system for insights on each node panel in the Journey Canvas application. Users can add, view, edit, and delete insights with rich descriptions and resource links. The system leverages Magic UI components for enhanced user experience with beautiful animations and interactions.

### Key Features
- **Simplified Resources**: String arrays without validation (URLs, notes, references, etc.)
- **Magic UI Integration**: Beautiful animations and interactions
- **CRUD Operations**: Create, Read, Update, Delete insights
- **Real-time Updates**: Optimistic UI with smooth transitions
- **Responsive Design**: Works on all devices

## 2. Database Schema

### Table: `node_insights`
```sql
CREATE TABLE node_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resources JSONB DEFAULT '[]'::jsonb, -- Array of URL strings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_node_insights_node_id ON node_insights(node_id);
CREATE INDEX idx_node_insights_created_at ON node_insights(created_at DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_node_insights_updated_at 
    BEFORE UPDATE ON node_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

### Resource Structure
```json
["https://example.com", "Additional notes about this experience", "Book: Clean Code by Robert Martin", "Mentorship session notes"]
```

## 3. Zod Schemas & Types

### File: `shared/schema.ts`
```typescript
// Node Insights table schema
export const nodeInsights = pgTable("node_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id").notNull().references(() => timelineNodes.id, { onDelete: 'cascade' }),
  description: text("description").notNull(),
  resources: json("resources").$type<string[]>().default([]), // Array of URL strings
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Validation schemas for insights
export const insightCreateSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000, "Description too long"),
  resources: z.array(z.string()).max(10, "Maximum 10 resources allowed").default([])
});

export const insightUpdateSchema = z.object({
  description: z.string().min(1, "Description is required").max(2000, "Description too long").optional(),
  resources: z.array(z.string()).max(10, "Maximum 10 resources allowed").optional()
});

// TypeScript types for insights
export type NodeInsight = typeof nodeInsights.$inferSelect;
export type InsightCreateDTO = z.infer<typeof insightCreateSchema>;
export type InsightUpdateDTO = z.infer<typeof insightUpdateSchema>;
```

## 4. API Implementation

### Routes: `server/hierarchy/api/routes.ts`
```typescript
// Add to existing routes
router.get('/nodes/:nodeId/insights', authMiddleware, hierarchyController.getNodeInsights.bind(hierarchyController));
router.post('/nodes/:nodeId/insights', authMiddleware, hierarchyController.createInsight.bind(hierarchyController));
router.put('/insights/:insightId', authMiddleware, hierarchyController.updateInsight.bind(hierarchyController));
router.delete('/insights/:insightId', authMiddleware, hierarchyController.deleteInsight.bind(hierarchyController));
```

### Controller: `server/hierarchy/api/hierarchy-controller.ts`
```typescript
import { insightCreateSchema, insightUpdateSchema, NodeInsight } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';

// Add these methods to HierarchyController class

async getNodeInsights(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const insights = await this.hierarchyService.getNodeInsights(nodeId, userId);
    
    res.json({
      success: true,
      data: insights.map(insight => ({
        ...insight,
        timeAgo: formatDistanceToNow(new Date(insight.createdAt), { addSuffix: true })
      })),
      meta: { 
        timestamp: new Date().toISOString(),
        count: insights.length
      }
    });
  } catch (error) {
    this.handleError(res, error, 'Failed to fetch insights');
  }
}

async createInsight(req: Request, res: Response): Promise<void> {
  try {
    const { nodeId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const validatedData = insightCreateSchema.parse(req.body);
    
    // Verify user owns the node
    const nodeExists = await this.hierarchyService.verifyNodeOwnership(nodeId, userId);
    if (!nodeExists) {
      res.status(404).json({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Node not found' }
      });
      return;
    }

    const insight = await this.hierarchyService.createInsight(nodeId, validatedData);
    
    res.status(201).json({
      success: true,
      data: {
        ...insight,
        timeAgo: 'just now'
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors
        }
      });
    } else {
      this.handleError(res, error, 'Failed to create insight');
    }
  }
}

async updateInsight(req: Request, res: Response): Promise<void> {
  try {
    const { insightId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const validatedData = insightUpdateSchema.parse(req.body);
    
    const insight = await this.hierarchyService.updateInsight(insightId, userId, validatedData);
    
    if (!insight) {
      res.status(404).json({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Insight not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        ...insight,
        timeAgo: formatDistanceToNow(new Date(insight.updatedAt), { addSuffix: true })
      },
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error.errors
        }
      });
    } else {
      this.handleError(res, error, 'Failed to update insight');
    }
  }
}

async deleteInsight(req: Request, res: Response): Promise<void> {
  try {
    const { insightId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ 
        success: false, 
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const deleted = await this.hierarchyService.deleteInsight(insightId, userId);
    
    if (!deleted) {
      res.status(404).json({ 
        success: false, 
        error: { code: 'NOT_FOUND', message: 'Insight not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: null,
      meta: { timestamp: new Date().toISOString() }
    });
  } catch (error) {
    this.handleError(res, error, 'Failed to delete insight');
  }
}
```

### Service: `server/hierarchy/services/hierarchy-service.ts`
```typescript
// Add these methods to HierarchyService class

async getNodeInsights(nodeId: string, userId: number): Promise<NodeInsight[]> {
  const node = await this.hierarchyRepository.findById(nodeId);
  if (!node || node.userId !== userId) {
    throw new Error('Node not found or access denied');
  }

  return await this.insightRepository.findByNodeId(nodeId);
}

async createInsight(nodeId: string, data: InsightCreateDTO): Promise<NodeInsight> {
  return await this.insightRepository.create({
    nodeId,
    ...data
  });
}

async updateInsight(insightId: string, userId: number, data: InsightUpdateDTO): Promise<NodeInsight | null> {
  const insight = await this.insightRepository.findById(insightId);
  if (!insight) return null;

  // Verify ownership through node
  const node = await this.hierarchyRepository.findById(insight.nodeId);
  if (!node || node.userId !== userId) {
    throw new Error('Access denied');
  }

  return await this.insightRepository.update(insightId, data);
}

async deleteInsight(insightId: string, userId: number): Promise<boolean> {
  const insight = await this.insightRepository.findById(insightId);
  if (!insight) return false;

  // Verify ownership through node
  const node = await this.hierarchyRepository.findById(insight.nodeId);
  if (!node || node.userId !== userId) {
    throw new Error('Access denied');
  }

  return await this.insightRepository.delete(insightId);
}

async verifyNodeOwnership(nodeId: string, userId: number): Promise<boolean> {
  const node = await this.hierarchyRepository.findById(nodeId);
  return !!(node && node.userId === userId);
}
```

### Repository: `server/hierarchy/infrastructure/insight-repository.ts`
```typescript
import { injectable } from 'tsyringe';
import { eq, desc } from 'drizzle-orm';
import { NodeInsight, InsightCreateDTO, InsightUpdateDTO, nodeInsights } from '@shared/schema';
import { db } from '../../db/connection';

@injectable()
export class InsightRepository {
  async findByNodeId(nodeId: string): Promise<NodeInsight[]> {
    return await db
      .select()
      .from(nodeInsights)
      .where(eq(nodeInsights.nodeId, nodeId))
      .orderBy(desc(nodeInsights.createdAt));
  }

  async findById(id: string): Promise<NodeInsight | null> {
    const results = await db
      .select()
      .from(nodeInsights)
      .where(eq(nodeInsights.id, id))
      .limit(1);
    
    return results[0] || null;
  }

  async create(data: InsightCreateDTO & { nodeId: string }): Promise<NodeInsight> {
    const results = await db
      .insert(nodeInsights)
      .values(data)
      .returning();
    
    return results[0];
  }

  async update(id: string, data: InsightUpdateDTO): Promise<NodeInsight | null> {
    const results = await db
      .update(nodeInsights)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(nodeInsights.id, id))
      .returning();
    
    return results[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const results = await db
      .delete(nodeInsights)
      .where(eq(nodeInsights.id, id))
      .returning();
    
    return results.length > 0;
  }
}
```

## 5. Frontend Store Integration

### File: `client/src/stores/hierarchy-store.ts`
```typescript
import { NodeInsight, InsightCreateDTO, InsightUpdateDTO } from '@shared/schema';
import { handleAPIError, showSuccessToast } from '@/utils/error-toast';

// Add to HierarchyStore interface
interface HierarchyStore {
  insights: Record<string, NodeInsight[]>; // nodeId -> insights
  insightLoading: Record<string, boolean>; // nodeId -> loading state
  
  // Insight methods
  getNodeInsights: (nodeId: string) => Promise<void>;
  createInsight: (nodeId: string, data: InsightCreateDTO) => Promise<void>;
  updateInsight: (insightId: string, nodeId: string, data: InsightUpdateDTO) => Promise<void>;
  deleteInsight: (insightId: string, nodeId: string) => Promise<void>;
  clearInsights: (nodeId: string) => void;
}

// Add to store implementation
insights: {},
insightLoading: {},

getNodeInsights: async (nodeId: string) => {
  set(state => ({ 
    insightLoading: { ...state.insightLoading, [nodeId]: true }
  }));

  try {
    const token = get().token;
    const response = await fetch(`/api/hierarchy/nodes/${nodeId}/insights`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      set(state => ({
        insights: { ...state.insights, [nodeId]: result.data },
        insightLoading: { ...state.insightLoading, [nodeId]: false }
      }));
    } else {
      throw new Error(result.error?.message || 'Failed to fetch insights');
    }
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    handleAPIError(error, 'Failed to load insights');
    set(state => ({ 
      insightLoading: { ...state.insightLoading, [nodeId]: false }
    }));
  }
},

createInsight: async (nodeId: string, data: InsightCreateDTO) => {
  try {
    const token = get().token;
    const response = await fetch(`/api/hierarchy/nodes/${nodeId}/insights`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      set(state => ({
        insights: {
          ...state.insights,
          [nodeId]: [...(state.insights[nodeId] || []), result.data]
        }
      }));
      showSuccessToast('Insight added successfully');
    } else {
      throw new Error(result.error?.message || 'Failed to create insight');
    }
  } catch (error) {
    handleAPIError(error, 'Failed to add insight');
    throw error;
  }
},

updateInsight: async (insightId: string, nodeId: string, data: InsightUpdateDTO) => {
  try {
    const token = get().token;
    const response = await fetch(`/api/hierarchy/insights/${insightId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      set(state => ({
        insights: {
          ...state.insights,
          [nodeId]: state.insights[nodeId]?.map(insight => 
            insight.id === insightId ? result.data : insight
          ) || []
        }
      }));
      showSuccessToast('Insight updated successfully');
    } else {
      throw new Error(result.error?.message || 'Failed to update insight');
    }
  } catch (error) {
    handleAPIError(error, 'Failed to update insight');
    throw error;
  }
},

deleteInsight: async (insightId: string, nodeId: string) => {
  try {
    const token = get().token;
    const response = await fetch(`/api/hierarchy/insights/${insightId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    
    if (result.success) {
      set(state => ({
        insights: {
          ...state.insights,
          [nodeId]: state.insights[nodeId]?.filter(insight => 
            insight.id !== insightId
          ) || []
        }
      }));
      showSuccessToast('Insight deleted successfully');
    } else {
      throw new Error(result.error?.message || 'Failed to delete insight');
    }
  } catch (error) {
    handleAPIError(error, 'Failed to delete insight');
    throw error;
  }
},

clearInsights: (nodeId: string) => {
  set(state => ({
    insights: { ...state.insights, [nodeId]: [] }
  }));
}
```

## 6. Magic UI Components Installation

### Required Components
```bash
# Install all required Magic UI components
npx shadcn@latest add "https://magicui.design/r/magic-card.json"
npx shadcn@latest add "https://magicui.design/r/shimmer-button.json"
npx shadcn@latest add "https://magicui.design/r/interactive-hover-button.json"
npx shadcn@latest add "https://magicui.design/r/animated-list.json"
npx shadcn@latest add "https://magicui.design/r/blur-fade.json"
npx shadcn@latest add "https://magicui.design/r/animated-subscribe-button.json"
npx shadcn@latest add "https://magicui.design/r/ripple-button.json"
```

## 7. UI Components Implementation

### File: `client/src/components/nodes/shared/InsightsSection.tsx`
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { InsightCard } from './InsightCard';
import { InsightForm } from './InsightForm';
import { ShimmerButton } from '../../ui/shimmer-button';
import { AnimatedList } from '../../ui/animated-list';
import { BlurFade } from '../../ui/blur-fade';
import { cn } from '../../../lib/utils';

interface InsightsSectionProps {
  nodeId: string;
  className?: string;
}

export const InsightsSection: React.FC<InsightsSectionProps> = ({ 
  nodeId, 
  className 
}) => {
  const { 
    insights, 
    insightLoading, 
    getNodeInsights 
  } = useHierarchyStore();
  
  const [showAddForm, setShowAddForm] = useState(false);
  
  const nodeInsights = insights[nodeId] || [];
  const isLoading = insightLoading[nodeId] || false;

  useEffect(() => {
    getNodeInsights(nodeId);
  }, [nodeId, getNodeInsights]);

  return (
    <div className={cn("mt-8 border-t border-gray-200 pt-6", className)}>
      <BlurFade delay={0.1} inView>
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-semibold text-gray-900">
            Insights
            {nodeInsights.length > 0 && (
              <span className="ml-2 text-sm text-gray-500 font-normal">
                ({nodeInsights.length})
              </span>
            )}
          </h4>
          
          <ShimmerButton
            onClick={() => setShowAddForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
            shimmerColor="#ffffff"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Insight
          </ShimmerButton>
        </div>
      </BlurFade>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading insights...</span>
        </div>
      ) : nodeInsights.length === 0 ? (
        <BlurFade delay={0.2} inView>
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <div className="text-gray-400 mb-2">💡</div>
            <p className="text-gray-500 mb-4">No insights yet. Share your learnings!</p>
            <ShimmerButton
              onClick={() => setShowAddForm(true)}
              size="sm"
              variant="outline"
            >
              Add Your First Insight
            </ShimmerButton>
          </div>
        </BlurFade>
      ) : (
        <AnimatedList className="space-y-4" delay={300}>
          {nodeInsights.map((insight, index) => (
            <InsightCard 
              key={insight.id} 
              insight={insight} 
              nodeId={nodeId}
              delay={index * 100}
            />
          ))}
        </AnimatedList>
      )}

      {showAddForm && (
        <InsightForm
          nodeId={nodeId}
          onClose={() => setShowAddForm(false)}
          onSuccess={() => setShowAddForm(false)}
        />
      )}
    </div>
  );
};
```

### File: `client/src/components/nodes/shared/InsightCard.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { MoreHorizontal, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NodeInsight } from '@shared/schema';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { InsightForm } from './InsightForm';
import { MagicCard } from '../../ui/magic-card';
import { InteractiveHoverButton } from '../../ui/interactive-hover-button';
import { BlurFade } from '../../ui/blur-fade';
import { Button } from '../../ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../ui/alert-dialog';

interface InsightCardProps {
  insight: NodeInsight;
  nodeId: string;
  delay?: number;
}

export const InsightCard: React.FC<InsightCardProps> = ({ 
  insight, 
  nodeId, 
  delay = 0 
}) => {
  const { deleteInsight } = useHierarchyStore();
  const [expanded, setExpanded] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteInsight(insight.id, nodeId);
    } catch (error) {
      console.error('Failed to delete insight:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const shouldTruncate = insight.description.length > 200;
  const displayText = expanded || !shouldTruncate 
    ? insight.description 
    : `${insight.description.substring(0, 200)}...`;

  return (
    <BlurFade delay={delay / 1000} inView>
      <MagicCard className="p-6 hover:shadow-lg transition-all duration-300">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white font-medium text-sm">ME</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <h5 className="font-semibold text-gray-900 mb-1">
                  Key Lessons from This Experience
                </h5>
                <p className="text-sm text-gray-500">
                  You • {insight.timeAgo || 'recently'}
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem 
                        className="text-red-600 focus:text-red-600"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Insight</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this insight? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Description */}
            <p className="text-gray-700 mb-4 leading-relaxed">
              {displayText}
            </p>

            {/* Expand/Collapse Button */}
            {shouldTruncate && !expanded && (
              <InteractiveHoverButton
                onClick={() => setExpanded(true)}
                className="mb-4 text-blue-600 text-sm"
              >
                Read more
              </InteractiveHoverButton>
            )}

            {/* Resources Section */}
            <AnimatePresence>
              {(expanded || !shouldTruncate) && insight.resources.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mb-4"
                >
                  <h6 className="font-medium text-gray-900 mb-2 text-sm">
                    Resources
                  </h6>
                  <div className="space-y-2">
                    {insight.resources.map((resource, index) => {
                      const isUrl = resource.startsWith('http://') || resource.startsWith('https://');
                      
                      return isUrl ? (
                        <a
                          key={index}
                          href={resource}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors text-sm"
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{resource}</span>
                        </a>
                      ) : (
                        <div key={index} className="flex items-center gap-2 text-gray-700 text-sm">
                          <div className="w-3 h-3 bg-gray-400 rounded-full flex-shrink-0" />
                          <span>{resource}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Show Less Button */}
            {expanded && shouldTruncate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(false)}
                className="text-gray-500 text-sm h-auto p-0"
              >
                Show less
              </Button>
            )}
          </div>
        </div>

        {/* Edit Form Modal */}
        {showEditForm && (
          <InsightForm
            nodeId={nodeId}
            insight={insight}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => setShowEditForm(false)}
          />
        )}
      </MagicCard>
    </BlurFade>
  );
};
```

### File: `client/src/components/nodes/shared/InsightForm.tsx`
```typescript
'use client';

import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { NodeInsight, insightCreateSchema, insightUpdateSchema } from '@shared/schema';
import { useHierarchyStore } from '../../../stores/hierarchy-store';
import { AnimatedSubscribeButton } from '../../ui/animated-subscribe-button';
import { RippleButton } from '../../ui/ripple-button';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { handleAPIError } from '../../../utils/error-toast';

interface InsightFormProps {
  nodeId: string;
  insight?: NodeInsight;
  onClose: () => void;
  onSuccess: () => void;
}

export const InsightForm: React.FC<InsightFormProps> = ({
  nodeId,
  insight,
  onClose,
  onSuccess
}) => {
  const { createInsight, updateInsight } = useHierarchyStore();
  const isEditing = Boolean(insight);

  const [formData, setFormData] = useState({
    description: insight?.description || '',
    resources: insight?.resources || []
  });

  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addResource = () => {
    const resourceText = newResourceUrl.trim();
    if (!resourceText) return;
    
    setFormData(prev => ({
      ...prev,
      resources: [...prev.resources, resourceText]
    }));
    setNewResourceUrl('');
    setErrors({ ...errors, newResource: '' });
  };

  const removeResource = (index: number) => {
    setFormData(prev => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validate form data
      const schema = isEditing ? insightUpdateSchema : insightCreateSchema;
      const validatedData = schema.parse(formData);

      if (isEditing && insight) {
        await updateInsight(insight.id, nodeId, validatedData);
      } else {
        await createInsight(nodeId, validatedData);
      }

      setSubmitted(true);
      
      // Show success state briefly before closing
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path.length > 0) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        handleAPIError(error, `Failed to ${isEditing ? 'update' : 'create'} insight`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Insight' : 'Add New Insight'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Share your insight *
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              placeholder="What did you learn from this experience? Share your key takeaways, lessons learned, or insights that could help others..."
              rows={6}
              className={`resize-none ${errors.description ? 'border-red-500' : ''}`}
              disabled={isSubmitting}
            />
            {errors.description && (
              <p className="text-sm text-red-600">{errors.description}</p>
            )}
            <p className="text-xs text-gray-500">
              {formData.description.length}/2000 characters
            </p>
          </div>

          {/* Resources Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Resources (Optional)</Label>
            
            {/* Existing Resources */}
            <AnimatePresence>
              {formData.resources.map((url, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{url}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeResource(index)}
                    className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                    disabled={isSubmitting}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Add New Resource */}
            {formData.resources.length < 10 && (
              <div className="space-y-3 p-4 border border-dashed border-gray-300 rounded-lg">
                <div className="flex gap-2">
                  <Input
                    value={newResourceUrl}
                    onChange={(e) => setNewResourceUrl(e.target.value)}
                    placeholder="URL, book reference, note, etc."
                    className="flex-1"
                    disabled={isSubmitting}
                  />
                  <RippleButton
                    type="button"
                    onClick={addResource}
                    disabled={!newResourceUrl.trim() || isSubmitting}
                  >
                    <Plus className="w-4 h-4" />
                  </RippleButton>
                </div>
                {errors.newResource && (
                  <p className="text-sm text-red-600">{errors.newResource}</p>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            
            <AnimatedSubscribeButton
              subscribeStatus={submitted}
              disabled={isSubmitting || !formData.description.trim()}
              className="min-w-[120px]"
            >
              <span>
                {isSubmitting 
                  ? (isEditing ? 'Updating...' : 'Saving...') 
                  : (isEditing ? 'Update' : 'Save Insight')
                }
              </span>
              <span>✓ {isEditing ? 'Updated!' : 'Saved!'}</span>
            </AnimatedSubscribeButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
```

## 8. Node Panel Integration

### Files to Modify
- `client/src/components/nodes/job/JobNodePanel.tsx`
- `client/src/components/nodes/education/EducationNodePanel.tsx`  
- `client/src/components/nodes/project/ProjectNodePanel.tsx`
- `client/src/components/nodes/event/EventNodePanel.tsx`
- `client/src/components/nodes/action/ActionNodePanel.tsx`
- `client/src/components/nodes/career-transition/CareerTransitionNodePanel.tsx`

### Changes for Each File

1. **Add import at the top:**
```typescript
import { InsightsSection } from '../shared/InsightsSection';
```

2. **Add component at the bottom of the view component:**
```typescript
{/* Add this right before the closing div of the main view component */}
<InsightsSection nodeId={node.id} />
```

## 9. Database Migration File

### File: `server/hierarchy/db/insights-migration.sql`
```sql
-- Create insights table
CREATE TABLE node_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES timeline_nodes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  resources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_node_insights_node_id ON node_insights(node_id);
CREATE INDEX idx_node_insights_created_at ON node_insights(created_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_node_insights_updated_at 
    BEFORE UPDATE ON node_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## 10. Implementation Checklist

### Phase 1: Backend Setup
- [ ] Add insights schema to `shared/schema.ts`
- [ ] Create insights repository
- [ ] Add insights methods to hierarchy service
- [ ] Add insights API endpoints to controller
- [ ] Add insights routes
- [ ] Run database migration

### Phase 2: Magic UI Setup
- [ ] Install Magic UI components via shadcn
- [ ] Test Magic UI components work correctly

### Phase 3: Frontend Components
- [ ] Create InsightsSection component
- [ ] Create InsightCard component
- [ ] Create InsightForm component
- [ ] Update hierarchy store with insights state

### Phase 4: Integration
- [ ] Add InsightsSection to all 6 node panels
- [ ] Test CRUD operations on each node type
- [ ] Test Magic UI animations and interactions

### Phase 5: Testing & Polish
- [ ] Add unit tests for components
- [ ] Add integration tests for API
- [ ] Test responsive design
- [ ] Test error handling
- [ ] Performance optimization

## 11. Success Metrics

### Technical Metrics
- **API Response Time**: < 200ms for insights operations
- **UI Responsiveness**: Smooth 60fps animations
- **Error Rate**: < 1% for insights CRUD operations
- **Mobile Compatibility**: Works on all devices

### User Experience Metrics
- **Time to Add Insight**: < 30 seconds
- **Animation Smoothness**: No janky transitions
- **Intuitive Interface**: Minimal learning curve
- **Visual Appeal**: Beautiful Magic UI effects

This comprehensive PRD provides all the necessary details to implement a robust, beautiful, and user-friendly insights system with Magic UI components and simplified URL-only resources.