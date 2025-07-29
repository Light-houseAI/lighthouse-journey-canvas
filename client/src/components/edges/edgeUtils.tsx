import React from 'react';

/**
 * Shared utilities for React Flow edge components
 */

export interface EdgeStyleConfig {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/**
 * Timeline edge styling - solid blue line for chronological connections
 */
export const TIMELINE_EDGE_STYLE: EdgeStyleConfig = {
  stroke: '#4f46e5', // Indigo-600
  strokeWidth: 3,
};

/**
 * Project edge styling - dotted green line for project connections
 */
export const PROJECT_EDGE_STYLE: EdgeStyleConfig = {
  stroke: '#10b981', // Emerald-500
  strokeWidth: 2,
  strokeDasharray: '5,5',
};

/**
 * Default edge styling
 */
export const DEFAULT_EDGE_STYLE: EdgeStyleConfig = {
  stroke: '#6b7280', // Gray-500
  strokeWidth: 1,
};

/**
 * Creates SVG path element with specified styling
 */
export const createStyledPath = (
  d: string,
  style: EdgeStyleConfig,
  id?: string
): JSX.Element => {
  return (
    <path
      id={id}
      d={d}
      fill="none"
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeDasharray={style.strokeDasharray}
      className="react-flow__edge-path"
    />
  );
};