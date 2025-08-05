import React, { useState } from 'react';
import { Timeline } from '../timeline/Timeline';

/**
 * Simple timeline debugger with hardcoded data to test dotted plus buttons
 */
export const TimelineDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Create simple test data
  const testNodes = [
    {
      id: 'test-work-1',
      type: 'workExperience',
      start: '2020-01',
      end: '2022-01',
      data: {
        title: 'Software Engineer',
        company: 'Test Company',
      },
    },
    {
      id: 'test-work-2', 
      type: 'workExperience',
      start: '2022-02',
      end: '2024-01',
      data: {
        title: 'Senior Engineer',
        company: 'Another Company',
      },
    },
  ];

  const testConfig = {
    startX: 300,
    startY: 400,
    horizontalSpacing: 500,
    verticalSpacing: 180,
    orientation: 'horizontal' as const,
    alignment: 'center' as const,
    onPlusButtonClick: (edgeData: any) => {
      console.log('Plus button clicked!', edgeData);
      alert(`Plus button clicked! Insertion point: ${edgeData.insertionPoint}`);
    },
  };

  const handleInit = (reactFlowInstance: any) => {
    console.log('ReactFlow instance:', reactFlowInstance);
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    
    console.log('Nodes:', nodes);
    console.log('Edges:', edges);
    
    setDebugInfo({
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.map((n: any) => ({ id: n.id, type: n.type, position: n.position })),
      edges: edges.map((e: any) => ({ id: e.id, type: e.type, source: e.source, target: e.target }))
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#f0f0f0' }}>
      <div style={{ padding: '20px', background: 'white', borderBottom: '1px solid #ccc' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>
          Timeline Debugger - Should show dotted plus buttons
        </h1>
        {debugInfo && (
          <div style={{ fontSize: '14px', fontFamily: 'monospace' }}>
            <p>Nodes: {debugInfo.nodeCount} | Edges: {debugInfo.edgeCount}</p>
            <details>
              <summary>Edge Details (click to expand)</summary>
              <pre style={{ fontSize: '12px', maxHeight: '100px', overflow: 'auto' }}>
                {JSON.stringify(debugInfo.edges, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
      <div style={{ width: '100%', height: 'calc(100vh - 120px)' }}>
        <Timeline
          nodes={testNodes}
          config={testConfig}
          expandedNodes={new Set()}
          onInit={handleInit}
        />
      </div>
    </div>
  );
};