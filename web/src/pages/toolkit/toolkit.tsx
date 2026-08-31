import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, message, Popconfirm, Pagination, Upload, Tooltip, Drawer, Switch, Slider, InputNumber, Popover, Tag } from 'antd';
import type { UploadProps } from 'antd';
const { TextArea } = Input;
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, ApiOutlined, ApiTwoTone, UploadOutlined, ToolOutlined, ThunderboltOutlined, CodeOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ClockCircleOutlined, EyeOutlined, SettingOutlined, ClearOutlined, SendOutlined, StopOutlined, BulbOutlined, RightOutlined, PlayCircleOutlined, InfoCircleOutlined, ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import ChatMarkdown from '../../components/ChatMarkdown';
import { toolkitService, BuiltinTool, BuiltinToolParam } from '../../services/toolkit';
import { datasourceService, Datasource } from '../../services/datasource';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { mcpService, MCPServer, MCPCategory } from '../../services/mcp';
import ApiTool from './api_tool';
import SkillManagement from '../skill/skill';
import '../../styles/common.css';
import './toolkit.less';
import '../prompt/prompt_setting.less';
import { getDefaultAvatar } from '../../utils/avatar';
import JsonViewer from '../../components/JsonViewer';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

// 工具类型图标映射
const TOOL_TYPE_ICON: Record<string, React.ReactNode> = {
  mcp: <ApiOutlined />,
  api: <ThunderboltOutlined />,
  code_script: <CodeOutlined />,
  builtin_tool: <ToolOutlined />,
  skill: <ToolOutlined />,
};

// 工具调用步骤
interface ToolCallStep {
  tool_call_id: string;
  name: string;
  task_name?: string;
  status: 'start' | 'running' | 'success' | 'error';
  result?: any;
  message?: string;
  elapsed_ms?: number;
  reasoning_content?: string;
  parameters?: any;
}

// 工具类型颜色映射
const TOOL_TYPE_COLOR: Record<string, string> = {
  mcp: '#5a6fd6',
  api: '#52c41a',
  code_script: '#fa8c16',
  builtin_tool: '#eb2f96',
  skill: '#13c2c2',
};

const ToolkitManagement: React.FC = () => {
  const navigate = useNavigate();
  const [mcpCategories, setMcpCategories] = useState<MCPCategory[]>([]);
  const [selectedToolType, setSelectedToolType] = useState<string>('mcp');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // MCP服务相关状态
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [sourceTypes, setSourceTypes] = useState<Record<string, string>>({});
  const [transportTypes, setTransportTypes] = useState<Record<string, string>>({});
  const [searchName, setSearchName] = useState<string>('');
  const [filterSourceType, setFilterSourceType] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalServers, setTotalServers] = useState<number>(0);

  // 内置工具相关状态
  const [builtinTools, setBuiltinTools] = useState<BuiltinTool[]>([]);
  const [totalBuiltinTools, setTotalBuiltinTools] = useState<number>(0);
  const [builtinToolPage, setBuiltinToolPage] = useState<number>(1);
  const [builtinToolPageSize, setBuiltinToolPageSize] = useState<number>(12);
  const [builtinToolSearchName, setBuiltinToolSearchName] = useState<string>('');

  // 内置工具测试相关状态
  const [paramTestDrawerVisible, setParamTestDrawerVisible] = useState(false);
  const [modelTestDrawerVisible, setModelTestDrawerVisible] = useState(false);
  const [viewDrawerVisible, setViewDrawerVisible] = useState(false);
  const [currentTool, setCurrentTool] = useState<BuiltinTool | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [paramTestResult, setParamTestResult] = useState<{ status: 'success' | 'error'; result: any; message: string; error?: string } | null>(null);
  const [paramTesting, setParamTesting] = useState(false);

  // 数据抽取工具相关状态
  const [dsDatasources, setDsDatasources] = useState<Datasource[]>([]);
  const [dsTables, setDsTables] = useState<{ table_name: string; table_comment?: string }[]>([]);
  const [dsColumns, setDsColumns] = useState<{ column_name: string; data_type?: string }[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsLoadingTables, setDsLoadingTables] = useState(false);
  const [dsLoadingColumns, setDsLoadingColumns] = useState(false);

  // 模型测试相关状态
  const [models, setModels] = useState<LLMModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [configParams, setConfigParams] = useState<Record<string, any>>({});
  const [modelDropdownVisible, setModelDropdownVisible] = useState(false);
  const [testMessages, setTestMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; reasoning_content?: string; timestamp: Date; usage?: any; stopped?: boolean; tool_calls?: ToolCallStep[] }[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deepThinking, setDeepThinking] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [thinkingMessageId, setThinkingMessageId] = useState<string | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedToolCallResults, setExpandedToolCallResults] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [thinkingDuration, setThinkingDuration] = useState<Record<string, number>>({});
  const thinkingStartTimeRef = useRef<Record<string, number>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // MCP服务编辑相关状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('local');
  const [selectedEditSourceType, setSelectedEditSourceType] = useState<string>('local');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('streamable_http');
  const [selectedEditTransportType, setSelectedEditTransportType] = useState<string>('streamable_http');
  const [localMcpConfig, setLocalMcpConfig] = useState<{ host: string; port: number; transport_type: string }>({ host: '127.0.0.1', port: 8082, transport_type: 'streamable_http' });
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string>('');
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // 分类管理相关状态
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<MCPCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    fetchMcpCategories();
    fetchSourceTypes();
    fetchTransportTypes();
    fetchLocalMcpConfig();
  }, []);

  // 选中分类或搜索条件变化时重新获取MCP服务
  useEffect(() => {
    setCurrentPage(1);
    fetchServers(1, pageSize);
  }, [selectedToolType, selectedCategory, searchName, filterSourceType]);

  useEffect(() => {
    fetchServers(currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 内置工具搜索/分页变化时重新获取
  useEffect(() => {
    if (selectedToolType === 'builtin_tool') {
      setBuiltinToolPage(1);
      fetchBuiltinTools(1, builtinToolPageSize);
    }
  }, [builtinToolSearchName]);

  useEffect(() => {
    if (selectedToolType === 'builtin_tool') {
      fetchBuiltinTools(builtinToolPage, builtinToolPageSize);
    }
  }, [builtinToolPage, builtinToolPageSize]);

  // 切换到内置工具时加载数据
  useEffect(() => {
    if (selectedToolType === 'builtin_tool') {
      fetchBuiltinTools(builtinToolPage, builtinToolPageSize);
      fetchModels();
      fetchConfigParams();
    }
  }, [selectedToolType]);

  const getAllCategoryKeys = (cats: MCPCategory[]): string[] => {
    let keys: string[] = [];
    cats.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const fetchMcpCategories = async () => {
    try {
      const data = await mcpService.getCategoryTree();
      setMcpCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch MCP categories:', error);
    }
  };

  const fetchBuiltinTools = async (page?: number, size?: number) => {
    setLoading(true);
    try {
      const queryPage = page !== undefined ? page : builtinToolPage;
      const querySize = size !== undefined ? size : builtinToolPageSize;
      const result = await toolkitService.getBuiltinTools(queryPage, querySize, builtinToolSearchName || undefined);
      setBuiltinTools(result.data);
      setTotalBuiltinTools(result.total);
    } catch (error) {
      console.error('Failed to fetch builtin tools:', error);
      setBuiltinTools([]);
      setTotalBuiltinTools(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const data = await llmModelService.getLLMModels(1, 100);
      const filteredModels = data.data.filter((model: any) =>
        model.model_type === 'text' || model.model_type === 'vision'
      );
      setModels(filteredModels);
      if (filteredModels.length > 0) {
        setSelectedModel(filteredModels[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  };

  const fetchConfigParams = async () => {
    try {
      const data = await llmModelService.getConfigParams();
      setConfigParams(data);
    } catch (error) {
      console.error('Failed to fetch config params:', error);
    }
  };

  const getSelectedModelInfo = () => {
    return models.find(m => m.id === selectedModel);
  };

  const renderConfigParam = (param: any) => {
    const value = modelConfig[param.key] ?? param.default;
    switch (param.type) {
      case 'slider':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}><InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} /></Tooltip>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Slider style={{ flex: 1 }} min={param.min} max={param.max} step={param.step} value={value} onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })} />
              <InputNumber min={param.min} max={param.max} step={param.step} value={value} onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })} style={{ width: 80 }} />
            </div>
          </div>
        );
      case 'input':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}><InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} /></Tooltip>
            </div>
            <Input value={value} onChange={(e) => setModelConfig({ ...modelConfig, [param.key]: e.target.value })} />
          </div>
        );
      case 'switch':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
                <Tooltip title={param.description}><InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} /></Tooltip>
              </div>
              <Switch checked={value} onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })} />
            </div>
          </div>
        );
      case 'select':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}><InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} /></Tooltip>
            </div>
            <Select value={value} onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })} style={{ width: '100%' }}>
              {param.options?.map((opt: string) => <Option key={opt} value={opt}>{opt}</Option>)}
            </Select>
          </div>
        );
      case 'number':
        return (
          <div key={param.key} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>{param.label}</span>
              <Tooltip title={param.description}><InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} /></Tooltip>
            </div>
            <InputNumber min={param.min} max={param.max} step={param.step || 1} value={value} onChange={(v) => setModelConfig({ ...modelConfig, [param.key]: v })} style={{ width: '100%' }} />
          </div>
        );
      default:
        return null;
    }
  };

  const configPopoverContent = (
    <div style={{ width: 350 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 500, marginRight: 8 }}>系统提示词</span>
          <Tooltip title="自定义系统提示词，用于引导模型行为">
            <InfoCircleOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }} />
          </Tooltip>
        </div>
        <TextArea
          value={modelConfig['system_prompt'] || ''}
          onChange={(e) => setModelConfig({ ...modelConfig, system_prompt: e.target.value })}
          rows={4}
          placeholder="请输入系统提示词"
        />
      </div>
      {(configParams[getSelectedModelInfo()?.model_type || 'text'] || []).length > 0 ? (
        (configParams[getSelectedModelInfo()?.model_type || 'text'] || []).map((param: any) => renderConfigParam(param))
      ) : (
        <div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}>该模型类型暂无可配置参数</div>
      )}
    </div>
  );

  const fetchServers = async (page?: number, size?: number) => {
    setLoading(true);
    try {
      const queryPage = page !== undefined ? page : currentPage;
      const querySize = size !== undefined ? size : pageSize;
      let categoryId: string | undefined;
      let toolType: string | undefined;

      if (selectedCategory) {
        categoryId = selectedCategory;
      } else {
        toolType = selectedToolType;
      }

      const data = await mcpService.getServers(
        queryPage,
        querySize,
        categoryId,
        searchName || undefined,
        filterSourceType || undefined,
        undefined,
        toolType
      );
      setServers(data.data);
      setTotalServers(data.total);
    } catch (error) {
      console.error('Failed to fetch servers:', error);
      setServers([]);
      setTotalServers(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceTypes = async () => {
    try {
      const data = await mcpService.getSourceTypes();
      setSourceTypes(data);
    } catch (error) {
      console.error('Failed to fetch source types:', error);
    }
  };

  const fetchTransportTypes = async () => {
    try {
      const data = await mcpService.getTransportTypes();
      setTransportTypes(data);
    } catch (error) {
      console.error('Failed to fetch transport types:', error);
    }
  };

  const fetchLocalMcpConfig = async () => {
    try {
      const data = await mcpService.getLocalMcpConfig();
      setLocalMcpConfig(data);
    } catch (error) {
      console.error('Failed to fetch local mcp config:', error);
    }
  };

  const flattenAllCategories = (cats: MCPCategory[]): MCPCategory[] => {
    let result: MCPCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const findCategoryById = (cats: MCPCategory[], id: string): MCPCategory | null => {
    for (const cat of cats) {
      if (cat.id === id) return cat;
      if (cat.children && cat.children.length > 0) {
        const found = findCategoryById(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = mcpCategories.length > 0
      ? Math.max(...mcpCategories.map(c => c.sort_order || 0))
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1, type: 'mcp' });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: MCPCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      type: category.type,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  const handleCategorySort = async (category: MCPCategory, direction: 'up' | 'down') => {
    try {
      const allCategories = flattenAllCategories(mcpCategories);
      const siblingCategories = allCategories.filter(c => c.parent_id === category.parent_id);
      siblingCategories.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const currentIndex = siblingCategories.findIndex(c => c.id === category.id);

      if (direction === 'up' && currentIndex === 0) {
        message.warning('已经是第一个分类了');
        return;
      }
      if (direction === 'down' && currentIndex === siblingCategories.length - 1) {
        message.warning('已经是最后一个分类了');
        return;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetCategory = siblingCategories[targetIndex];

      await mcpService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await mcpService.updateCategory(targetCategory.id, { sort_order: category.sort_order });

      message.success('排序更新成功！');
      fetchMcpCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: MCPCategory) => {
    try {
      await mcpService.deleteCategory(category.id);
      message.success('分类删除成功！');
      if (selectedCategory === category.id) {
        setSelectedCategory(null);
        setSelectedKeys(['all']);
      }
      fetchMcpCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await mcpService.createCategory(values);
      message.success('分类创建成功！');
      setIsCategoryModalVisible(false);
      fetchMcpCategories();
    } catch (error) {
      console.error('创建分类失败:', error);
    }
  };

  const handleCategoryEditSubmit = async () => {
    if (!editingCategory) return;
    try {
      const values = await categoryEditForm.validateFields();
      await mcpService.updateCategory(editingCategory.id, values);
      message.success('分类更新成功！');
      setIsCategoryEditModalVisible(false);
      fetchMcpCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  // 顶部工具类型点击
  const handleToolTypeClick = (type: string) => {
    setSelectedToolType(type);
    setSelectedCategory(null);
    setSelectedKeys(['all']);
  };

  // 构建MCP分类树数据（与mcp.tsx一致，使用Tree组件）
  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };

    const buildCategoryNode = (category: MCPCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          {!category.is_default && (
            <div className="category-actions">
              <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
              <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
              <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
              <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteCategory(category); }} okText="确认" cancelText="取消">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除" className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </div>
          )}
        </div>
      ),
      key: `category-${category.id}`,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildCategoryNode(child)) : undefined,
    });

    const categoryNodes = mcpCategories.map(category => buildCategoryNode(category));
    return [allNode, ...categoryNodes];
  };

  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length === 0) return;
    const key = selectedKeys[0] as string;
    setSelectedKeys(selectedKeys as string[]);
    if (key === 'all') {
      setSelectedCategory(null);
    } else if (key.startsWith('category-')) {
      const categoryId = key.replace('category-', '');
      setSelectedCategory(categoryId);
    }
  };

  const handleTreeExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys as string[]);
  };

  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: MCPCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildNode(child)) : undefined,
    });
    return mcpCategories.map(category => buildNode(category));
  };

  // MCP服务相关方法
  const getSourceTypeLabel = (sourceType?: string): string => {
    return sourceTypes[sourceType || 'thirdparty'] || sourceType || '第三方';
  };

  const getTransportTypeLabel = (transportType?: string): string => {
    return transportTypes[transportType || 'streamable_http'] || transportType || 'Streamable HTTP';
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // 根据参数类型渲染输入组件
  const renderParamInput = (param: BuiltinToolParam) => {
    const value = paramValues[param.name] ?? param.default ?? '';
    const onChange = (v: any) => setParamValues({ ...paramValues, [param.name]: v });
    const isDataExtraction = currentTool?.name === 'data_extraction';

    // 数据抽取工具的特殊参数渲染
    if (isDataExtraction) {
      if (param.name === 'datasource_id') {
        return (
          <Select
            value={value || undefined}
            onChange={(v) => {
              onChange(v);
              // 切换数据源时加载表列表
              if (v) {
                loadTables(v);
              } else {
                setDsTables([]);
                setDsColumns([]);
              }
            }}
            placeholder={dsLoading ? '加载中...' : '请选择数据源'}
            loading={dsLoading}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          >
            {dsDatasources.map(ds => (
              <Option key={ds.id} value={ds.id} label={ds.name}>
                {ds.name} <span style={{ color: '#999', fontSize: 12 }}>({ds.type})</span>
              </Option>
            ))}
          </Select>
        );
      }
      if (param.name === 'table_name') {
        return (
          <Select
            value={value || undefined}
            onChange={(v) => {
              onChange(v);
              // 切换表时加载字段列表
              const dsId = paramValues['datasource_id'];
              if (v && dsId) {
                loadColumns(dsId, v);
              } else {
                setDsColumns([]);
              }
            }}
            placeholder={
              !paramValues['datasource_id'] ? '请先选择数据源' :
              dsLoadingTables ? '加载中...' :
              dsTables.length === 0 ? '该数据源无表' : '请选择表'
            }
            loading={dsLoadingTables}
            disabled={!paramValues['datasource_id']}
            style={{ width: '100%' }}
            showSearch
            optionFilterProp="label"
          >
            {dsTables.map(t => (
              <Option key={t.table_name} value={t.table_name} label={t.table_name}>
                {t.table_name} {t.table_comment ? <span style={{ color: '#999', fontSize: 12 }}>({t.table_comment})</span> : null}
              </Option>
            ))}
          </Select>
        );
      }
      if (param.name === 'fields') {
        return (
          <Select
            mode="tags"
            value={value ? String(value).split(',').filter(Boolean) : []}
            onChange={(v) => onChange(v.join(','))}
            placeholder={
              !paramValues['table_name'] ? '请先选择表' :
              dsLoadingColumns ? '加载中...' :
              dsColumns.length === 0 ? '该表无字段' : '请选择或输入字段（支持自定义输入）'
            }
            loading={dsLoadingColumns}
            disabled={!paramValues['table_name']}
            style={{ width: '100%' }}
            open={dsColumns.length > 0 || !paramValues['table_name'] ? undefined : false}
          >
            {dsColumns.map(c => (
              <Option key={c.column_name} value={c.column_name}>
                {c.column_name} {c.data_type ? <span style={{ color: '#999', fontSize: 12 }}>({c.data_type})</span> : null}
              </Option>
            ))}
          </Select>
        );
      }
      if (param.name === 'sql') {
        return (
          <TextArea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={6}
            placeholder="请输入自定义SQL语句（优先于表名和字段）"
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
        );
      }
      if (param.name === 'output_format') {
        return (
          <Select value={value} onChange={onChange} style={{ width: '100%' }} placeholder="请选择输出格式">
            <Option value="json">JSON</Option>
            <Option value="markdown">Markdown</Option>
          </Select>
        );
      }
    }

    switch (param.type) {
      case 'integer':
      case 'number':
        return <InputNumber value={value} onChange={onChange} style={{ width: '100%' }} placeholder={`请输入${param.name}`} />;
      case 'boolean':
        return <Switch checked={!!value} onChange={onChange} />;
      case 'array':
        return <TextArea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} onChange={(e) => onChange(e.target.value)} rows={3} placeholder='请输入JSON数组' />;
      case 'object':
        return <TextArea value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)} onChange={(e) => onChange(e.target.value)} rows={4} placeholder='请输入JSON对象' />;
      default:
        if (param.enum && param.enum.length > 0) {
          return (
            <Select value={value} onChange={onChange} style={{ width: '100%' }} placeholder={`请选择${param.name}`}>
              {param.enum.map(opt => <Option key={opt} value={opt}>{String(opt)}</Option>)}
            </Select>
          );
        }
        return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`请输入${param.name}`} />;
    }
  };

  // 校验必填参数
  const validateRequiredParams = (tool: BuiltinTool): boolean => {
    for (const param of tool.params) {
      if (param.required) {
        const val = paramValues[param.name];
        if (val === undefined || val === null || val === '') {
          message.warning(`参数 "${param.name}" 为必填项`);
          return false;
        }
      }
    }
    return true;
  };

  // 执行参数测试
  const handleParamTest = async () => {
    if (!currentTool) return;
    if (!validateRequiredParams(currentTool)) return;

    setParamTesting(true);
    setParamTestResult(null);
    try {
      const processedParams: Record<string, any> = {};
      for (const param of currentTool.params) {
        let val = paramValues[param.name];
        if (val === undefined || val === '') {
          if (param.default !== undefined && param.default !== null) {
            val = param.default;
          } else {
            continue;
          }
        }
        if ((param.type === 'array' || param.type === 'object') && typeof val === 'string') {
          try { val = JSON.parse(val); } catch { }
        }
        if (param.type === 'integer' && typeof val === 'string') { val = parseInt(val, 10); }
        if (param.type === 'number' && typeof val === 'string') { val = parseFloat(val); }
        processedParams[param.name] = val;
      }

      const response = await fetch('/aicenter/v1/toolkit/builtin_tools/' + currentTool.name + '/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedParams),
      });
      const result = await response.json();
      if (result.code === 200 && result.data) {
        const d = result.data;
        setParamTestResult({
          status: d.status || 'success',
          result: d.result,
          message: d.message || '',
          error: d.error,
        });
      } else {
        setParamTestResult({
          status: 'error',
          result: null,
          message: result.message || '执行失败',
          error: result.message || '执行失败',
        });
      }
    } catch (error: any) {
      setParamTestResult({
        status: 'error',
        result: null,
        message: error.message || '请求异常',
        error: error.message || '请求异常',
      });
    } finally {
      setParamTesting(false);
    }
  };

  // 模型测试发送消息
  const handleSendTestMessage = async () => {
    if (!testInput.trim() || !selectedModel || isGenerating) return;

    const userMessage = testInput.trim();
    const userMessageId = Date.now().toString();
    setTestMessages(prev => [...prev, { id: userMessageId, role: 'user', content: userMessage, timestamp: new Date() }]);
    setTestInput('');
    setIsGenerating(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setTestMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() }]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) { thinkingStartTimeRef.current[assistantMessageId] = Date.now(); }

    try {
      const chatMessages: any[] = [];
      if (modelConfig['system_prompt'] && modelConfig['system_prompt'].trim()) {
        chatMessages.push({ role: 'system', content: modelConfig['system_prompt'] });
      }
      testMessages.forEach(msg => { chatMessages.push({ role: msg.role, content: msg.content }); });
      chatMessages.push({ role: 'user', content: userMessage });

      const requestBody = {
        messages: chatMessages,
        config: { ...modelConfig, deep_thinking: deepThinking },
        tool_names: currentTool ? [currentTool.name] : [],
      };

      const url = '/aicenter/v1/llm_model/model/' + selectedModel + '/chat';
      abortControllerRef.current = new AbortController();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') { setIsGenerating(false); setThinkingMessageId(null); break; }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: msg.content + parsed.text } : msg)); }
              if (parsed.reasoning_content) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, reasoning_content: (msg.reasoning_content || '') + parsed.reasoning_content } : msg)); }
              if (parsed.usage) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, usage: parsed.usage } : msg)); }
              if (parsed.tool_call) {
                const tc = parsed.tool_call;
                setTestMessages(prev => prev.map(msg => {
                  if (msg.id !== assistantMessageId) return msg;
                  const existingCalls = msg.tool_calls || [];
                  const idx = existingCalls.findIndex(c => c.tool_call_id === tc.id);
                  const stepData = { tool_call_id: tc.id, name: tc.name, task_name: tc.task_name, status: tc.status, result: tc.result, message: tc.message, elapsed_ms: tc.elapsed_ms, reasoning_content: tc.reasoning_content, parameters: tc.parameters };
                  if (idx >= 0) { existingCalls[idx] = { ...existingCalls[idx], ...stepData }; }
                  else { existingCalls.push(stepData); }
                  return { ...msg, tool_calls: [...existingCalls] };
                }));
              }
            } catch (e) { console.error('Failed to parse SSE data:', e); }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, stopped: true } : msg));
      } else {
        setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: '抱歉，发生了错误：' + error.message, stopped: true } : msg));
      }
    } finally {
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({ ...prev, [assistantMessageId]: duration }));
      }
      setIsGenerating(false);
      setThinkingMessageId(null);
    }
  };

  // 打开各种抽屉
  const openViewDrawer = (tool: BuiltinTool) => { setCurrentTool(tool); setViewDrawerVisible(true); };
  const openParamTestDrawer = (tool: BuiltinTool) => { 
    setCurrentTool(tool); 
    setParamValues({}); 
    setParamTestResult(null); 
    setParamTestDrawerVisible(true);
    // 如果是数据抽取工具，加载数据源列表
    if (tool.name === 'data_extraction') {
      loadDatasources();
    }
  };

  // 数据抽取工具：加载关系型数据源列表
  const loadDatasources = async () => {
    setDsLoading(true);
    try {
      const relationalTypes = ['mysql', 'postgresql', 'oracle', 'sql_server'];
      const allDatasources: Datasource[] = [];
      // 分页获取所有数据源
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await datasourceService.getDatasources(undefined, page, 100);
        const items = result.data || [];
        allDatasources.push(...items);
        if (items.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }
      // 过滤关系型数据源
      const relational = allDatasources.filter(d => relationalTypes.includes(d.type));
      setDsDatasources(relational);
    } catch (e) {
      console.error('加载数据源失败:', e);
    } finally {
      setDsLoading(false);
    }
  };

  // 数据抽取工具：加载表列表
  const loadTables = async (datasourceId: string) => {
    setDsLoadingTables(true);
    setDsTables([]);
    setDsColumns([]);
    try {
      const result = await datasourceService.listTables(datasourceId);
      const tables = result?.tables || [];
      setDsTables(tables);
    } catch (e) {
      console.error('加载表列表失败:', e);
    } finally {
      setDsLoadingTables(false);
    }
  };

  // 数据抽取工具：加载字段列表
  const loadColumns = async (datasourceId: string, tableName: string) => {
    setDsLoadingColumns(true);
    setDsColumns([]);
    try {
      const result = await datasourceService.getTableColumns(datasourceId, tableName);
      const columns = result?.columns || [];
      setDsColumns(columns);
    } catch (e) {
      console.error('加载字段列表失败:', e);
    } finally {
      setDsLoadingColumns(false);
    }
  };
  const openModelTestDrawer = (tool: BuiltinTool) => { setCurrentTool(tool); setTestMessages([]); setTestInput(''); setModelConfig({}); setDeepThinking(true); setExpandedReasoning(new Set()); setThinkingMessageId(null); setIsGenerating(false); setEditingMessageId(null); setThinkingDuration({}); setExpandedToolCalls(new Set()); setExpandedToolCallResults(new Set()); setModelTestDrawerVisible(true); };

  const toggleReasoning = (messageId: string) => {
    setExpandedReasoning(prev => { const s = new Set(prev); s.has(messageId) ? s.delete(messageId) : s.add(messageId); return s; });
  };

  const toggleToolCall = (toolCallId: string) => {
    setExpandedToolCalls(prev => { const s = new Set(prev); s.has(toolCallId) ? s.delete(toolCallId) : s.add(toolCallId); return s; });
  };

  const toggleToolCallResult = (toolCallId: string) => {
    setExpandedToolCallResults(prev => { const s = new Set(prev); s.has(toolCallId) ? s.delete(toolCallId) : s.add(toolCallId); return s; });
  };

  const copyToClipboard = (text: string, type: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => message.success(`已复制${type}`)).catch(() => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); try { document.execCommand('copy'); message.success(`已复制${type}`); } catch { message.error('复制失败'); } document.body.removeChild(ta); });
    } else {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.focus(); ta.select(); try { document.execCommand('copy'); message.success(`已复制${type}`); } catch { message.error('复制失败'); } document.body.removeChild(ta);
    }
  };

  const handleEditMessage = (messageId: string, content: string) => { setEditingMessageId(messageId); setEditingContent(content); };
  const handleCancelEdit = () => { setEditingMessageId(null); setEditingContent(''); };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) { message.error('内容不能为空'); return; }
    const messageIndex = testMessages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;
    const updatedMessages = testMessages.slice(0, messageIndex);
    setTestMessages(updatedMessages);
    setEditingMessageId(null);
    setEditingContent('');
    setTestInput(editingContent);
    setTimeout(() => { handleSendMessageWithMessages(updatedMessages, editingContent); }, 100);
  };

  const handleRegenerate = async (messageIndex: number) => {
    if (messageIndex < 1) return;
    const userMessage = testMessages[messageIndex - 1];
    if (userMessage.role !== 'user') return;
    const updatedMessages = testMessages.slice(0, messageIndex);
    setTestMessages(updatedMessages);
    setTimeout(() => { handleSendMessageWithMessages(updatedMessages.slice(0, -1), userMessage.content); }, 100);
  };

  const handleSendMessageWithMessages = async (previousMessages: { id: string; role: 'user' | 'assistant'; content: string; reasoning_content?: string; timestamp: Date; usage?: any; stopped?: boolean }[], content: string) => {
    if (!selectedModel || isGenerating) return;
    const userMessageId = Date.now().toString();
    const userMessage = { id: userMessageId, role: 'user' as const, content: content.trim(), timestamp: new Date() };
    const newMessages = [...previousMessages, userMessage];
    setTestMessages(newMessages);
    setTestInput('');
    setIsGenerating(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setTestMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '', timestamp: new Date() }]);
    setThinkingMessageId(assistantMessageId);
    if (deepThinking) { thinkingStartTimeRef.current[assistantMessageId] = Date.now(); }

    try {
      abortControllerRef.current = new AbortController();
      const chatMessages: any[] = [];
      if (modelConfig['system_prompt'] && modelConfig['system_prompt'].trim()) { chatMessages.push({ role: 'system', content: modelConfig['system_prompt'] }); }
      previousMessages.forEach(msg => { chatMessages.push({ role: msg.role, content: msg.content }); });
      chatMessages.push({ role: 'user', content: userMessage.content });

      const requestBody = { messages: chatMessages, config: { ...modelConfig, deep_thinking: deepThinking }, tool_names: currentTool ? [currentTool.name] : [] };
      const url = '/aicenter/v1/llm_model/model/' + selectedModel + '/chat';
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: abortControllerRef.current.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader available');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') { setIsGenerating(false); setThinkingMessageId(null); break; }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: msg.content + parsed.text } : msg)); }
              if (parsed.reasoning_content) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, reasoning_content: (msg.reasoning_content || '') + parsed.reasoning_content } : msg)); }
              if (parsed.usage) { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, usage: parsed.usage } : msg)); }
              if (parsed.tool_call) {
                const tc = parsed.tool_call;
                setTestMessages(prev => prev.map(msg => {
                  if (msg.id !== assistantMessageId) return msg;
                  const existingCalls = msg.tool_calls || [];
                  const idx = existingCalls.findIndex(c => c.tool_call_id === tc.id);
                  const stepData = { tool_call_id: tc.id, name: tc.name, task_name: tc.task_name, status: tc.status, result: tc.result, message: tc.message, elapsed_ms: tc.elapsed_ms, reasoning_content: tc.reasoning_content, parameters: tc.parameters };
                  if (idx >= 0) { existingCalls[idx] = { ...existingCalls[idx], ...stepData }; }
                  else { existingCalls.push(stepData); }
                  return { ...msg, tool_calls: [...existingCalls] };
                }));
              }
            } catch (e) { console.error('Failed to parse SSE data:', e); }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, stopped: true } : msg)); }
      else { setTestMessages(prev => prev.map(msg => msg.id === assistantMessageId ? { ...msg, content: '抱歉，发生了错误：' + error.message, stopped: true } : msg)); }
    } finally {
      if (deepThinking && thinkingStartTimeRef.current[assistantMessageId]) {
        const duration = Date.now() - thinkingStartTimeRef.current[assistantMessageId];
        setThinkingDuration(prev => ({ ...prev, [assistantMessageId]: duration }));
      }
      setIsGenerating(false);
      setThinkingMessageId(null);
    }
  };

  const handleAddServer = () => {
    form.resetFields();
    setSelectedSourceType('local');
    setSelectedTransportType('streamable_http');
    setAvatarPreview('');
    const defaultUrl = `http://${localMcpConfig.host}:${localMcpConfig.port}/mcp`;
    form.setFieldsValue({ source_type: 'local', transport_type: 'streamable_http', url: defaultUrl, category_id: selectedCategory || undefined });
    setIsModalVisible(true);
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServerId(server.id);
    editForm.setFieldsValue({
      name: server.name,
      code: server.code,
      source_type: server.source_type || 'thirdparty',
      transport_type: server.transport_type || 'streamable_http',
      avatar: server.avatar,
      url: server.url,
      category_id: server.category_id,
      description: server.description,
      config: server.config
    });
    setSelectedEditSourceType(server.source_type || 'thirdparty');
    setSelectedEditTransportType(server.transport_type || 'streamable_http');
    setEditAvatarPreview(server.avatar || '');
    setIsEditModalVisible(true);
  };

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value);
    if (value === 'local') {
      setSelectedTransportType('streamable_http');
      const defaultUrl = `http://${localMcpConfig.host}:${localMcpConfig.port}/mcp`;
      form.setFieldsValue({ transport_type: 'streamable_http', url: defaultUrl });
    } else {
      form.setFieldsValue({ url: '' });
    }
  };

  const handleEditSourceTypeChange = (value: string) => {
    setSelectedEditSourceType(value);
    if (value === 'local') {
      setSelectedEditTransportType('streamable_http');
      const defaultUrl = `http://${localMcpConfig.host}:${localMcpConfig.port}/mcp`;
      editForm.setFieldsValue({ transport_type: 'streamable_http', url: defaultUrl });
    }
  };

  const compressImage = (file: File, maxWidth: number = 200, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new window.Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAvatarChange = async (info: any) => {
    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj;
      if (file) {
        try {
          const compressedBase64 = await compressImage(file, 200, 0.7);
          form.setFieldsValue({ avatar: compressedBase64 });
          setAvatarPreview(compressedBase64);
          message.success('头像上传成功');
        } catch (error) {
          message.error('头像处理失败');
        }
      }
    }
  };

  const handleEditAvatarChange = async (info: any) => {
    if (info.file.status === 'done' || info.file.originFileObj) {
      const file = info.file.originFileObj;
      if (file) {
        try {
          const compressedBase64 = await compressImage(file, 200, 0.7);
          editForm.setFieldsValue({ avatar: compressedBase64 });
          setEditAvatarPreview(compressedBase64);
          message.success('头像上传成功');
        } catch (error) {
          message.error('头像处理失败');
        }
      }
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) { message.error('只能上传图片文件！'); return false; }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) { message.error('图片大小不能超过 5MB！'); return false; }
      return true;
    },
    customRequest: ({ file, onSuccess }) => { setTimeout(() => { if (onSuccess) onSuccess({ status: 'done' }, file); }, 0); },
    onChange: handleAvatarChange,
  };

  const editUploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) { message.error('只能上传图片文件！'); return false; }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) { message.error('图片大小不能超过 5MB！'); return false; }
      return true;
    },
    customRequest: ({ file, onSuccess }) => { setTimeout(() => { if (onSuccess) onSuccess({ status: 'done' }, file); }, 0); },
    onChange: handleEditAvatarChange,
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await mcpService.createServer(values);
      message.success('MCP服务创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setAvatarPreview('');
      fetchServers(currentPage, pageSize);
      fetchMcpCategories();
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  const handleEditSubmit = async () => {
    if (!editingServerId) return;
    try {
      const values = await editForm.validateFields();
      await mcpService.updateServer(editingServerId, values);
      message.success('MCP服务更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setEditAvatarPreview('');
      setEditingServerId(null);
      fetchServers(currentPage, pageSize);
      fetchMcpCategories();
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await mcpService.deleteServer(serverId);
      message.success('MCP服务删除成功！');
      if (servers.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchServers(currentPage, pageSize);
      }
      fetchMcpCategories();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleTestConnection = async (formInstance: any) => {
    try {
      const values = await formInstance.validateFields(['transport_type', 'url', 'config']);
      setTestingConnection(true);
      setConnectionTestResult(null);
      const result = await mcpService.testConnection({
        transport_type: values.transport_type,
        url: values.url,
        config: values.config
      });
      setConnectionTestResult({ success: result.success, message: result.message });
      if (result.success) { message.success('连接测试成功！'); } else { message.error(result.message || '连接测试失败'); }
    } catch (error: any) {
      console.error('测试连接失败:', error);
      setConnectionTestResult({ success: false, message: error.message || '连接测试失败' });
      message.error('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestServerConnection = async (server: MCPServer) => {
    const key = `test-${server.id}`;
    message.loading({ content: `正在测试 ${server.name} 连接...`, key, duration: 0 });
    try {
      const result = await mcpService.testConnection({
        transport_type: server.transport_type,
        url: server.url,
        config: server.config
      });
      if (result.success) { message.success({ content: `${server.name} 连接测试成功！`, key }); }
      else { message.error({ content: `${server.name} 连接失败: ${result.message}`, key }); }
    } catch (error: any) {
      message.error({ content: `${server.name} 连接测试失败: ${error.message}`, key });
    }
  };

  // 判断当前选中的工具类型
  const showMcpList = selectedToolType === 'mcp';
  const showApiList = selectedToolType === 'api';
  const showBuiltinTools = selectedToolType === 'builtin_tool';
  const showSkillPage = selectedToolType === 'skill';

  // 工具类型列表（内置工具放最后）
  const toolTypes = [
    { key: 'mcp', name: 'MCP服务', icon: TOOL_TYPE_ICON.mcp, color: TOOL_TYPE_COLOR.mcp },
    { key: 'api', name: 'API接口', icon: TOOL_TYPE_ICON.api, color: TOOL_TYPE_COLOR.api },
    { key: 'code_script', name: '代码脚本', icon: TOOL_TYPE_ICON.code_script, color: TOOL_TYPE_COLOR.code_script },
    { key: 'skill', name: 'SKILL技能', icon: TOOL_TYPE_ICON.skill, color: TOOL_TYPE_COLOR.skill },
    { key: 'builtin_tool', name: '内置工具', icon: TOOL_TYPE_ICON.builtin_tool, color: TOOL_TYPE_COLOR.builtin_tool },
  ];

  return (
    <div ref={pageContainerRef} className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <Layout className="toolkit-layout">
        {/* 顶部工具类型栏 */}
        <div className={`tool-type-bar ${theme === 'dark' ? 'dark' : 'light'}`}>
          {toolTypes.map(item => {
            const isActive = selectedToolType === item.key;
            return (
              <div
                key={item.key}
                className={`tool-type-item ${isActive ? 'active' : ''} ${theme === 'dark' ? 'dark' : 'light'}`}
                onClick={() => handleToolTypeClick(item.key)}
                style={{
                  color: isActive ? item.color : (theme === 'dark' ? `${item.color}99` : `${item.color}aa`),
                  background: isActive
                    ? (theme === 'dark' ? `${item.color}40` : `${item.color}26`)
                    : 'transparent',
                  borderColor: isActive ? `${item.color}80` : `${item.color}33`,
                }}
              >
                <span className="tool-type-icon" style={{ color: isActive ? item.color : (theme === 'dark' ? `${item.color}99` : `${item.color}aa`) }}>
                  {item.icon}
                </span>
                <span className="tool-type-name">{item.name}</span>
              </div>
            );
          })}
        </div>

        <Layout className="toolkit-main">
          {showApiList ? (
            <ApiTool theme={theme} />
          ) : showSkillPage ? (
            <SkillManagement theme={theme} />
          ) : (
            <>
          {showMcpList && (
            <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
              <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>MCP分类</span>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} size="small" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
                  新增分类
                </Button>
              </div>
              <Tree
                showIcon
                selectedKeys={selectedKeys}
                expandedKeys={expandedKeys}
                onSelect={handleTreeSelect}
                onExpand={handleTreeExpand}
                treeData={buildTreeData()}
                className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`}
              />
            </LeftSider>
          )}

          <Content className={`toolkit-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
            {showMcpList ? (
              <>
                {/* 工具栏 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', padding: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleAddServer} style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}>
                    新增MCP服务
                  </Button>
                  <Input
                    placeholder="搜索服务名称"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    prefix={<SearchOutlined />}
                    style={{ width: '200px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
                    className="no-border-input"
                  />
                  <Select
                    placeholder="按来源筛选"
                    value={filterSourceType || undefined}
                    onChange={(value) => setFilterSourceType(value || '')}
                    style={{ width: '150px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none', color: theme === 'dark' ? '#ffffff' : '#000000', height: '36px' }}
                  >
                    <Option value="">全部来源</Option>
                    {Object.entries(sourceTypes).map(([key, value]) => (
                      <Option key={key} value={key}>{value}</Option>
                    ))}
                  </Select>
                </div>

                {/* MCP服务列表 */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 16px' }} className="hide-scrollbar">
                  <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                  {loading ? (
                    <div className="loading-container"><Spin size="large" /></div>
                  ) : servers.length === 0 ? (
                    <Empty description="暂无MCP服务" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {servers.map((server, index) => (
                        <Col key={server.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                          <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '0' }} onClick={() => navigate(`/mcp/setting/${server.id}`)}>
                            <div className="card-content">
                              {/* 头部：图标 + 名称 */}
                              <div className="card-header">
                                <div className="card-icon">
                                  {server.avatar ? (
                                    <img src={server.avatar} alt={server.name} style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover' }} />
                                  ) : (
                                    <ApiOutlined style={{ fontSize: '24px', color: '#fff' }} />
                                  )}
                                </div>
                                <div className="card-info">
                                  <div className="card-title">{server.name}</div>
                                  <div className="card-subtitle">{server.code}</div>
                                </div>
                              </div>
                              {/* 中间：来源 + 传输类型 */}
                              <div className="card-tags">
                                <span className="card-tag">{getSourceTypeLabel(server.source_type)}</span>
                                <span className="card-tag">{getTransportTypeLabel(server.transport_type)}</span>
                              </div>
                              {/* 底部：创建时间 + 操作按钮 */}
                              <div className="card-footer">
                                <div className="card-time">
                                  <ClockCircleOutlined /> 创建时间: {formatDate(server.created_at)}
                                </div>
                                <div className="card-actions-bottom">
                                  <Button icon={<ApiTwoTone />} onClick={(e) => { e.stopPropagation(); handleTestServerConnection(server); }} className="action-btn test" title="测试连接"><span>测试连接</span></Button>
                                  <Button icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditServer(server); }} className="action-btn edit" title="编辑"><span>编辑</span></Button>
                                  <Popconfirm title="确认删除" description="确定要删除这个MCP服务吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteServer(server.id); }} okText="确认" cancelText="取消">
                                    <Button icon={<DeleteOutlined />} danger className="action-btn delete" title="删除" onClick={(e) => e.stopPropagation()}><span>删除</span></Button>
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>

                {/* 分页 */}
                {totalServers > 0 && (
                  <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                      current={currentPage}
                      pageSize={pageSize}
                      total={totalServers}
                      onChange={(page) => { setCurrentPage(page); }}
                      onShowSizeChange={(current, size) => { setPageSize(size); setCurrentPage(1); }}
                      showSizeChanger
                      showQuickJumper
                      showTotal={(total) => `共 ${total} 条记录`}
                      pageSizeOptions={['12', '24', '36', '48']}
                      locale={{ items_per_page: '条/页', jump_to: '前往', jump_to_confirm: '确定', page: '页', prev_page: '上一页', next_page: '下一页', prev_5: '向前 5 页', next_5: '向后 5 页', prev_3: '向前 3 页', next_3: '向后 3 页', first: '第一页', last: '最后一页' }}
                      className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
                      style={{ margin: 0 }}
                    />
                  </div>
                )}
              </>
            ) : showBuiltinTools ? (
              <>
                {/* 内置工具工具栏 */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', padding: 16 }}>
                  <Input
                    placeholder="搜索工具名称"
                    value={builtinToolSearchName}
                    onChange={(e) => setBuiltinToolSearchName(e.target.value)}
                    prefix={<SearchOutlined />}
                    style={{ width: '200px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
                    className="no-border-input"
                  />
                </div>

                {/* 内置工具列表 */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 16px' }} className="hide-scrollbar">
                  <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                  {loading ? (
                    <div className="loading-container"><Spin size="large" /></div>
                  ) : builtinTools.length === 0 ? (
                    <Empty description="暂无内置工具" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
                  ) : (
                    <Row gutter={[16, 16]}>
                      {builtinTools.map((tool, index) => (
                        <Col key={tool.name} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                          <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '0' }}>
                            <div className="card-content" style={{ height: 262, display: 'flex', flexDirection: 'column' }}>
                              <div className="card-header">
                                <div className="card-icon">
                                  <ToolOutlined style={{ fontSize: '24px', color: '#fff' }} />
                                </div>
                                <div className="card-info">
                                  <div className="card-title" style={{ fontSize: '17px', fontWeight: 600 }}>{tool.title || tool.name}</div>
                                  <div className="card-subtitle" style={{ fontSize: '13px' }}>{tool.name}</div>
                                </div>
                              </div>
                              <div style={{ flex: 1, fontSize: '12px', color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis', lineHeight: '1.5', marginBottom: '12px' }}>
                                {tool.description}
                              </div>
                              <div className="card-footer">
                                <div className="card-actions-bottom">
                                  <Button icon={<EyeOutlined />} onClick={() => openViewDrawer(tool)} className="action-btn test" title="查看"><span>查看</span></Button>
                                  <Button icon={<ToolOutlined />} onClick={() => openParamTestDrawer(tool)} className="action-btn edit" title="参数测试"><span>参数测试</span></Button>
                                  <Button icon={<PlayCircleOutlined />} onClick={() => openModelTestDrawer(tool)} className="action-btn delete" title="模型测试" style={{ background: 'rgba(90, 111, 214, 0.08) !important', color: '#5a6fd6 !important' }}><span>模型测试</span></Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </div>

                {/* 内置工具分页 */}
                {totalBuiltinTools > 0 && (
                  <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
                    <Pagination
                      current={builtinToolPage}
                      pageSize={builtinToolPageSize}
                      total={totalBuiltinTools}
                      onChange={(page) => { setBuiltinToolPage(page); }}
                      onShowSizeChange={(current, size) => { setBuiltinToolPageSize(size); setBuiltinToolPage(1); }}
                      showSizeChanger
                      showQuickJumper
                      showTotal={(total) => `共 ${total} 条记录`}
                      pageSizeOptions={['12', '24', '36', '48']}
                      locale={{ items_per_page: '条/页', jump_to: '前往', jump_to_confirm: '确定', page: '页', prev_page: '上一页', next_page: '下一页', prev_5: '向前 5 页', next_5: '向后 5 页', prev_3: '向前 3 页', next_3: '向后 3 页', first: '第一页', last: '最后一页' }}
                      className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
                      style={{ margin: 0 }}
                    />
                  </div>
                )}
              </>
            ) : (
              /* 其他类型，显示功能开发中 */
              <div className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`}>
                <Empty description={`${toolTypes.find(t => t.key === selectedToolType)?.name || '该分类'} 功能开发中`} />
              </div>
            )}
          </Content>
            </>
          )}
        </Layout>
      </Layout>

      {/* 参数测试抽屉 - 在page-container内滑出 */}
      <Drawer
        title="参数测试"
        placement="right"
        width={600}
        getContainer={() => pageContainerRef.current!}
        open={paramTestDrawerVisible}
        onClose={() => setParamTestDrawerVisible(false)}
        rootClassName={`toolkit-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', color: theme === 'dark' ? '#fff' : '#000', padding: '24px' },
        }}
      >
        {currentTool && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{currentTool.title || currentTool.name}</h3>
              <div style={{ fontSize: 13, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>{currentTool.description}</div>
            </div>
            <Form layout="vertical">
              {currentTool.params.map(param => (
                <Form.Item
                  key={param.name}
                  label={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{param.name}</span>
                      {param.required && <span style={{ color: '#ff4d4f' }}>*</span>}
                      <Tooltip title={param.description}>
                        <EyeOutlined style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', cursor: 'pointer' }} />
                      </Tooltip>
                    </div>
                  }
                  required={false}
                >
                  {renderParamInput(param)}
                </Form.Item>
              ))}
            </Form>
            <Button type="primary" icon={paramTesting ? <LoadingOutlined /> : <PlayCircleOutlined />} onClick={handleParamTest} loading={paramTesting} style={{ width: '100%', marginBottom: 16 }}>
              {paramTesting ? '执行中...' : '执行测试'}
            </Button>
            {paramTestResult !== null && (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500 }}>执行结果:</span>
                  {paramTestResult.status === 'success' ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>执行成功</Tag>
                  ) : (
                    <Tag color="error" icon={<CloseCircleOutlined />}>执行失败</Tag>
                  )}
                  {paramTestResult.message && (
                    <span style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
                      {paramTestResult.message}
                    </span>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <Tooltip title="复制结果">
                    <Button
                      size="small"
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        const value = paramTestResult.status === 'success'
                          ? (typeof paramTestResult.result === 'string' ? paramTestResult.result : JSON.stringify(paramTestResult.result, null, 2))
                          : (paramTestResult.error || paramTestResult.message || '未知错误');
                        copyToClipboard(value, '结果');
                      }}
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }}
                    />
                  </Tooltip>
                  <div style={{ padding: 12, borderRadius: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f5f5f5', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, overflow: 'auto', maxHeight: 400, fontSize: 13 }}>
                    {paramTestResult.status === 'success' ? (
                      <JsonViewer data={paramTestResult.result} theme={theme} />
                    ) : (
                      <JsonViewer data={paramTestResult.error || paramTestResult.message || '未知错误'} theme={theme} />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* 新增分类模态框 */}
      <Modal title="新增分类" open={isCategoryModalVisible} onOk={handleCategorySubmit} onCancel={() => setIsCategoryModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`toolkit-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="type" label="工具类型" rules={[{ required: true, message: '请选择工具类型' }]}>
            <Select placeholder="请选择工具类型">
              <Option value="mcp">MCP服务</Option>
              <Option value="api">API接口</Option>
              <Option value="code_script">代码脚本</Option>
              <Option value="builtin_tool">内置工具</Option>
              <Option value="skill">SKILL技能</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect placeholder="请选择父分类" treeData={buildCategoryTreeSelectData()} allowClear treeDefaultExpandAll />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" initialValue={1} rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分类模态框 */}
      <Modal title="编辑分类" open={isCategoryEditModalVisible} onOk={handleCategoryEditSubmit} onCancel={() => setIsCategoryEditModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`toolkit-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="type" label="工具类型">
            <Select placeholder="请选择工具类型" disabled={editingCategory?.is_default}>
              <Option value="mcp">MCP服务</Option>
              <Option value="api">API接口</Option>
              <Option value="code_script">代码脚本</Option>
              <Option value="builtin_tool">内置工具</Option>
              <Option value="skill">SKILL技能</Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect placeholder="请选择父分类" treeData={buildCategoryTreeSelectData()} allowClear treeDefaultExpandAll />
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增MCP服务模态框 */}
      <Modal
        title="新增MCP服务"
        open={isModalVisible}
        onCancel={() => { setIsModalVisible(false); setConnectionTestResult(null); }}
        width={700}
        okText="保存"
        cancelText="取消"
        className={`toolkit-modal ${theme === 'dark' ? 'dark' : 'light'}`}
        footer={[
          <Button key="cancel" onClick={() => { setIsModalVisible(false); setConnectionTestResult(null); }}>取消</Button>,
          <Button key="test" type="default" icon={testingConnection ? <LoadingOutlined /> : <ApiTwoTone />} onClick={() => handleTestConnection(form)} loading={testingConnection} style={{ marginRight: '8px' }}>
            {testingConnection ? '测试中...' : '测试连接'}
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmit}>保存</Button>,
          connectionTestResult && (
            <span key="result" style={{ color: connectionTestResult.success ? '#52c41a' : '#ff4d4f', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {connectionTestResult.message}
            </span>
          )
        ].filter(Boolean)}
      >
        <Form form={form} layout="vertical" initialValues={{ source_type: 'local', transport_type: 'streamable_http' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                <Input placeholder="请输入服务名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                <Input placeholder="请输入服务编码（字母、数字、下划线）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_type" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
                <Select placeholder="请选择来源类型" onChange={handleSourceTypeChange}>
                  {Object.entries(sourceTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transport_type" label="传输类型" rules={[{ required: true, message: '请选择传输类型' }]}>
                <Select placeholder="请选择传输类型" onChange={(v) => setSelectedTransportType(v)} disabled={selectedSourceType === 'local'}>
                  {Object.entries(transportTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {selectedTransportType === 'stdio' && (
            <Form.Item name="config" label="NPX命令">
              <TextArea rows={8} placeholder={`以高德地图为例：\n{\n  "mcpServers": {\n    "amap-maps": {\n      "args": [\n        "-y",\n        "@amap/amap-maps-mcp-server"\n      ],\n      "command": "npx",\n      "env": {\n        "AMAP_MAPS_API_KEY": ""\n      }\n    }\n  }\n}`} />
            </Form.Item>
          )}
          {(selectedTransportType === 'sse' || selectedTransportType === 'streamable_http') && (
            <>
              <Form.Item name="url" label="URL">
                <Input placeholder="请输入MCP服务URL" />
              </Form.Item>
              {selectedSourceType === 'thirdparty' && (
                <Form.Item name="config" label="自定义参数（JSON格式）">
                  <TextArea rows={8} placeholder='请输入JSON格式的自定义参数，例如：{"headers": {"Authorization": "Bearer xxx"}}' />
                </Form.Item>
              )}
            </>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category_id" label="分类">
                <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="avatar" label="服务头像">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {avatarPreview && (
                    <>
                      <img src={avatarPreview} alt="头像预览" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                      <Button icon={<DeleteOutlined />} danger size="small" onClick={() => { form.setFieldsValue({ avatar: '' }); setAvatarPreview(''); }}>清空</Button>
                    </>
                  )}
                  <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />}>点击上传</Button>
                  </Upload>
                </div>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={3} placeholder="请输入服务描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑MCP服务模态框 */}
      <Modal
        title="编辑MCP服务"
        open={isEditModalVisible}
        onCancel={() => { setIsEditModalVisible(false); setConnectionTestResult(null); }}
        width={700}
        okText="保存"
        cancelText="取消"
        className={`toolkit-modal ${theme === 'dark' ? 'dark' : 'light'}`}
        footer={[
          <Button key="cancel" onClick={() => { setIsEditModalVisible(false); setConnectionTestResult(null); }}>取消</Button>,
          <Button key="test" type="default" icon={testingConnection ? <LoadingOutlined /> : <ApiTwoTone />} onClick={() => handleTestConnection(editForm)} loading={testingConnection} style={{ marginRight: '8px' }}>
            {testingConnection ? '测试中...' : '测试连接'}
          </Button>,
          <Button key="submit" type="primary" onClick={handleEditSubmit}>保存</Button>,
          connectionTestResult && (
            <span key="result" style={{ color: connectionTestResult.success ? '#52c41a' : '#ff4d4f', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              {connectionTestResult.message}
            </span>
          )
        ].filter(Boolean)}
      >
        <Form form={editForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                <Input placeholder="请输入服务名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                <Input placeholder="请输入服务编码（字母、数字、下划线）" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_type" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
                <Select placeholder="请选择来源类型" onChange={handleEditSourceTypeChange}>
                  {Object.entries(sourceTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="transport_type" label="传输类型" rules={[{ required: true, message: '请选择传输类型' }]}>
                <Select placeholder="请选择传输类型" onChange={(v) => setSelectedEditTransportType(v)} disabled={selectedEditSourceType === 'local'}>
                  {Object.entries(transportTypes).map(([key, value]) => (
                    <Option key={key} value={key}>{value}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          {selectedEditTransportType === 'stdio' && (
            <Form.Item name="config" label="NPX命令">
              <TextArea rows={8} placeholder={`以高德地图为例：\n{\n  "mcpServers": {\n    "amap-maps": {\n      "args": [\n        "-y",\n        "@amap/amap-maps-mcp-server"\n      ],\n      "command": "npx",\n      "env": {\n        "AMAP_MAPS_API_KEY": ""\n      }\n    }\n  }\n}`} />
            </Form.Item>
          )}
          {(selectedEditTransportType === 'sse' || selectedEditTransportType === 'streamable_http') && (
            <>
              <Form.Item name="url" label="URL">
                <Input placeholder="请输入MCP服务URL" />
              </Form.Item>
              {selectedEditSourceType === 'thirdparty' && (
                <Form.Item name="config" label="自定义参数（JSON格式）">
                  <TextArea rows={8} placeholder='请输入JSON格式的自定义参数，例如：{"headers": {"Authorization": "Bearer xxx"}}' />
                </Form.Item>
              )}
            </>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category_id" label="分类">
                <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="avatar" label="服务头像">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {editAvatarPreview && (
                    <>
                      <img src={editAvatarPreview} alt="头像预览" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                      <Button icon={<DeleteOutlined />} danger size="small" onClick={() => { editForm.setFieldsValue({ avatar: '' }); setEditAvatarPreview(''); }}>清空</Button>
                    </>
                  )}
                  <Upload {...editUploadProps}>
                    <Button icon={<UploadOutlined />}>点击上传</Button>
                  </Upload>
                </div>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={3} placeholder="请输入服务描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看工具抽屉 */}
      <Drawer
        title="工具详情"
        placement="right"
        width={500}
        open={viewDrawerVisible}
        onClose={() => setViewDrawerVisible(false)}
        className={`toolkit-modal ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', color: theme === 'dark' ? '#fff' : '#000' },
        }}
      >
        {currentTool && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{currentTool.title || currentTool.name}</h3>
              <div style={{ fontSize: 14, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>名称: {currentTool.name}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>描述</div>
              <div style={{ fontSize: 14, color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}>{currentTool.description}</div>
            </div>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 8 }}>参数列表</div>
              {currentTool.params.length === 0 ? (
                <div style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>无参数</div>
              ) : (
                currentTool.params.map(param => (
                  <div key={param.name} style={{ padding: '12px', marginBottom: 8, borderRadius: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{param.name}</span>
                      <Tag color={param.required ? 'red' : 'default'}>{param.required ? '必填' : '可选'}</Tag>
                      <Tag>{param.type}</Tag>
                    </div>
                    <div style={{ fontSize: 13, color: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>{param.description}</div>
                    {param.default !== undefined && param.default !== null && (
                      <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: 4 }}>默认值: {String(param.default)}</div>
                    )}
                    {param.enum && (
                      <div style={{ fontSize: 12, color: theme === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', marginTop: 4 }}>枚举: {param.enum.join(', ')}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* 模型测试抽屉 */}
      <Drawer
        title="模型测试"
        placement="right"
        width={600}
        open={modelTestDrawerVisible}
        onClose={() => setModelTestDrawerVisible(false)}
        getContainer={false}
        mask={true}
        maskClosable={true}
        className={`prompt-test-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 顶部栏：模型选择 + 参数配置 */}
          <div style={{ padding: '12px 16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme === 'dark' ? 'none' : '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }} onClick={() => setModelDropdownVisible(!modelDropdownVisible)}>
                <RightOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#666' }} />
                {selectedModel ? (
                  <>
                    <img src={getDefaultAvatar()} alt="model" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>{getSelectedModelInfo()?.name}</span>
                  </>
                ) : (
                  <span style={{ color: theme === 'dark' ? '#aaa' : '#666' }}>请选择模型</span>
                )}
              </div>
              {modelDropdownVisible && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: theme === 'dark' ? '#1a1a1a' : '#fff', border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', maxHeight: '300px', overflowY: 'auto', zIndex: 1000, width: 'max-content' }}>
                  {models.map(model => (
                    <div key={model.id} onClick={() => { setSelectedModel(model.id); setModelDropdownVisible(false); setModelConfig(model.config || {}); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap', background: selectedModel === model.id ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#f5f5f5') : 'transparent', transition: 'background-color 0.2s' }}>
                      <img src={getDefaultAvatar()} alt="model" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ color: theme === 'dark' ? '#fff' : '#000', whiteSpace: 'nowrap' }}>{model.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Popover content={configPopoverContent} title="模型参数配置" trigger="click" placement="bottomRight">
                <Button type="text" icon={<SettingOutlined />} style={{ color: theme === 'dark' ? '#fff' : '#000' }} />
              </Popover>
              <Button type="text" icon={<ClearOutlined />} style={{ color: theme === 'dark' ? '#fff' : '#000' }} onClick={() => setTestMessages([])} />
            </div>
          </div>

          {/* 聊天消息区 */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className={`chat-messages ${theme === 'dark' ? 'dark' : 'light'}`}>
              {testMessages.length === 0 ? (
                <div style={{ textAlign: 'center', color: theme === 'dark' ? '#fff' : '#999', padding: '40px 0' }}>
                  <PlayCircleOutlined style={{ fontSize: '48px', marginBottom: '0px', opacity: 0.3 }} />
                  <p>输入消息开始测试工具</p>
                </div>
              ) : (
                testMessages.map((msg, index) => (
                  <div key={index} className={`message ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : <img src={getDefaultAvatar()} alt="AI" className="avatar-image" />}
                    </div>
                    <div className="message-content">
                      {msg.role === 'assistant' && (thinkingMessageId === msg.id && deepThinking) && (
                        <div className="message-reasoning">
                          <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                            <LoadingOutlined spin /><BulbOutlined /> 正在思考中
                          </div>
                          {expandedReasoning.has(msg.id) && msg.reasoning_content && (
                            <div className="reasoning-text"><div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}><ChatMarkdown source={msg.reasoning_content} className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`} /></div></div>
                          )}
                        </div>
                      )}
                      {msg.role === 'assistant' && msg.reasoning_content && !(thinkingMessageId === msg.id && deepThinking) && (
                        <div className="message-reasoning">
                          <div className="reasoning-header" onClick={() => toggleReasoning(msg.id)}>
                            {expandedReasoning.has(msg.id) ? <DownOutlined /> : <RightOutlined />}<BulbOutlined /> 思考过程
                            {thinkingDuration[msg.id] && <span className="reasoning-duration">({(thinkingDuration[msg.id] / 1000).toFixed(1)}s)</span>}
                          </div>
                          {expandedReasoning.has(msg.id) && (
                            <div className="reasoning-text"><div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}><ChatMarkdown source={msg.reasoning_content} className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`} /></div></div>
                          )}
                        </div>
                      )}
                      {editingMessageId === msg.id ? (
                        <div className="message-edit-area">
                          <TextArea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} style={{ width: '100%' }} />
                          <div className="edit-actions">
                            <Button size="small" onClick={handleCancelEdit}>取消</Button>
                            <Button size="small" type="primary" onClick={() => handleSaveEdit(msg.id)}>发送</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.content && (
                            msg.role === 'user' ? (
                              <div className="user-message-text">{msg.content}</div>
                            ) : (
                              <div className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}><ChatMarkdown source={msg.content} className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`} /></div>
                            )
                          )}
                          {msg.stopped && <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px', fontStyle: 'italic' }}>[已停止生成]</div>}
                          {/* 工具调用步骤 */}
                          {msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0 && (
                            <div className="tool-calls-container">
                              {msg.tool_calls.map((tc, tcIndex) => {
                                const tcId = tc.tool_call_id || `tc-${tcIndex}`;
                                return (
                                  <div key={tcId} className={`tool-call-card tool-call-${tc.status}`}>
                                    <div className="tool-call-header" onClick={() => toggleToolCall(tcId)}>
                                      <div className="tool-call-header-left">
                                        {tc.status === 'start' && <LoadingOutlined spin className="tool-call-icon-start" />}
                                        {tc.status === 'running' && <LoadingOutlined spin className="tool-call-icon-running" />}
                                        {tc.status === 'success' && <span className="tool-call-icon-success">✓</span>}
                                        {tc.status === 'error' && <span className="tool-call-icon-error">✗</span>}
                                        {expandedToolCalls.has(tcId) ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                        {tc.task_name && <span className="tool-call-task-name">{tc.task_name}</span>}
                                        {!tc.task_name && <span className="tool-call-task-name">{tc.name}</span>}
                                      </div>
                                      <div className="tool-call-header-right">
                                        {tc.elapsed_ms != null && tc.elapsed_ms > 0 && <span className="tool-call-elapsed">{(tc.elapsed_ms / 1000).toFixed(1)}s</span>}
                                      </div>
                                    </div>
                                    {expandedToolCalls.has(tcId) && (
                                      <div className="tool-call-content">
                                        {tc.reasoning_content && (
                                          <div className={`tool-call-reasoning-text ${theme === 'dark' ? 'dark' : 'light'}`}>
                                            <ChatMarkdown source={tc.reasoning_content} className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`} />
                                          </div>
                                        )}
                                        {(tc.message || tc.result != null) && (
                                          <>
                                            {tc.reasoning_content && <div className="tool-call-divider" />}
                                            <div className="tool-call-result-header" onClick={(e) => { e.stopPropagation(); toggleToolCallResult(tcId); }}>
                                              {expandedToolCallResults.has(tcId) ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                              <span className="tool-call-result-title">工具结果</span>
                                            </div>
                                            {expandedToolCallResults.has(tcId) && (
                                              <>
                                                {tc.message && (
                                                  <div className={`tool-call-message ${theme === 'dark' ? 'dark' : 'light'}`}>
                                                    <ChatMarkdown source={tc.message} className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`} />
                                                  </div>
                                                )}
                                                {tc.result != null && (
                                                  <div className={`tool-call-result ${theme === 'dark' ? 'dark' : 'light'}`}>
                                                    <ChatMarkdown source={typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)} className={`md-editor small-text ${theme === 'dark' ? 'dark' : 'light'}`} />
                                                  </div>
                                                )}
                                              </>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                      <div className="message-footer">
                        <span className="message-time">{msg.timestamp.toLocaleTimeString()}</span>
                        {msg.role === 'assistant' && msg.usage && !isGenerating && (
                          <span className="message-usage">Token: {msg.usage.total_tokens || 0} | 耗时: {thinkingDuration[msg.id] ? (thinkingDuration[msg.id] / 1000).toFixed(1) : '0.0'}s</span>
                        )}
                        <div className="message-actions">
                          {msg.role === 'assistant' && msg.content && !isGenerating && (
                            <>
                              <Tooltip title="重新回答"><Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => handleRegenerate(index)} /></Tooltip>
                              <Tooltip title="复制回答"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(msg.content, '回答')} /></Tooltip>
                            </>
                          )}
                          {msg.role === 'user' && !editingMessageId && !isGenerating && (
                            <>
                              <Tooltip title="编辑问题"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditMessage(msg.id, msg.content)} /></Tooltip>
                              <Tooltip title="复制问题"><Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyToClipboard(msg.content, '问题')} /></Tooltip>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* 输入区 */}
          <div style={{ borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', padding: '12px 16px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff' }}>
            <div style={{ position: 'relative' }}>
              <TextArea
                placeholder="输入消息... (Ctrl/Shift+Enter换行，Enter发送)"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.ctrlKey || e.shiftKey) {
                      e.preventDefault();
                      const textarea = e.currentTarget;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const newValue = testInput.substring(0, start) + '\n' + testInput.substring(end);
                      setTestInput(newValue);
                      setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = start + 1; }, 0);
                    } else {
                      e.preventDefault();
                      handleSendTestMessage();
                    }
                  }
                }}
                autoSize={{ minRows: 3, maxRows: 8 }}
                className={`chat-input ${theme === 'dark' ? 'dark' : 'light'}`}
                style={{ background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8', borderRadius: '12px', resize: 'none', paddingRight: '50px', paddingBottom: '32px' }}
              />
              <div style={{ position: 'absolute', bottom: '8px', left: '12px', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className={`deep-thinking-switch ${theme === 'dark' ? 'dark' : 'light'}`} onClick={() => setDeepThinking(!deepThinking)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.3s', fontSize: '14px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)' }}>
                    <BulbOutlined style={{ color: deepThinking ? '#faad14' : undefined }} />
                    <span style={{ userSelect: 'none' }}>深度思考</span>
                    <Switch size="small" checked={deepThinking} onChange={setDeepThinking} />
                  </div>
                </div>
              </div>
              {isGenerating ? (
                <Button type="primary" icon={<StopOutlined />} onClick={() => { if (abortControllerRef.current) { abortControllerRef.current.abort(); } setIsGenerating(false); setThinkingMessageId(null); }} style={{ position: 'absolute', right: '8px', bottom: '8px', borderRadius: '8px' }} />
              ) : (
                <Button type="primary" icon={<SendOutlined />} onClick={handleSendTestMessage} disabled={!testInput.trim()} style={{ position: 'absolute', right: '8px', bottom: '8px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none' }} />
              )}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default ToolkitManagement;
