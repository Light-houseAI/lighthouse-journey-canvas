/**
 * HierarchyNodePanel - Modern Side Panel for Node CRUD Operations
 *
 * Provides view, edit, create, and delete functionality for hierarchy nodes.
 * Uses modern 2024 design patterns with shadcn components and clean minimalist UI.
 */

import React, { useState, useEffect } from 'react';
import { useHierarchyStore } from '../../stores/hierarchy-store';
import { HierarchyNode, NodeMetadata } from '../../services/hierarchy-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ChevronDown, Edit3, Plus, Trash2, X, Calendar, MapPin, Briefcase, GraduationCap, Rocket, Zap, RefreshCw, FileText, Users, Eye, Save, RotateCcw } from 'lucide-react';

export const HierarchyNodePanel: React.FC = () => {
  const {
    selectedNodeId,
    panelMode,
    loading,

    // Data
    getNodeById,
    getChildren,
    hasChildren,
    isNodeExpanded,

    // Actions
    setPanelMode,
    hideSidePanel,
    updateNode,
    deleteNode,
    createNode,
    toggleNodeExpansion,
  } = useHierarchyStore();

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) : null;
  const [formData, setFormData] = useState<{
    label: string;
    meta: Partial<NodeMetadata>;
  }>({
    label: '',
    meta: {},
  });

  // Update form when selected node changes
  useEffect(() => {
    if (selectedNode) {
      setFormData({
        label: selectedNode.label,
        meta: { ...selectedNode.meta },
      });
    }
  }, [selectedNode]);

  if (!selectedNode) return null;

  const children = getChildren(selectedNode.id);
  const nodeHasChildren = hasChildren(selectedNode.id);
  const isExpanded = isNodeExpanded(selectedNode.id);

  // Handle form changes
  const handleFormChange = (field: string, value: any) => {
    if (field === 'label') {
      setFormData(prev => ({ ...prev, label: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        meta: { ...prev.meta, [field]: value }
      }));
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedNodeId) return;

    try {
      await updateNode(selectedNodeId, {
        label: formData.label,
        meta: formData.meta,
      });
      setPanelMode('view');
    } catch (error) {
      console.error('Failed to save node:', error);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedNodeId) return;

    try {
      await deleteNode(selectedNodeId);
      hideSidePanel();
    } catch (error) {
      console.error('Failed to delete node:', error);
    }
  };

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-white/95 backdrop-blur-sm border-l border-gray-200/60 shadow-2xl z-50 overflow-hidden">
      {/* Modern Glass Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              {getNodeIcon(selectedNode.type, 'text-white text-lg')}
            </div>
            <div>
              <h2 className="text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                {getModeTitle(panelMode)}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedNode.type.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={hideSidePanel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-120px)]">
        <div className="p-6 space-y-6">
          {/* View Mode */}
          {panelMode === 'view' && (
            <>
              {/* Node Overview Card */}
              <Card className="bg-gradient-to-br from-gray-50 to-white border-gray-200/60">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                        {selectedNode.label}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {selectedNode.type}
                        </Badge>
                        {selectedNode.meta.status && (
                          <Badge variant={getStatusVariant(selectedNode.meta.status)} className="text-xs">
                            {selectedNode.meta.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Description */}
                  {selectedNode.meta.description && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Description
                      </Label>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-lg">
                        {selectedNode.meta.description}
                      </p>
                    </div>
                  )}

                  {/* Timeline */}
                  {(selectedNode.meta.startDate || selectedNode.meta.endDate) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Timeline
                      </Label>
                      <div className="text-sm text-gray-600 bg-gray-50/50 p-3 rounded-lg">
                        {formatDateRange(selectedNode.meta.startDate, selectedNode.meta.endDate)}
                      </div>
                    </div>
                  )}

                  {/* Type-specific content */}
                  {renderTypeSpecificView(selectedNode)}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="space-y-2">
                <Button
                  onClick={() => setPanelMode('edit')}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Node
                </Button>


                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Node
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Node</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{selectedNode.label}"?
                        {nodeHasChildren && ` This will orphan ${children.length} child node(s).`}
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}

          {/* Edit Mode */}
          {panelMode === 'edit' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Edit Node</CardTitle>
                  <CardDescription>Update the node information and metadata</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Label */}
                  <div className="space-y-2">
                    <Label htmlFor="label">Node Label</Label>
                    <Input
                      id="label"
                      value={formData.label}
                      onChange={(e) => handleFormChange('label', e.target.value)}
                      placeholder="Enter node label"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.meta.description || ''}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                      placeholder="Add a description..."
                      rows={3}
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.meta.status || ''}
                      onValueChange={(value) => handleFormChange('status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Type-specific fields */}
                  {renderTypeSpecificEditFields(selectedNode.type, formData.meta, handleFormChange)}
                </CardContent>
              </Card>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  disabled={loading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  onClick={() => setPanelMode('view')}
                  variant="outline"
                  className="flex-1"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Create Mode */}
          {panelMode === 'create' && (
            <Card>
              <CardHeader>
                <CardTitle>Create Child Node</CardTitle>
                <CardDescription>
                  Add a new child node to "{selectedNode.label}"
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Plus className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Create child functionality coming soon...</p>
                  <Button
                    onClick={() => setPanelMode('view')}
                    variant="outline"
                    className="mt-4"
                  >
                    Back to View
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Helper functions with modern icons
function getNodeIcon(type: HierarchyNode['type'], className = ''): React.ReactNode {
  const icons: Record<HierarchyNode['type'], React.ReactNode> = {
    job: <Briefcase className={className || 'w-4 h-4'} />,
    education: <GraduationCap className={className || 'w-4 h-4'} />,
    project: <Rocket className={className || 'w-4 h-4'} />,
    event: <Calendar className={className || 'w-4 h-4'} />,
    action: <Zap className={className || 'w-4 h-4'} />,
    careerTransition: <RefreshCw className={className || 'w-4 h-4'} />,
  };
  return icons[type] || <FileText className={className || 'w-4 h-4'} />;
}

function getModeTitle(mode: string): string {
  const titles: Record<string, string> = {
    view: 'Node Details',
    edit: 'Edit Node',
    create: 'Create Child',
    move: 'Move Node',
  };
  return titles[mode] || 'Node Panel';
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return '';

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return date;
    }
  };

  if (startDate && endDate) {
    return `${formatDate(startDate)} → ${formatDate(endDate)}`;
  }
  return startDate ? formatDate(startDate) : formatDate(endDate!);
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: 'default',
    completed: 'secondary',
    planned: 'outline',
  };
  return variants[status] || 'outline';
}

function renderTypeSpecificView(node: HierarchyNode): React.ReactNode {
  const { meta } = node;

  switch (node.type) {
    case 'job':
      return (
        <>
          {(meta.company || meta.position) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Job Details
              </Label>
              <div className="bg-gray-50/50 p-3 rounded-lg space-y-1">
                {meta.company && <p className="text-sm text-gray-900 font-medium">{meta.company}</p>}
                {meta.position && <p className="text-sm text-gray-600">{meta.position}</p>}
              </div>
            </div>
          )}
        </>
      );

    case 'education':
      return (
        <>
          {(meta.school || meta.degree) && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Education Details
              </Label>
              <div className="bg-gray-50/50 p-3 rounded-lg space-y-1">
                {meta.school && <p className="text-sm text-gray-900 font-medium">{meta.school}</p>}
                {meta.degree && <p className="text-sm text-gray-600">{meta.degree}</p>}
              </div>
            </div>
          )}
        </>
      );

    case 'project':
      return (
        <>
          {meta.technologies && meta.technologies.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Rocket className="w-4 h-4" />
                Technologies
              </Label>
              <div className="flex flex-wrap gap-1">
                {meta.technologies.slice(0, 6).map((tech: string) => (
                  <Badge key={tech} variant="outline" className="text-xs">
                    {tech}
                  </Badge>
                ))}
                {meta.technologies.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{meta.technologies.length - 6} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </>
      );

    case 'event':
      return (
        <>
          {meta.location && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Location
              </Label>
              <div className="bg-gray-50/50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">{meta.location}</p>
              </div>
            </div>
          )}
        </>
      );

    case 'action':
      return (
        <>
          {meta.outcome && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Outcome
              </Label>
              <div className="bg-gray-50/50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">{meta.outcome}</p>
              </div>
            </div>
          )}
        </>
      );

    default:
      return null;
  }
}

function renderTypeSpecificEditFields(
  type: HierarchyNode['type'],
  meta: Partial<NodeMetadata>,
  onChange: (field: string, value: any) => void
): React.ReactNode {
  switch (type) {
    case 'job':
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={meta.company || ''}
              onChange={(e) => onChange('company', e.target.value)}
              placeholder="Company name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">Position</Label>
            <Input
              id="position"
              value={meta.position || ''}
              onChange={(e) => onChange('position', e.target.value)}
              placeholder="Job title or position"
            />
          </div>
        </>
      );

    case 'education':
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="school">School</Label>
            <Input
              id="school"
              value={meta.school || ''}
              onChange={(e) => onChange('school', e.target.value)}
              placeholder="School or institution name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="degree">Degree</Label>
            <Input
              id="degree"
              value={meta.degree || ''}
              onChange={(e) => onChange('degree', e.target.value)}
              placeholder="Degree or certification"
            />
          </div>
        </>
      );

    case 'project':
      return (
        <div className="space-y-2">
          <Label htmlFor="technologies">Technologies</Label>
          <Input
            id="technologies"
            value={(meta.technologies || []).join(', ')}
            onChange={(e) => onChange('technologies', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
            placeholder="React, TypeScript, Node.js (comma-separated)"
          />
        </div>
      );

    case 'event':
      return (
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={meta.location || ''}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="Event location"
          />
        </div>
      );

    case 'action':
      return (
        <div className="space-y-2">
          <Label htmlFor="outcome">Outcome</Label>
          <Textarea
            id="outcome"
            value={meta.outcome || ''}
            onChange={(e) => onChange('outcome', e.target.value)}
            placeholder="What was the result or outcome?"
            rows={2}
          />
        </div>
      );

    default:
      return null;
  }
}
