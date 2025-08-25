import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Node } from '@xyflow/react';

interface TimelineScrubberProps {
  nodes: Node[];
  onTimelineNavigate: (year: number) => void;
  className?: string;
}

export default function TimelineScrubber({ nodes, onTimelineNavigate, className = '' }: TimelineScrubberProps) {
  const [timelineRange, setTimelineRange] = useState<{ start: number; end: number } | null>(null);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [viewportRange, setViewportRange] = useState<{ start: number; end: number } | null>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Extract years from nodes and calculate timeline range
  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    const years: number[] = [];
    
    nodes.forEach(node => {
      const nodeData = node.data;
      
      // Extract year from various date formats
      if (nodeData && typeof nodeData === 'object' && 'startDate' in nodeData && nodeData.startDate) {
        const startYear = new Date(nodeData.startDate as string).getFullYear();
        if (!isNaN(startYear)) years.push(startYear);
      }
      
      if (nodeData && typeof nodeData === 'object' && 'endDate' in nodeData && nodeData.endDate) {
        const endYear = new Date(nodeData.endDate as string).getFullYear();
        if (!isNaN(endYear)) years.push(endYear);
      }
      
      if (nodeData && typeof nodeData === 'object' && 'date' in nodeData && nodeData.date) {
        const year = parseInt(nodeData.date as string);
        if (!isNaN(year)) years.push(year);
      }
    });

    if (years.length > 0) {
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const currentYear = new Date().getFullYear();
      
      setTimelineRange({
        start: Math.min(minYear, currentYear - 10),
        end: Math.max(maxYear, currentYear)
      });
    }
  }, [nodes]);

  // Generate year markers
  const getYearMarkers = useCallback(() => {
    if (!timelineRange) return [];
    
    const markers = [];
    const totalYears = timelineRange.end - timelineRange.start;
    const step = totalYears > 20 ? 5 : totalYears > 10 ? 2 : 1;
    
    for (let year = timelineRange.start; year <= timelineRange.end; year += step) {
      markers.push(year);
    }
    
    return markers;
  }, [timelineRange]);

  // Calculate year position as percentage
  const getYearPosition = useCallback((year: number) => {
    if (!timelineRange) return 0;
    const totalYears = timelineRange.end - timelineRange.start;
    return ((year - timelineRange.start) / totalYears) * 100;
  }, [timelineRange]);

  // Get nodes for a specific year
  const getNodesForYear = useCallback((year: number) => {
    return nodes.filter(node => {
      const nodeData = node.data;
      
      if (nodeData && typeof nodeData === 'object' && 'startDate' in nodeData && nodeData.startDate) {
        const startYear = new Date(nodeData.startDate as string).getFullYear();
        const endYear = nodeData && 'endDate' in nodeData && nodeData.endDate ? new Date(nodeData.endDate as string).getFullYear() : startYear;
        return year >= startYear && year <= endYear;
      }
      
      if (nodeData && typeof nodeData === 'object' && 'date' in nodeData && nodeData.date) {
        const nodeYear = parseInt(nodeData.date as string);
        return nodeYear === year;
      }
      
      return false;
    });
  }, [nodes]);

  // Handle scrubber interaction
  const handleScrubberClick = useCallback((event: React.MouseEvent) => {
    if (!scrubberRef.current || !timelineRange) return;
    
    const rect = scrubberRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    const year = Math.round(timelineRange.start + (percentage / 100) * (timelineRange.end - timelineRange.start));
    
    setActiveYear(year);
    onTimelineNavigate(year);
  }, [timelineRange, onTimelineNavigate]);

  // Handle drag for scrubber
  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    handleScrubberClick(event);
  }, [handleScrubberClick]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;
    handleScrubberClick(event);
  }, [isDragging, handleScrubberClick]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Update viewport indicator based on current view
  useEffect(() => {
    if (!timelineRange) return;
    
    // For now, show a 3-year viewport centered on active year
    const viewportWidth = 3;
    const centerYear = activeYear || new Date().getFullYear();
    const start = Math.max(centerYear - Math.floor(viewportWidth / 2), timelineRange.start);
    const end = Math.min(centerYear + Math.floor(viewportWidth / 2), timelineRange.end);
    
    setViewportRange({ start, end });
  }, [activeYear, timelineRange]);

  if (!timelineRange) return null;

  const yearMarkers = getYearMarkers();

  return (
    <div className={`timeline-scrubber ${className}`}>
      {/* Main Timeline Scrubber */}
      <div className="relative w-full h-16 bg-slate-900/90 backdrop-blur-sm border border-purple-500/30 rounded-lg p-3">
        {/* Timeline Track */}
        <div 
          ref={scrubberRef}
          className="relative w-full h-6 bg-slate-800 rounded-full cursor-pointer"
          onClick={handleScrubberClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Timeline Progress Bar */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/40 to-blue-600/40 rounded-full" />
          
          {/* Viewport Indicator */}
          {viewportRange && (
            <motion.div
              className="absolute top-0 h-full bg-purple-500/30 border-2 border-purple-400/60 rounded-full"
              style={{
                left: `${getYearPosition(viewportRange.start)}%`,
                width: `${getYearPosition(viewportRange.end) - getYearPosition(viewportRange.start)}%`,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
          
          {/* Year Markers */}
          {yearMarkers.map(year => {
            const position = getYearPosition(year);
            const nodesForYear = getNodesForYear(year);
            const hasActivity = nodesForYear.length > 0;
            
            return (
              <div
                key={year}
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${position}%` }}
              >
                {/* Activity Indicator */}
                <motion.div
                  className={`w-3 h-3 rounded-full border-2 ${
                    hasActivity
                      ? 'bg-purple-400 border-purple-300 shadow-lg shadow-purple-400/50'
                      : 'bg-slate-600 border-slate-500'
                  } ${
                    activeYear === year
                      ? 'ring-2 ring-purple-300 ring-offset-2 ring-offset-slate-900'
                      : ''
                  }`}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveYear(year);
                    onTimelineNavigate(year);
                  }}
                />
                
                {/* Year Label */}
                <div className={`absolute top-6 text-xs font-medium whitespace-nowrap ${
                  hasActivity ? 'text-purple-300' : 'text-slate-400'
                }`}>
                  {year}
                </div>
                
                {/* Activity Count Badge */}
                {hasActivity && (
                  <motion.div
                    className="absolute -top-2 -right-1 w-4 h-4 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    {nodesForYear.length}
                  </motion.div>
                )}
              </div>
            );
          })}
          
          {/* Current Year Indicator */}
          {activeYear && (
            <motion.div
              className="absolute top-1/2 w-4 h-4 bg-purple-500 border-2 border-white rounded-full transform -translate-y-1/2 -translate-x-1/2 shadow-lg"
              style={{ left: `${getYearPosition(activeYear)}%` }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
          )}
        </div>
        
        {/* Timeline Labels */}
        <div className="flex justify-between items-center mt-1 text-xs text-slate-400">
          <span>{timelineRange.start}</span>
          <span className="text-purple-300 font-medium">
            {activeYear ? `${activeYear}` : 'Timeline'}
          </span>
          <span>{timelineRange.end}</span>
        </div>
      </div>
      
      {/* Active Year Details */}
      {activeYear && (
        <motion.div
          className="mt-2 p-2 bg-slate-800/60 backdrop-blur-sm border border-purple-500/20 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="text-sm text-purple-300 font-medium">
            {activeYear} • {getNodesForYear(activeYear).length} milestone{getNodesForYear(activeYear).length !== 1 ? 's' : ''}
          </div>
          {getNodesForYear(activeYear).length > 0 && (
            <div className="text-xs text-slate-400 mt-1">
              {getNodesForYear(activeYear).map(node => node.data.title).slice(0, 2).join(', ')}
              {getNodesForYear(activeYear).length > 2 && ` +${getNodesForYear(activeYear).length - 2} more`}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}