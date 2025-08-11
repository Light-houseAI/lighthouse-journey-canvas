/**
 * NodeTypeRenderer - Meta-Field Driven Content Rendering
 * 
 * Handles type-specific content display based on the node's meta field.
 * This component eliminates the need for separate ActionNode, JobNode, etc.
 * components by rendering content dynamically based on node type and meta data.
 */

import React from 'react';
import { HierarchyNode } from '../../services/hierarchy-api';

export interface NodeTypeRendererProps {
  node: HierarchyNode;
  isCompact?: boolean;
  showDetails?: boolean;
}

export const NodeTypeRenderer: React.FC<NodeTypeRendererProps> = ({
  node,
  isCompact = false,
  showDetails = false,
}) => {
  const { meta } = node;
  // Get icon for node type
  const getNodeIcon = (type: HierarchyNode['type']): string => {
    const icons: Record<HierarchyNode['type'], string> = {
      job: '💼',
      education: '🎓',
      project: '🚀',
      event: '📅',
      action: '⚡',
      careerTransition: '🔄',
    };
    return node.meta.icon || icons[type] || '📋';
  };

  // Get color for node type (matches UnifiedNode)
  const getNodeColor = (type: HierarchyNode['type']): string => {
    const colors: Record<HierarchyNode['type'], string> = {
      job: '#3b82f6',
      education: '#10b981',
      project: '#8b5cf6',
      event: '#f59e0b',
      action: '#ef4444',
      careerTransition: '#6366f1',
    };
    return node.meta.color || colors[type] || '#6b7280';
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Get status badge styling
  const getStatusStyle = (status?: string): React.CSSProperties => {
    const statusColors: Record<string, string> = {
      active: '#10b981',
      completed: '#3b82f6',
      planned: '#f59e0b',
    };
    
    const color = statusColors[status || ''] || '#6b7280';
    
    return {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      background: `${color}20`,
      color: color,
      fontSize: '11px',
      fontWeight: '500',
      textTransform: 'capitalize',
    };
  };

  // Render type-specific content
  const renderTypeSpecificContent = (): React.ReactNode => {
    const { meta } = node;

    switch (node.type) {
      case 'job':
        return (
          <>
            {meta.company && (
              <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                at {meta.company}
              </div>
            )}
            {meta.position && !isCompact && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {meta.position}
              </div>
            )}
          </>
        );

      case 'education':
        return (
          <>
            {meta.school && (
              <div style={{ fontSize: '14px', color: '#374151', marginBottom: '4px' }}>
                at {meta.school}
              </div>
            )}
            {meta.degree && !isCompact && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {meta.degree}
              </div>
            )}
          </>
        );

      case 'project':
        return (
          <>
            {meta.technologies && meta.technologies.length > 0 && !isCompact && (
              <div style={{ marginTop: '8px' }}>
                {meta.technologies.slice(0, 3).map((tech: string) => (
                  <span
                    key={tech}
                    style={{
                      display: 'inline-block',
                      padding: '2px 6px',
                      margin: '0 4px 4px 0',
                      background: `${getNodeColor(node.type)}15`,
                      color: getNodeColor(node.type),
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: '500',
                    }}
                  >
                    {tech}
                  </span>
                ))}
                {meta.technologies.length > 3 && (
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>
                    +{meta.technologies.length - 3} more
                  </span>
                )}
              </div>
            )}
          </>
        );

      case 'event':
        return (
          <>
            {meta.location && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                📍 {meta.location}
              </div>
            )}
          </>
        );

      case 'action':
        return (
          <>
            {meta.outcome && showDetails && (
              <div style={{ fontSize: '12px', color: '#374151', marginTop: '8px' }}>
                → {meta.outcome}
              </div>
            )}
          </>
        );

      case 'careerTransition':
        return (
          <>
            {meta.description && showDetails && (
              <div style={{ fontSize: '12px', color: '#374151', marginTop: '8px', fontStyle: 'italic' }}>
                {meta.description}
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  // Main render
  return (
    <div className="node-type-renderer">
      {/* Header with icon and label */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px', marginRight: '8px' }}>
          {getNodeIcon(node.type)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '15px',
            fontWeight: '600',
            color: '#111827',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {node.meta.title}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#6b7280',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: '500',
          }}>
            {node.type.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </div>
        </div>
      </div>

      {/* Type-specific content */}
      {renderTypeSpecificContent()}

      {/* Date range */}
      {(meta.startDate || meta.endDate) && !isCompact && (
        <div style={{
          fontSize: '11px',
          color: '#6b7280',
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <span>📅</span>
          <span style={{ marginLeft: '4px' }}>
            {formatDate(meta.startDate)}
            {meta.startDate && meta.endDate && ' - '}
            {meta.endDate && meta.endDate !== meta.startDate && formatDate(meta.endDate)}
          </span>
        </div>
      )}

      {/* Status badge */}
      {meta.status && (
        <div style={{ marginTop: '8px' }}>
          <span style={getStatusStyle(meta.status)}>
            {meta.status}
          </span>
        </div>
      )}

      {/* Tags */}
      {meta.tags && meta.tags.length > 0 && showDetails && (
        <div style={{ marginTop: '8px' }}>
          {meta.tags.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                margin: '0 4px 4px 0',
                background: '#f3f4f6',
                color: '#374151',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '500',
              }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Description (only in detailed view) */}
      {meta.description && showDetails && node.type !== 'careerTransition' && (
        <div style={{
          fontSize: '12px',
          color: '#4b5563',
          marginTop: '8px',
          lineHeight: '1.4',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>
          {meta.description}
        </div>
      )}
    </div>
  );
};

export default NodeTypeRenderer;