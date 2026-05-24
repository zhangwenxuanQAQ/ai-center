import React, { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface AgentCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  onConnect: (params: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onDrop: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
}

const AgentCanvas: React.FC<AgentCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onEdgeClick,
  onDrop,
  onDragOver,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const nodeTypes: NodeTypes = {
    beginNode: ({ data }) => (
      <div style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#52c41a',
        color: '#fff',
        fontWeight: 500,
        border: '2px solid #389e0d'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>▶</span>
          <span>{data.name || 'Begin'}</span>
        </div>
      </div>
    ),
    answerNode: ({ data }) => (
      <div style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#1890ff',
        color: '#fff',
        fontWeight: 500,
        border: '2px solid #096dd9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💬</span>
          <span>{data.name || 'Answer'}</span>
        </div>
      </div>
    ),
    generateNode: ({ data }) => (
      <div style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#722ed1',
        color: '#fff',
        fontWeight: 500,
        border: '2px solid #531dab'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚡</span>
          <span>{data.name || 'Generate'}</span>
        </div>
      </div>
    ),
    ragNode: ({ data }) => (
      <div style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#13c2c2',
        color: '#fff',
        fontWeight: 500,
        border: '2px solid #08979c'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔍</span>
          <span>{data.name || 'Retrieval'}</span>
        </div>
      </div>
    ),
    default: ({ data }) => (
      <div style={{
        padding: '10px 20px',
        borderRadius: '8px',
        background: '#fff',
        border: '2px solid #d9d9d9',
        fontWeight: 500
      }}>
        {data.name || data.label || 'Node'}
      </div>
    ),
  };

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        snapToGrid={true}
        snapGrid={[15, 15]}
      >
        <Controls 
          position="bottom-left"
          style={{ marginBottom: 10, marginLeft: 10 }}
        />
        <MiniMap 
          position="bottom-right"
          style={{ marginBottom: 10, marginRight: 10 }}
          nodeColor={(node) => {
            if (node.type === 'beginNode') return '#52c41a';
            if (node.type === 'answerNode') return '#1890ff';
            if (node.type === 'generateNode') return '#722ed1';
            if (node.type === 'ragNode') return '#13c2c2';
            return '#eee';
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
      </ReactFlow>
    </div>
  );
};

export default AgentCanvas;
