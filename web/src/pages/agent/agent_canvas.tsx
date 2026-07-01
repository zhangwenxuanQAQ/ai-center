import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  MiniMap,
  Background,
  BackgroundVariant,
  NodeTypes,
  ReactFlowInstance,
  useReactFlow,
  ConnectionMode,
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
import ButtonEdge from './edge/button_edge';
import { BeginNode } from './node/begin_node';
import { RagNode } from './node/default_node';
import { GenerateNode } from './node/generate_node';
import { LogicNode } from './node/logic_node';
import { KeywordNode } from './node/keyword_node';
import { NoteNode } from './node/note_node';
import { MessageNode } from './node/message_node';
import { RetrievalNode } from './node/retrieval_node';
import { CategorizeNode } from './node/categorize_node';
import { RelevantNode } from './node/relevant_node';
import { RewriteNode } from './node/rewrite_node';
import { SwitchNode } from './node/switch_node';
import { InvokeNode } from './node/invoke_node';
import { TemplateNode } from './node/template_node';
import { IterationNode } from './node/iteration_node';
import { EmailNode } from './node/email_node';
import { IntentDetectionV2Node } from './node/intent_detection_v2_node';
import { GlobalMemoryNode } from './node/global_memory_node';
import useGraphStore, { AgentNodeType } from './store';

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

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const reactFlow = useReactFlow();

  const {
    nodes,
    edges,
    isLocked,
    zoom,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    addNode,
    setLocked,
    setZoom,
    getNodes,
    getEdges,
  } = useGraphStore();

  useEffect(() => {
    if (initialNodes.length > 0 || initialEdges.length > 0) {
      setNodes(initialNodes as AgentNodeType[]);
      setEdges(initialEdges);
      setHistory([{ nodes: initialNodes, edges: initialEdges }]);
      setHistoryIndex(0);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const updateZoom = useCallback(() => {
    if (reactFlowInstance) {
      const currentZoom = reactFlowInstance.getZoom();
      setZoom(Math.round(currentZoom * 100));
    }
  }, [reactFlowInstance, setZoom]);

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
    getNodes,
    getEdges,
  }));

  const nodeTypes: NodeTypes = {
    beginNode: BeginNode,
    answerNode: LogicNode,
    logicNode: LogicNode,
    generateNode: GenerateNode,
    ragNode: RagNode,
    keywordNode: KeywordNode,
    noteNode: NoteNode,
    messageNode: MessageNode,
    retrievalNode: RetrievalNode,
    categorizeNode: CategorizeNode,
    relevantNode: RelevantNode,
    rewriteNode: RewriteNode,
    switchNode: SwitchNode,
    invokeNode: InvokeNode,
    templateNode: TemplateNode,
    iterationNode: IterationNode,
    emailNode: EmailNode,
    intentDetectionV2Node: IntentDetectionV2Node,
    globalMemoryNode: GlobalMemoryNode,
    default: RagNode,
  };

  const edgeTypes = {
    buttonEdge: ButtonEdge,
    default: ButtonEdge,
  };

  const handleConnect = useCallback((params: any) => {
    if (params.source === params.target) {
      message.warning('不能创建自连接');
      return;
    }
    saveToHistory();
    onConnect(params);
  }, [onConnect, saveToHistory]);

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

      const getNodeType = (componentName: string): string => {
        const typeMap: Record<string, string> = {
          'Begin': 'beginNode',
          'Answer': 'answerNode',
          'Generate': 'generateNode',
          'KeywordExtract': 'keywordNode',
          'Note': 'noteNode',
          'Message': 'messageNode',
          'Retrieval': 'retrievalNode',
          'Categorize': 'categorizeNode',
          'Relevant': 'relevantNode',
          'Rewrite': 'rewriteNode',
          'Switch': 'switchNode',
          'Invoke': 'invokeNode',
          'Template': 'templateNode',
          'Iteration': 'iterationNode',
          'Email': 'emailNode',
          'IntentDetectionV2': 'intentDetectionV2Node',
          'GlobalMemory': 'globalMemoryNode',
        };
        
        if (typeMap[componentName]) {
          return typeMap[componentName];
        }
        
        const ragComponents = ['WenCai', 'AkShare', 'Baidu', 'DuckDuckGo', 'Tavily', 'QWeather', 'Crawler'];
        if (ragComponents.includes(componentName)) {
          return 'ragNode';
        }
        
        return 'default';
      };

      const newNode: AgentNodeType = {
        id: `${type}:${Math.random().toString(36).substring(2, 12)}`,
        type: getNodeType(type),
        position,
        data: { ...nodeData, label: type, form: {} },
      };

      saveToHistory();
      addNode(newNode);
    },
    [addNode, saveToHistory]
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
      setNodes(prevState.nodes as AgentNodeType[]);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes as AgentNodeType[]);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      const initialState = history[0];
      setNodes(initialState.nodes as AgentNodeType[]);
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
    setLocked(!isLocked);
  }, [isLocked, setLocked]);

  const handleNodesChange = useCallback((changes: any) => {
    if (!isLocked) {
      saveToHistory();
    }
    onNodesChange(changes);
  }, [isLocked, onNodesChange, saveToHistory]);

  const handleEdgesChange = useCallback((changes: any) => {
    if (!isLocked) {
      saveToHistory();
    }
    onEdgesChange(changes);
  }, [isLocked, onEdgesChange, saveToHistory]);

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
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onInit={setReactFlowInstance}
        onMoveEnd={updateZoom}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'buttonEdge',
          style: { stroke: colorMode === 'dark' ? '#888' : '#555', strokeWidth: 2 },
        }}
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
        connectionMode={ConnectionMode.Loose}
      >
        <MiniMap 
          position="bottom-right"
          pannable
          zoomable 
          style={{ marginBottom: 60, marginRight: 10 }}
          nodeColor={(node) => {
            if (node.type === 'beginNode') return '#52c41a';
            if (node.type === 'answerNode' || node.type === 'logicNode') return '#1890ff';
            if (node.type === 'generateNode') return '#722ed1';
            if (node.type === 'ragNode') return '#13c2c2';
            if (node.type === 'keywordNode') return '#fa8c16';
            if (node.type === 'noteNode') return colorMode === 'dark' ? '#444' : '#ddd';
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
