import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  ReactFlowInstance,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { message } from 'antd';
import { 
  LockOutlined, 
  UnlockOutlined, 
  AimOutlined, 
  ZoomInOutlined, 
  ZoomOutOutlined, 
  UndoOutlined, 
  RedoOutlined, 
  ReloadOutlined, 
  DownloadOutlined, 
  UploadOutlined 
} from '@ant-design/icons';

interface AgentCanvasProps {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  colorMode?: 'light' | 'dark';
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
}

interface AgentCanvasRef {
  getNodes: () => Node[];
  getEdges: () => Edge[];
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const AgentCanvas = React.forwardRef<AgentCanvasRef, AgentCanvasProps>(({
  initialNodes = [],
  initialEdges = [],
  colorMode = 'light',
  onNodeClick,
}, ref) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [zoom, setZoom] = useState(100);
  const [isLocked, setIsLocked] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const reactFlow = useReactFlow();

  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes);
      setHistory([{ nodes: initialNodes, edges: initialEdges }]);
      setHistoryIndex(0);
    }
  }, [initialNodes, initialEdges, setNodes]);

  useEffect(() => {
    if (initialEdges.length > 0) {
      setEdges(initialEdges);
    }
  }, [initialEdges, setEdges]);

  const updateZoom = useCallback(() => {
    if (reactFlowInstance) {
      const currentZoom = reactFlowInstance.getZoom();
      setZoom(Math.round(currentZoom * 100));
    }
  }, [reactFlowInstance]);

  useEffect(() => {
    if (reactFlowInstance) {
      updateZoom();
    }
  }, [reactFlowInstance, updateZoom]);

  const saveToHistory = useCallback(() => {
    const newState: HistoryState = { nodes, edges };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, edges, history, historyIndex]);

  React.useImperativeHandle(ref, () => ({
    getNodes: () => nodes,
    getEdges: () => edges,
  }));

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
        background: colorMode === 'dark' ? '#2a2a2a' : '#fff',
        border: `2px solid ${colorMode === 'dark' ? '#444' : '#d9d9d9'}`,
        fontWeight: 500,
        color: colorMode === 'dark' ? '#fff' : '#000'
      }}>
        {data.name || data.label || 'Node'}
      </div>
    ),
  };

  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) {
      message.warning('不能创建自连接');
      return;
    }
    saveToHistory();
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges, saveToHistory]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      onNodeClick(event, node);
    }
  }, [onNodeClick]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const dataStr = event.dataTransfer.getData('application/reactflow-data');
      const nodeData = dataStr ? JSON.parse(dataStr) : {};
      
      if (!type || !reactFlowWrapper.current) {
        return;
      }

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: event.clientX - bounds.left - 100,
        y: event.clientY - bounds.top - 50,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: type === 'Begin' ? 'beginNode' : type === 'Answer' ? 'answerNode' : type === 'Generate' ? 'generateNode' : 'ragNode',
        position,
        data: { ...nodeData, form: {} },
      };

      saveToHistory();
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, saveToHistory]
  );

  const handleExport = useCallback(() => {
    const data = {
      nodes,
      edges,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agent-flow-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success('导出成功');
  }, [nodes, edges]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.nodes && data.edges) {
            saveToHistory();
            setNodes(data.nodes);
            setEdges(data.edges);
            message.success('导入成功');
          } else {
            message.error('无效的文件格式');
          }
        } catch (error) {
          message.error('文件解析失败');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setNodes, setEdges, saveToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      const initialState = history[0];
      setNodes(initialState.nodes);
      setEdges(initialState.edges);
      setHistoryIndex(0);
      message.info('已重置到初始状态');
    }
  }, [history, setNodes, setEdges]);

  const handleZoomIn = useCallback(() => {
    reactFlow?.zoomTo(reactFlow?.getZoom() * 1.1, { duration: 100 });
    setTimeout(updateZoom, 120);
  }, [reactFlow, updateZoom]);

  const handleZoomOut = useCallback(() => {
    reactFlow?.zoomTo(reactFlow?.getZoom() / 1.1, { duration: 100 });
    setTimeout(updateZoom, 120);
  }, [reactFlow, updateZoom]);

  const handleFitView = useCallback(() => {
    reactFlow?.fitView({ duration: 150, padding: 0.2 });
    setTimeout(updateZoom, 180);
  }, [reactFlow, updateZoom]);

  const handleLock = useCallback(() => {
    setIsLocked(!isLocked);
  }, [isLocked]);

  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%', position: 'relative' }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          if (!isLocked) {
            saveToHistory();
          }
          onNodesChange(changes);
        }}
        onEdgesChange={(changes) => {
          if (!isLocked) {
            saveToHistory();
          }
          onEdgesChange(changes);
        }}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onInit={setReactFlowInstance}
        onMoveEnd={updateZoom}
        nodeTypes={nodeTypes}
        fitView
        attributionEnabled={false}
        deleteKeyCode={isLocked ? null : 'Delete'}
        multiSelectionKeyCode="Shift"
        snapToGrid={true}
        snapGrid={[3, 3]}
        colorMode={colorMode}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        panOnDrag={!isLocked}
        zoomOnScroll={!isLocked}
        zoomOnPinch={!isLocked}
        selectNodesOnDrag={!isLocked}
      >
        <MiniMap 
          position="bottom-right"
          pannable
          zoomable 
          style={{ marginBottom: 60, marginRight: 10 }}
          nodeColor={(node) => {
            if (node.type === 'beginNode') return '#52c41a';
            if (node.type === 'answerNode') return '#1890ff';
            if (node.type === 'generateNode') return '#722ed1';
            if (node.type === 'ragNode') return '#13c2c2';
            return colorMode === 'dark' ? '#555' : '#eee';
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
      </ReactFlow>
      
      <div style={{
        position: 'absolute',
        bottom: 30,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '0px',
        background: colorMode === 'dark' ? 'rgb(30, 41, 59)' : '#f5f5f5',
        padding: '4px',
        borderRadius: '5px',
        border: `1px solid ${colorMode === 'dark' ? '#3d3d3d' : '#e0e0e0'}`,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={handleLock}
          title={isLocked ? '解锁' : '锁定'}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: isLocked ? (colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8') : 'transparent',
            color: colorMode === 'dark' ? '#fff' : (isLocked ? '#333' : '#666'),
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            if (!isLocked) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
            }
          }}
        >
          {isLocked ? <LockOutlined /> : <UnlockOutlined />}
        </button>
        <button
          onClick={handleFitView}
          title="自适应"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colorMode === 'dark' ? '#fff' : '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
          }}
        >
          <AimOutlined />
        </button>
        <button
          onClick={handleZoomOut}
          title="缩小"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colorMode === 'dark' ? '#fff' : '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
          }}
        >
          <ZoomOutOutlined />
        </button>
        <div style={{ 
          padding: '0 8px', 
          fontSize: '12px', 
          color: colorMode === 'dark' ? '#fff' : '#555',
          fontWeight: 500,
          minWidth: '36px',
          textAlign: 'center'
        }}>
          {zoom}%
        </div>
        <button
          onClick={handleZoomIn}
          title="放大"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colorMode === 'dark' ? '#fff' : '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
          }}
        >
          <ZoomInOutlined />
        </button>
        <div style={{ width: '1px', height: '20px', background: colorMode === 'dark' ? '#444' : '#ddd', margin: '0 4px' }} />
        <button
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          title="撤销"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: historyIndex <= 0 ? (colorMode === 'dark' ? '#666' : '#ccc') : (colorMode === 'dark' ? '#fff' : '#666'),
            cursor: historyIndex <= 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            if (historyIndex > 0) {
              e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
            }
          }}
          onMouseLeave={(e) => {
            if (historyIndex > 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
            }
          }}
        >
          <UndoOutlined />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          title="重做"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: historyIndex >= history.length - 1 ? (colorMode === 'dark' ? '#666' : '#ccc') : (colorMode === 'dark' ? '#fff' : '#666'),
            cursor: historyIndex >= history.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            if (historyIndex < history.length - 1) {
              e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
            }
          }}
          onMouseLeave={(e) => {
            if (historyIndex < history.length - 1) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
            }
          }}
        >
          <RedoOutlined />
        </button>
        <button
          onClick={handleReset}
          disabled={historyIndex === 0}
          title="重置"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: historyIndex === 0 ? (colorMode === 'dark' ? '#666' : '#ccc') : (colorMode === 'dark' ? '#fff' : '#666'),
            cursor: historyIndex === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            if (historyIndex !== 0) {
              e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
            }
          }}
          onMouseLeave={(e) => {
            if (historyIndex !== 0) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
            }
          }}
        >
          <ReloadOutlined />
        </button>
        <div style={{ width: '1px', height: '20px', background: colorMode === 'dark' ? '#444' : '#ddd', margin: '0 4px' }} />
        <button
          onClick={handleExport}
          title="导出"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colorMode === 'dark' ? '#fff' : '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
          }}
        >
          <DownloadOutlined />
        </button>
        <button
          onClick={handleImport}
          title="导入"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: colorMode === 'dark' ? '#fff' : '#666',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            transition: 'all 0.2s'
          }}
          onFocus={(e) => { e.currentTarget.style.outline = 'none'; }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colorMode === 'dark' ? '#3d3d3d' : '#e8e8e8';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#333';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = colorMode === 'dark' ? '#fff' : '#666';
          }}
        >
          <UploadOutlined />
        </button>
      </div>
    </div>
  );
});

AgentCanvas.displayName = 'AgentCanvas';

export default AgentCanvas;