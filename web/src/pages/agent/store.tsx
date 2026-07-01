import type {} from '@redux-devtools/extension';
import {
  Connection,
  Edge,
  EdgeChange,
  EdgeMouseHandler,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
  OnSelectionChangeFunc,
  OnSelectionChangeParams,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Node,
} from '@xyflow/react';
import { cloneDeep, omit } from 'lodash';
import differenceWith from 'lodash/differenceWith';
import intersectionWith from 'lodash/intersectionWith';
import lodashSet from 'lodash/set';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export type AgentNodeType = Node & {
  data: {
    label?: string;
    name?: string;
    form?: Record<string, any>;
    [key: string]: any;
  };
};

export type RFState = {
  nodes: AgentNodeType[];
  edges: Edge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  clickedNodeId: string;
  clickedEdgeId: string;
  isLocked: boolean;
  zoom: number;
  onNodesChange: OnNodesChange<AgentNodeType>;
  onEdgesChange: OnEdgesChange;
  onEdgeMouseEnter?: EdgeMouseHandler<Edge>;
  onEdgeMouseLeave?: EdgeMouseHandler<Edge>;
  onConnect: OnConnect;
  onSelectionChange: OnSelectionChangeFunc;
  setNodes: (nodes: AgentNodeType[]) => void;
  setEdges: (edges: Edge[]) => void;
  setEdgesByNodeId: (nodeId: string, edges: Edge[]) => void;
  updateNodeForm: (
    nodeId: string,
    values: any,
    path?: (string | number)[],
  ) => AgentNodeType[];
  replaceNodeForm: (nodeId: string, values: any) => void;
  addNode: (node: AgentNodeType) => void;
  getNode: (id?: string | null) => AgentNodeType | undefined;
  updateNode: (node: AgentNodeType) => void;
  addEdge: (connection: Connection) => void;
  getEdge: (id: string) => Edge | undefined;
  duplicateNode: (id: string, name: string) => void;
  deleteEdge: () => void;
  deleteEdgeById: (id: string) => void;
  deleteNodeById: (id: string) => void;
  findNodeByName: (name: string) => AgentNodeType | undefined;
  updateMutableNodeFormItem: (id: string, field: string, value: any) => void;
  getOperatorTypeFromId: (id?: string | null) => string | undefined;
  getParentIdById: (id?: string | null) => string | undefined;
  updateNodeName: (id: string, name: string) => void;
  generateNodeName: (name: string) => string;
  setClickedNodeId: (id?: string) => void;
  setClickedEdgeId: (id?: string) => void;
  findUpstreamNodeById: (id?: string | null) => AgentNodeType | undefined;
  findDownstreamNodesById: (id?: string | null) => AgentNodeType[];
  deleteEdgesBySourceAndSourceHandle: (
    source: string,
    sourceHandle: string,
  ) => void;
  selectNodeIds: (nodeIds: string[]) => void;
  hasChildNode: (nodeId: string) => boolean;
  setLocked: (locked: boolean) => void;
  setZoom: (zoom: number) => void;
  getNodes: () => AgentNodeType[];
  getEdges: () => Edge[];
  clearSelection: () => void;
  selectAll: () => void;
};

const isEdgeEqual = (a: Edge, b: Edge) => {
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.sourceHandle === b.sourceHandle &&
    a.targetHandle === b.targetHandle
  );
};

const generateNodeNamesWithIncreasingIndex = (
  name: string,
  nodes: AgentNodeType[],
): string => {
  const existingNames = nodes.map((n) => n.data.name || n.data.label);
  let index = 1;
  let newName = name;

  while (existingNames.includes(newName)) {
    newName = `${name}_${index}`;
    index++;
  }

  return newName;
};

const duplicateNodeForm = (data?: AgentNodeType['data']) => {
  if (!data) return { form: {} };
  return {
    ...data,
    form: cloneDeep(data.form || {}),
  };
};

const generateDuplicateNode = (
  position: { x: number; y: number } | undefined,
  operatorType?: string,
) => {
  const id = `${operatorType || 'node'}:${Math.random().toString(36).substring(2, 12)}`;
  return {
    id,
    position: position
      ? { x: position.x + 50, y: position.y + 50 }
      : { x: 100, y: 100 },
    selected: false,
  };
};

const useGraphStore = create<RFState>()(
  devtools(
    immer((set, get) => ({
      nodes: [] as AgentNodeType[],
      edges: [] as Edge[],
      selectedNodeIds: [] as string[],
      selectedEdgeIds: [] as string[],
      clickedNodeId: '',
      clickedEdgeId: '',
      isLocked: false,
      zoom: 100,

      onNodesChange: (changes) => {
        set({
          nodes: applyNodeChanges(
            changes,
            cloneDeep(get().nodes) as AgentNodeType[],
          ),
        });
      },

      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },

      onEdgeMouseEnter: (event, edge) => {
        const { edges, setEdges } = get();
        const edgeId = edge.id;
        setEdges(
          edges.map((e) => ({
            ...e,
            data: {
              ...e.data,
              isHovered: e.id === edgeId,
            },
          })),
        );
      },

      onEdgeMouseLeave: (event, edge) => {
        const { edges, setEdges } = get();
        const edgeId = edge.id;
        setEdges(
          edges.map((e) => ({
            ...e,
            data: {
              ...e.data,
              isHovered: false,
            },
          })),
        );
      },

      onConnect: (connection: Connection) => {
        if (connection.source === connection.target) {
          console.warn('不能创建自连接');
          return;
        }
        const newEdges = addEdge(
          { ...connection, type: 'buttonEdge' },
          get().edges,
        );
        set({
          edges: newEdges,
        });
      },

      onSelectionChange: ({ nodes, edges }: OnSelectionChangeParams) => {
        set({
          selectedEdgeIds: edges.map((x) => x.id),
          selectedNodeIds: nodes.map((x) => x.id),
        });
      },

      setNodes: (nodes: AgentNodeType[]) => {
        set({ nodes });
      },

      setEdges: (edges: Edge[]) => {
        set({ edges });
      },

      setEdgesByNodeId: (nodeId: string, currentDownstreamEdges: Edge[]) => {
        const { edges, setEdges } = get();
        const previousDownstreamEdges = edges.filter(
          (x) => x.source === nodeId,
        );
        const isDifferent =
          previousDownstreamEdges.length !== currentDownstreamEdges.length ||
          !previousDownstreamEdges.every((x) =>
            currentDownstreamEdges.some(
              (y) =>
                y.source === x.source &&
                y.target === x.target &&
                y.sourceHandle === x.sourceHandle,
            ),
          ) ||
          !currentDownstreamEdges.every((x) =>
            previousDownstreamEdges.some(
              (y) =>
                y.source === x.source &&
                y.target === x.target &&
                y.sourceHandle === x.sourceHandle,
            ),
          );

        const intersectionDownstreamEdges = intersectionWith(
          previousDownstreamEdges,
          currentDownstreamEdges,
          isEdgeEqual,
        );
        if (isDifferent) {
          const irrelevantEdges = edges.filter((x) => x.source !== nodeId);
          const selfAddedDownstreamEdges = differenceWith(
            currentDownstreamEdges,
            intersectionDownstreamEdges,
            isEdgeEqual,
          );
          setEdges([
            ...irrelevantEdges,
            ...intersectionDownstreamEdges,
            ...selfAddedDownstreamEdges,
          ]);
        }
      },

      addNode: (node: AgentNodeType) => {
        set({ nodes: get().nodes.concat(node) });
      },

      updateNode: (node) => {
        const { nodes } = get();
        const nextNodes = nodes.map((x) => {
          if (x.id === node.id) {
            return node;
          }
          return x;
        });
        set({ nodes: nextNodes });
      },

      getNode: (id?: string | null) => {
        return get().nodes.find((x) => x.id === id);
      },

      getOperatorTypeFromId: (id?: string | null) => {
        return get().getNode(id)?.data?.label;
      },

      getParentIdById: (id?: string | null) => {
        return get().getNode(id)?.parentId;
      },

      addEdge: (connection: Connection) => {
        if (connection.source === connection.target) {
          console.warn('不能创建自连接');
          return;
        }
        set({
          edges: addEdge(
            { ...connection, type: 'buttonEdge' },
            get().edges,
          ),
        });
      },

      getEdge: (id: string) => {
        return get().edges.find((x) => x.id === id);
      },

      duplicateNode: (id: string, name: string) => {
        const { getNode, addNode, generateNodeName } = get();
        const node = getNode(id);

        addNode({
          ...(node || {}),
          data: {
            ...duplicateNodeForm(node?.data),
            name: generateNodeName(name),
          },
          ...generateDuplicateNode(node?.position, node?.data?.label),
        });
      },

      deleteEdge: () => {
        const { edges, selectedEdgeIds } = get();
        set({
          edges: edges.filter((edge) =>
            selectedEdgeIds.every((x) => x !== edge.id),
          ),
        });
      },

      deleteEdgeById: (id: string) => {
        const { edges } = get();
        set({
          edges: edges.filter((edge) => edge.id !== id),
        });
      },

      deleteNodeById: (id: string) => {
        const { nodes, edges } = get();
        set({
          nodes: nodes.filter((node) => node.id !== id),
          edges: edges
            .filter((edge) => edge.source !== id)
            .filter((edge) => edge.target !== id),
        });
      },

      findNodeByName: (name: string) => {
        return get().nodes.find(
          (x) => x.data.label === name || x.data.name === name,
        );
      },

      updateNodeForm: (
        nodeId: string,
        values: any,
        path: (string | number)[] = [],
      ) => {
        const nextNodes = get().nodes.map((node) => {
          if (node.id === nodeId) {
            let nextForm: Record<string, unknown> = { ...node.data.form };
            if (path.length === 0) {
              nextForm = Object.assign(nextForm, values);
            } else {
              lodashSet(nextForm, path, values);
            }
            return {
              ...node,
              data: {
                ...node.data,
                form: nextForm,
              },
            } as AgentNodeType;
          }

          return node;
        });
        set({
          nodes: nextNodes,
        });

        return nextNodes;
      },

      replaceNodeForm(nodeId, values) {
        if (nodeId) {
          set((state) => {
            for (const node of state.nodes) {
              if (node.id === nodeId) {
                node.data.form = cloneDeep(values);
                break;
              }
            }
          });
        }
      },

      updateMutableNodeFormItem: (id: string, field: string, value: any) => {
        const { nodes } = get();
        const idx = nodes.findIndex((x) => x.id === id);
        if (idx !== -1) {
          lodashSet(nodes, [idx, 'data', 'form', field], value);
        }
      },

      updateNodeName: (id, name) => {
        if (id) {
          set((state) => {
            for (const node of state.nodes) {
              if (node.id === id) {
                node.data.name = name;
                break;
              }
            }
          });
        }
      },

      setClickedNodeId: (id?: string) => {
        set({ clickedNodeId: id || '' });
      },

      setClickedEdgeId: (id?: string) => {
        set({ clickedEdgeId: id || '' });
      },

      generateNodeName: (name: string) => {
        const { nodes } = get();
        return generateNodeNamesWithIncreasingIndex(name, nodes);
      },

      findUpstreamNodeById: (id) => {
        const { edges, getNode } = get();
        const edge = edges.find((x) => x.target === id);
        return getNode(edge?.source);
      },

      findDownstreamNodesById: (id) => {
        const { edges, getNode } = get();
        const downstreamEdges = edges.filter((x) => x.source === id);
        return downstreamEdges
          .map((edge) => getNode(edge.target))
          .filter((node): node is AgentNodeType => node !== undefined);
      },

      deleteEdgesBySourceAndSourceHandle: (source, sourceHandle) => {
        const { edges, setEdges } = get();
        setEdges(
          edges.filter(
            (edge) =>
              !(edge.source === source && edge.sourceHandle === sourceHandle),
          ),
        );
      },

      selectNodeIds: (nodeIds) => {
        const { nodes, setNodes } = get();
        setNodes(
          nodes.map((node) => ({
            ...node,
            selected: nodeIds.includes(node.id),
          })),
        );
      },

      hasChildNode: (nodeId) => {
        const { edges } = get();
        return edges.some((edge) => edge.source === nodeId);
      },

      setLocked: (locked: boolean) => {
        set({ isLocked: locked });
      },

      setZoom: (zoom: number) => {
        set({ zoom });
      },

      getNodes: () => get().nodes,

      getEdges: () => get().edges,

      clearSelection: () => {
        set({
          selectedNodeIds: [],
          selectedEdgeIds: [],
          nodes: get().nodes.map((node) => ({ ...node, selected: false })),
          edges: get().edges.map((edge) => ({ ...edge, selected: false })),
        });
      },

      selectAll: () => {
        const { nodes, edges } = get();
        set({
          selectedNodeIds: nodes.map((n) => n.id),
          selectedEdgeIds: edges.map((e) => e.id),
          nodes: nodes.map((node) => ({ ...node, selected: true })),
          edges: edges.map((edge) => ({ ...edge, selected: true })),
        });
      },
    })),
    { name: 'agent-graph', trace: true },
  ),
);

export default useGraphStore;
