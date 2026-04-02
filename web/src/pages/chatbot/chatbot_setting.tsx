import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Upload, Spin, Tag, Avatar, Modal, Table, Slider, InputNumber, Switch, Drawer, Descriptions, Dropdown, Tooltip } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, UploadOutlined, RobotOutlined, FileTextOutlined, DatabaseOutlined, ToolOutlined, ApiOutlined, CheckCircleOutlined, EyeOutlined, DeleteOutlined, PlusOutlined, SettingOutlined, CloseOutlined, EditOutlined, AppstoreOutlined, QuestionCircleOutlined, FormOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { MenuProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { chatbotService, Chatbot, ChatbotCategory } from '../../services/chatbot';
import { promptService, Prompt } from '../../services/prompt';
import { knowledgeService, Knowledge } from '../../services/knowledge';
import { mcpService, MCPServer } from '../../services/mcp';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './chatbot_setting.less';

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  const [theme] = useState<'light' | 'dark'>(() => {
    return document.body.getAttribute('data-theme') as 'light' | 'dark' || 'light';
  });

  if (!inline && (className || language)) {
    return (
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        language={language}
        PreTag="div"
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

import WorkWeixinIcon from '../../assets/svg/企业微信.svg';
import LocalBotIcon from '../../assets/svg/本地机器人.svg';

const sourceTypeIcons: Record<string, string> = {
  'work_weixin': WorkWeixinIcon,
  'local': LocalBotIcon,
};

const { Option } = Select;

const MODEL_TYPES_TO_BIND = [
  { type: 'text', name: '文本模型' },
  { type: 'vision', name: '视觉模型' },
  { type: 'multimodal', name: '全模态模型' }
];

const MODEL_TYPE_MAP: Record<string, string> = {
  'text': '文本模型',
  'vision': '视觉模型',
  'multimodal': '全模态模型'
};

const getProviderAvatar = (provider: string): string => {
  if (!provider) {
    return '/src/assets/llm/default.svg';
  }
  const lowercaseProvider = provider.toLowerCase();
  return `/src/assets/llm/${lowercaseProvider}.svg`;
};

const generateRandomString = (length: number): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const ChatbotSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [originalData, setOriginalData] = useState<Partial<Chatbot>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [categories, setCategories] = useState<ChatbotCategory[]>([]);
  const [sourceTypes, setSourceTypes] = useState<any[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<string>('');
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>({});
  
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<number | undefined>(undefined);
  
  const [knowledges, setKnowledges] = useState<Knowledge[]>([]);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([]);
  
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [selectedMcpIds, setSelectedMcpIds] = useState<string[]>([]);
  
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | undefined>(undefined);
  
  const [boundModels, setBoundModels] = useState<Record<string, any>>({});
  const [isModelSelectModalVisible, setIsModelSelectModalVisible] = useState(false);
  const [selectingModelType, setSelectingModelType] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [configPopoverVisible, setConfigPopoverVisible] = useState<string | null>(null);
  const [modelConfig, setModelConfig] = useState<Record<string, any>>({});
  const [editingModelType, setEditingModelType] = useState<string>('');
  const [configParams, setConfigParams] = useState<Record<string, any[]>>({});
  const [viewModelDrawerVisible, setViewModelDrawerVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<any>(null);
  
  // 提示词相关state
  const [boundPrompts, setBoundPrompts] = useState<Record<string, any[]>>({
    system: [],
    user: []
  });
  const [isPromptSelectModalVisible, setIsPromptSelectModalVisible] = useState(false);
  const [selectingPromptType, setSelectingPromptType] = useState<string>('');
  const [promptSelectMode, setPromptSelectMode] = useState<string>('');
  const [manualPromptContent, setManualPromptContent] = useState<string>('');
  const [isPromptViewModalVisible, setIsPromptViewModalVisible] = useState(false);
  const [currentViewPrompt, setCurrentViewPrompt] = useState<Prompt | null>(null);
  const [isPromptEditModalVisible, setIsPromptEditModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [editingPromptContent, setEditingPromptContent] = useState<string>('');
  
  // 工具绑定相关state
  const [boundTools, setBoundTools] = useState<any[]>([]);
  const [isToolSelectModalVisible, setIsToolSelectModalVisible] = useState(false);
  const [mcpServersWithTools, setMcpServersWithTools] = useState<any[]>([]);
  const [expandedServers, setExpandedServers] = useState<string[]>([]);
  const [expandedModalServers, setExpandedModalServers] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<Record<string, string[]>>({});
  const [serverFilter, setServerFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'light';
      setTheme(newTheme as 'light' | 'dark');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (id) {
      fetchChatbot(id);
      fetchCategories();
      fetchSourceTypes();
      fetchPrompts();
      fetchKnowledges();
      fetchMcpServers();
      fetchLLMModels();
      fetchBoundModels(id);
      fetchConfigParams();
      fetchBoundPrompts(id);
      fetchBoundTools(id);
    }
  }, [id]);

  const fetchConfigParams = async () => {
    try {
      const params = await llmModelService.getConfigParams();
      setConfigParams(params);
    } catch (error) {
      console.error('Failed to fetch config params:', error);
    }
  };

  const fetchBoundPrompts = async (chatbotId: string) => {
    try {
      const prompts = await chatbotService.getChatbotPrompts(chatbotId);
      const systemPrompts = prompts.filter((p: any) => p.prompt_type === 'system');
      const userPrompts = prompts.filter((p: any) => p.prompt_type === 'user');
      setBoundPrompts({
        system: systemPrompts,
        user: userPrompts
      });
    } catch (error) {
      console.error('Failed to fetch bound prompts:', error);
    }
  };

  const fetchBoundTools = async (chatbotId: string) => {
    try {
      const tools = await chatbotService.getChatbotTools(chatbotId);
      setBoundTools(tools);
    } catch (error) {
      console.error('Failed to fetch bound tools:', error);
    }
  };

  const handleSelectTool = async () => {
    try {
      // 获取所有MCP服务及其工具
      const servers = await mcpService.getServers(1, 100);
      const serversWithTools = await Promise.all(
        servers.data.map(async (server: any) => {
          try {
            const tools = await mcpService.getTools(1, 100, server.id);
            return {
              ...server,
              tools: tools.data || []
            };
          } catch (error) {
            console.error(`Failed to fetch tools for server ${server.id}:`, error);
            return {
              ...server,
              tools: []
            };
          }
        })
      );
      setMcpServersWithTools(serversWithTools);
      setExpandedModalServers([]);
      setSelectedTools({});
      setIsToolSelectModalVisible(true);
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error);
      message.error('获取MCP服务失败');
    }
  };

  const handleToggleServerExpand = (serverId: string) => {
    setExpandedServers(prev => 
      prev.includes(serverId) 
        ? prev.filter(id => id !== serverId) 
        : [...prev, serverId]
    );
  };

  const handleToolSelect = (serverId: string, toolId: string) => {
    setSelectedTools(prev => {
      const serverTools = prev[serverId] || [];
      return {
        ...prev,
        [serverId]: serverTools.includes(toolId)
          ? serverTools.filter(id => id !== toolId)
          : [...serverTools, toolId]
      };
    });
  };

  const handleBindTools = async () => {
    if (!chatbot) return;
    try {
      // 绑定所有选中的工具
      for (const [serverId, toolIds] of Object.entries(selectedTools)) {
        for (const toolId of toolIds) {
          await chatbotService.bindToolToChatbot(chatbot.id, serverId, toolId);
        }
      }
      message.success('工具绑定成功');
      setIsToolSelectModalVisible(false);
      fetchBoundTools(chatbot.id);
    } catch (error) {
      console.error('Failed to bind tools:', error);
      message.error('工具绑定失败');
    }
  };

  const handleUnbindTool = async (toolBindingId: string) => {
    if (!chatbot) return;
    try {
      await chatbotService.unbindToolFromChatbot(chatbot.id, toolBindingId);
      message.success('工具解绑成功');
      fetchBoundTools(chatbot.id);
    } catch (error) {
      console.error('Failed to unbind tool:', error);
      message.error('工具解绑失败');
    }
  };

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [hasChanges]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const fetchChatbot = async (chatbotId: string) => {
    setLoading(true);
    try {
      const data = await chatbotService.getChatbot(chatbotId);
      setChatbot(data);
      setOriginalData({
        name: data.name,
        code: data.code,
        description: data.description,
        source_type: data.source_type,
        greeting: data.greeting,
        avatar: data.avatar,
        category_id: data.category_id,
        prompt_id: data.prompt_id,
        knowledge_ids: data.knowledge_ids,
        model_id: data.model_id,
        mcp_ids: data.mcp_ids,
        source_config: data.source_config
      });
      form.setFieldsValue({
        name: data.name,
        code: data.code,
        description: data.description,
        source_type: data.source_type,
        greeting: data.greeting,
        avatar: data.avatar,
        category_id: data.category_id
      });
      setAvatarPreview(data.avatar || '');
      setSelectedPromptId(data.prompt_id);
      setSelectedKnowledgeIds(data.knowledge_ids || []);
      setSelectedModelId(data.model_id);
      setSelectedMcpIds(data.mcp_ids ? data.mcp_ids.map(id => String(id)) : []);
      setSelectedSourceType(data.source_type || 'local');
      if (data.source_config) {
        try {
          setSourceConfig(JSON.parse(data.source_config));
        } catch (e) {
          setSourceConfig({});
        }
      }
    } catch (error) {
      console.error('Failed to fetch chatbot:', error);
      message.error('获取机器人信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await chatbotService.getCategoryTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchSourceTypes = async () => {
    try {
      const data = await chatbotService.getSourceTypes();
      setSourceTypes(data);
    } catch (error) {
      console.error('Failed to fetch source types:', error);
    }
  };

  const fetchPrompts = async () => {
    try {
      const response = await promptService.getPrompts();
      setPrompts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch prompts:', error);
    }
  };

  const fetchKnowledges = async () => {
    try {
      const data = await knowledgeService.getKnowledges();
      setKnowledges(data);
    } catch (error) {
      console.error('Failed to fetch knowledges:', error);
    }
  };

  const fetchMcpServers = async () => {
    try {
      const response = await mcpService.getServers(1, 100);
      setMcpServers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch MCP servers:', error);
    }
  };

  const fetchLLMModels = async () => {
    try {
      const response = await llmModelService.getLLMModels(1, 100, undefined, undefined, undefined, 'true');
      setLlmModels(response.data || []);
    } catch (error) {
      console.error('Failed to fetch LLM models:', error);
    }
  };

  const fetchBoundModels = async (chatbotId: string) => {
    try {
      const models = await chatbotService.getChatbotModels(chatbotId);
      const modelsMap: Record<string, any> = {};
      models.forEach((model: any) => {
        modelsMap[model.model_type] = model;
      });
      setBoundModels(modelsMap);
    } catch (error) {
      console.error('Failed to fetch bound models:', error);
    }
  };

  const handleSelectModel = (modelType: string) => {
    setSelectingModelType(modelType);
    const models = llmModels.filter(m => m.model_type === modelType && m.status);
    setAvailableModels(models);
    setIsModelSelectModalVisible(true);
  };

  const handleBindModel = async (model: LLMModel) => {
    if (!chatbot) return;
    try {
      // 获取默认config
      const defaultConfig: Record<string, any> = {};
      const params = configParams[selectingModelType] || [];
      params.forEach((param: any) => {
        defaultConfig[param.key] = param.default;
      });
      
      // 用模型的config覆盖默认config
      let modelConfig = {};
      if (model.config) {
        if (typeof model.config === 'string') {
          try {
            modelConfig = JSON.parse(model.config);
          } catch (e) {
            modelConfig = {};
          }
        } else {
          modelConfig = model.config;
        }
      }
      const configToUse = {
        ...defaultConfig,
        ...modelConfig
      };
      
      await chatbotService.bindModelToChatbot(chatbot.id, model.id, selectingModelType, configToUse);
      message.success('模型绑定成功');
      setIsModelSelectModalVisible(false);
      fetchBoundModels(chatbot.id);
      // 绑定操作已经通过API保存，不需要提示用户
    } catch (error) {
      console.error('Failed to bind model:', error);
      message.error('模型绑定失败');
    }
  };

  const handleUnbindModel = async (modelType: string) => {
    if (!chatbot) return;
    try {
      await chatbotService.unbindModelFromChatbot(chatbot.id, modelType);
      message.success('模型解绑成功');
      fetchBoundModels(chatbot.id);
      // 解绑操作已经通过API保存，不需要提示用户
    } catch (error) {
      console.error('Failed to unbind model:', error);
      message.error('模型解绑失败');
    }
  };

  const handleViewModel = async (modelType: string) => {
    if (!chatbot) return;
    try {
      const model = await chatbotService.getChatbotModelByType(chatbot.id, modelType);
      setCurrentModel(model);
      setViewModelDrawerVisible(true);
    } catch (error) {
      console.error('Failed to fetch model:', error);
      message.error('获取模型信息失败');
    }
  };

  const handleOpenConfig = (modelType: string, model: any) => {
    setEditingModelType(modelType);
    let config = {};
    if (model.config) {
      if (typeof model.config === 'string') {
        try {
          config = JSON.parse(model.config);
        } catch (e) {
          config = {};
        }
      } else {
        config = model.config;
      }
    }
    setModelConfig(config);
    setConfigPopoverVisible(modelType);
  };

  const handleCloseConfig = () => {
    setConfigPopoverVisible(null);
  };

  const handleSaveConfig = async () => {
    if (!chatbot || !editingModelType) return;
    try {
      await chatbotService.updateModelConfig(chatbot.id, editingModelType, modelConfig);
      message.success('模型配置更新成功');
      setConfigPopoverVisible(null);
      fetchBoundModels(chatbot.id);
    } catch (error) {
      console.error('Failed to update model config:', error);
      message.error('模型配置更新失败');
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setModelConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 提示词相关处理函数
  const handleSelectPrompt = (promptType: string, mode: string) => {
    setSelectingPromptType(promptType);
    setPromptSelectMode(mode);
    setIsPromptSelectModalVisible(true);
    if (mode === 'manual') {
      setManualPromptContent('');
    }
  };

  const handleBindPromptFromLibrary = async (promptId: string) => {
    if (!chatbot) return;
    try {
      await chatbotService.bindPromptToChatbot(chatbot.id, {
        prompt_type: selectingPromptType,
        prompt_source: 'library',
        prompt_id: promptId
      });
      message.success('提示词绑定成功');
      setIsPromptSelectModalVisible(false);
      fetchBoundPrompts(chatbot.id);
    } catch (error) {
      console.error('Failed to bind prompt:', error);
      message.error('提示词绑定失败');
    }
  };

  const handleBindPromptManual = async () => {
    if (!chatbot) return;
    if (!manualPromptContent.trim()) {
      message.error('请输入提示词内容');
      return;
    }
    try {
      await chatbotService.bindPromptToChatbot(chatbot.id, {
        prompt_type: selectingPromptType,
        prompt_source: 'manual',
        prompt_content: manualPromptContent
      });
      message.success('提示词绑定成功');
      setIsPromptSelectModalVisible(false);
      setManualPromptContent('');
      fetchBoundPrompts(chatbot.id);
    } catch (error) {
      console.error('Failed to bind prompt:', error);
      message.error('提示词绑定失败');
    }
  };

  const handleUnbindPrompt = async (promptBindingId: string) => {
    if (!chatbot) return;
    try {
      await chatbotService.unbindPromptFromChatbot(chatbot.id, promptBindingId);
      message.success('提示词解绑成功');
      fetchBoundPrompts(chatbot.id);
    } catch (error) {
      console.error('Failed to unbind prompt:', error);
      message.error('提示词解绑失败');
    }
  };

  const handleViewPrompt = (prompt: Prompt) => {
    setCurrentViewPrompt(prompt);
    setIsPromptViewModalVisible(true);
  };

  const handleEditPrompt = (prompt: any) => {
    setEditingPrompt(prompt);
    setEditingPromptContent(prompt.prompt_content || '');
    setIsPromptEditModalVisible(true);
  };

  const handleSaveEditPrompt = async () => {
    if (!chatbot || !editingPrompt) return;
    if (!editingPromptContent.trim()) {
      message.error('请输入提示词内容');
      return;
    }
    try {
      await chatbotService.bindPromptToChatbot(chatbot.id, {
        prompt_type: editingPrompt.prompt_type,
        prompt_source: 'manual',
        prompt_content: editingPromptContent,
        prompt_binding_id: editingPrompt.id
      });
      message.success('提示词更新成功');
      setIsPromptEditModalVisible(false);
      setEditingPrompt(null);
      setEditingPromptContent('');
      fetchBoundPrompts(chatbot.id);
    } catch (error) {
      console.error('Failed to update prompt:', error);
      message.error('提示词更新失败');
    }
  };

  const handleMovePromptUp = async (prompt: any, promptType: string) => {
    if (!chatbot) return;
    try {
      const prompts = boundPrompts[promptType];
      const index = prompts.findIndex((p: any) => p.id === prompt.id);
      if (index > 0) {
        const newSortOrder = prompt.sort_order || 0;
        await chatbotService.updatePromptSortOrder(chatbot.id, prompt.id, newSortOrder - 1);
        await chatbotService.updatePromptSortOrder(chatbot.id, prompts[index - 1].id, newSortOrder + 1);
        fetchBoundPrompts(chatbot.id);
      }
    } catch (error) {
      console.error('Failed to move prompt:', error);
      message.error('移动提示词失败');
    }
  };

  const handleMovePromptDown = async (prompt: any, promptType: string) => {
    if (!chatbot) return;
    try {
      const prompts = boundPrompts[promptType];
      const index = prompts.findIndex((p: any) => p.id === prompt.id);
      if (index < prompts.length - 1) {
        const newSortOrder = prompt.sort_order || 0;
        await chatbotService.updatePromptSortOrder(chatbot.id, prompt.id, newSortOrder + 1);
        await chatbotService.updatePromptSortOrder(chatbot.id, prompts[index + 1].id, newSortOrder - 1);
        fetchBoundPrompts(chatbot.id);
      }
    } catch (error) {
      console.error('Failed to move prompt:', error);
      message.error('移动提示词失败');
    }
  };

  const getPromptAddMenu = (promptType: string): MenuProps['items'] => {
    return [
      {
        key: 'manual',
        icon: <EditOutlined />,
        label: '手动输入',
        onClick: () => handleSelectPrompt(promptType, 'manual')
      },
      {
        key: 'library',
        icon: <AppstoreOutlined />,
        label: '从提示词库选择',
        onClick: () => handleSelectPrompt(promptType, 'library')
      }
    ];
  };

  const getSourceConfigFields = () => {
    const sourceType = sourceTypes.find(st => st.source_type === selectedSourceType);
    if (!sourceType) return [];
    return sourceType.config_fields || [];
  };

  const handleSourceConfigChange = (field: string, value: string) => {
    setSourceConfig(prev => {
      const newConfig = {
        ...prev,
        [field]: value
      };
      if (field === 'base_url' && newConfig.path) {
        newConfig.url = `${value}${newConfig.path}`;
      }
      return newConfig;
    });
    setHasChanges(true);
  };

  const generateToken = () => {
    const token = generateRandomString(32);
    setSourceConfig(prev => ({
      ...prev,
      token: token
    }));
    setHasChanges(true);
  };

  const generateEncodingAESKey = () => {
    const encodingAESKey = generateRandomString(43);
    setSourceConfig(prev => ({
      ...prev,
      encoding_aes_key: encodingAESKey
    }));
    setHasChanges(true);
  };

  const handleValuesChange = () => {
    const currentValues = form.getFieldsValue();
    const changed = Object.keys(currentValues).some(key => {
      return JSON.stringify(currentValues[key]) !== JSON.stringify(originalData[key as keyof typeof originalData]);
    });
    setHasChanges(changed);
  };

  const handleRestore = () => {
    form.setFieldsValue(originalData);
    setAvatarPreview(originalData.avatar || '');
    setSelectedPromptId(originalData.prompt_id);
    setSelectedKnowledgeIds(originalData.knowledge_ids || []);
    setSelectedModelId(originalData.model_id);
    setSelectedMcpIds(originalData.mcp_ids ? originalData.mcp_ids.map(id => String(id)) : []);
    setSelectedSourceType(originalData.source_type || 'local');
    if (originalData.source_config) {
      try {
        setSourceConfig(JSON.parse(originalData.source_config));
      } catch (e) {
        setSourceConfig({});
      }
    } else {
      setSourceConfig({});
    }
    setHasChanges(false);
    message.info('已恢复原始数据');
  };

  const handleSave = async () => {
    if (!chatbot) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const sourceConfigFields = getSourceConfigFields();
      const updateData = {
        ...values,
        avatar: avatarPreview,
        prompt_id: selectedPromptId,
        knowledge_ids: selectedKnowledgeIds,
        model_id: selectedModelId,
        mcp_ids: selectedMcpIds.map(id => parseInt(id)),
        source_config: selectedSourceType && sourceConfigFields.length > 0 ? JSON.stringify(sourceConfig) : undefined
      };
      await chatbotService.updateChatbot(chatbot.id, updateData);
      setOriginalData({
        ...values,
        prompt_id: selectedPromptId,
        knowledge_ids: selectedKnowledgeIds,
        model_id: selectedModelId,
        mcp_ids: selectedMcpIds.map(id => parseInt(id)),
        source_config: selectedSourceType && sourceConfigFields.length > 0 ? JSON.stringify(sourceConfig) : undefined
      });
      setHasChanges(false);
      message.success('保存成功');
    } catch (error) {
      console.error('Failed to save:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Modal.confirm({
        title: '确认离开',
        content: '您有未保存的更改，确定要离开吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          navigate('/chatbots');
        }
      });
    } else {
      navigate('/chatbots');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/*',
    beforeUpload: (file) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('只能上传图片文件！');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('图片大小不能超过 5MB！');
        return false;
      }
      return true;
    },
    customRequest: ({ file, onSuccess }) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setAvatarPreview(base64);
        form.setFieldValue('avatar', base64);
        handleValuesChange();
      };
      reader.readAsDataURL(file as Blob);
      if (onSuccess) {
        onSuccess({ status: 'done' }, file);
      }
    },
  };

  const buildCategoryTreeSelectData = () => {
    return categories.map(category => ({
      title: category.name,
      value: category.id,
      children: category.children?.map(child => ({
        title: child.name,
        value: child.id
      }))
    }));
  };

  if (loading) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className="loading-container">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader
        items={[
          { title: '机器人管理', icon: <RobotOutlined />, onClick: () => navigate('/chatbots') },
          { title: '机器人配置' },
          { title: chatbot?.name || '' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回列表
          </Button>
        }
      />

      <div className="chatbot-setting-container" style={{ display: 'flex', gap: '8px', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
        {/* 左侧基本信息 */}
        <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-scrollbar-inner::-webkit-scrollbar { display: none; } .hide-scrollbar-inner { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
          <div 
            className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{ 
              padding: '16px', 
              borderRadius: '4px', 
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>基本信息</h3>
            </div>
            
            <Form 
              form={form} 
              layout="vertical"
              onValuesChange={handleValuesChange}
              style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
              className="hide-scrollbar-inner"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                    <Input placeholder="请输入名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                    <Input placeholder="请输入编码（字母、数字、下划线）" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="source_type" label="来源">
                    <Select placeholder="请选择来源" disabled>
                      {sourceTypes.map(source => (
                        <Option key={source.source_type} value={source.source_type}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img 
                              src={sourceTypeIcons[source.source_type]} 
                              alt="" 
                              style={{ 
                                width: 16, 
                                height: 16,
                                filter: theme === 'dark' ? 'invert(1) brightness(100%)' : 'none'
                              }} 
                            />
                            <span>{source.source_name}</span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="category_id" label="分类">
                    <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
                  </Form.Item>
                </Col>
              </Row>
              {selectedSourceType && getSourceConfigFields().map(field => (
                <Form.Item
                  key={field.name}
                  label={field.title}
                  rules={field.required ? [{ required: true, message: `请输入${field.title}` }] : []}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input 
                      placeholder={field.description} 
                      value={sourceConfig[field.name]}
                      onChange={(e) => handleSourceConfigChange(field.name, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {selectedSourceType === 'work_weixin' && (field.name === 'token' || field.name === 'encoding_aes_key') && (
                      <Button 
                        onClick={field.name === 'token' ? generateToken : generateEncodingAESKey}
                        size="small"
                      >
                        随机生成
                      </Button>
                    )}
                  </div>
                </Form.Item>
              ))}
              <Form.Item name="greeting" label="欢迎语" rules={[{ required: true, message: '请输入欢迎语' }]}>
                <TextArea rows={2} placeholder="请输入欢迎语" />
              </Form.Item>
              <Form.Item name="avatar" label="头像">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {avatarPreview && (
                    <img 
                      src={avatarPreview} 
                      alt="头像预览" 
                      style={{ 
                        width: 48, 
                        height: 48, 
                        borderRadius: '50%', 
                        objectFit: 'cover',
                        border: '2px solid #d9d9d9'
                      }} 
                    />
                  )}
                  <Upload {...uploadProps} maxCount={1}>
                    <Button icon={<UploadOutlined />} size="small">上传</Button>
                  </Upload>
                </div>
              </Form.Item>
              <Form.Item name="description" label="描述">
                <TextArea rows={2} placeholder="请输入描述" />
              </Form.Item>
            </Form>
            <div style={{ 
              marginTop: '16px', 
              paddingTop: '16px', 
              borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px'
            }}>
              <Button 
                icon={<UndoOutlined />}
                onClick={handleRestore}
                disabled={!hasChanges}
              >
                恢复
              </Button>
              <Button 
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges}
              >
                保存
              </Button>
            </div>
          </div>
        </div>

        {/* 右侧配置区域 */}
        <div style={{ width: '70%', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
          
          {/* 绑定模型 */}
          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ApiOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>绑定模型</span>
              {!Object.keys(boundModels).length && (
                <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>（至少绑定一个模型）</span>
              )}
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {MODEL_TYPES_TO_BIND.map(modelTypeInfo => {
                const boundModel = boundModels[modelTypeInfo.type];
                return (
                  <div key={modelTypeInfo.type} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px',
                    padding: '8px 12px',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                    borderRadius: '4px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                  }}>
                    <div style={{ 
                      minWidth: '80px', 
                      fontSize: '13px', 
                      fontWeight: 500,
                      color: theme === 'dark' ? '#fff' : '#000'
                    }}>
                      {modelTypeInfo.name}：
                    </div>
                    
                    {boundModel ? (
                      <>
                        <div style={{ 
                          flex: 1, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px' 
                        }}>
                          <img 
                            src={getProviderAvatar(boundModel.provider || '')}
                            alt={boundModel.provider}
                            style={{ 
                              width: 28, 
                              height: 28, 
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/src/assets/llm/default.svg';
                            }}
                          />
                          <div style={{ 
                            flex: 1, 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px' 
                          }}>
                            <span style={{ fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>
                              {boundModel.name}
                            </span>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {boundModel.tags && boundModel.tags.map((tag: string, index: number) => (
                                <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                  {tag}
                                </Tag>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => handleViewModel(modelTypeInfo.type)}
                          title="查看模型"
                        />
                        <div style={{ position: 'relative' }}>
                          <Button
                            type="text"
                            icon={<SettingOutlined />}
                            size="small"
                            onClick={() => handleOpenConfig(modelTypeInfo.type, boundModel)}
                            title="配置模型"
                          />
                          {/* 模型配置气泡卡片 */}
                          {configPopoverVisible === modelTypeInfo.type && (
                            <div style={{
                              position: 'absolute',
                              right: '0',
                              top: '100%',
                              marginTop: '4px',
                              zIndex: 1000,
                              backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
                              border: '1px solid #d9d9d9',
                              borderRadius: '4px',
                              padding: '16px',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                              minWidth: '400px'
                            }}>
                              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                                  模型配置
                                </h4>
                                <Button
                                  type="text"
                                  icon={<CloseOutlined />}
                                  size="small"
                                  onClick={handleCloseConfig}
                                />
                              </div>
                              <div style={{ marginBottom: '16px' }}>
                                <Form layout="horizontal" labelCol={{ span: 8 }} wrapperCol={{ span: 16 }}>
                                  {configParams[editingModelType]?.map((param: any) => {
                                    const paramKey = param.key;
                                    const value = modelConfig[paramKey] !== undefined ? modelConfig[paramKey] : param.default;
                                    return (
                                      <Form.Item key={paramKey} label={param.label} tooltip={param.description}>
                                        {param.type === 'number' ? (
                                          <InputNumber
                                            min={param.min}
                                            max={param.max}
                                            step={param.step}
                                            value={value}
                                            onChange={(value) => handleConfigChange(paramKey, value)}
                                            style={{ width: '100%' }}
                                          />
                                        ) : param.type === 'slider' ? (
                                          <>
                                            <Slider
                                              min={param.min}
                                              max={param.max}
                                              step={param.step}
                                              value={value}
                                              onChange={(value) => handleConfigChange(paramKey, value)}
                                              style={{ width: '100%' }}
                                            />
                                            <div style={{ marginTop: '8px', fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', textAlign: 'center' }}>
                                              {value}
                                            </div>
                                          </>
                                        ) : param.type === 'boolean' ? (
                                          <Switch
                                            checked={value}
                                            onChange={(checked) => handleConfigChange(paramKey, checked)}
                                          />
                                        ) : (
                                          <Input
                                            value={value}
                                            onChange={(e) => handleConfigChange(paramKey, e.target.value)}
                                            style={{ width: '100%' }}
                                          />
                                        )}
                                      </Form.Item>
                                    );
                                  })}
                                </Form>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <Button size="small" onClick={handleCloseConfig}>
                                  取消
                                </Button>
                                <Button type="primary" size="small" onClick={handleSaveConfig}>
                                  保存
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          size="small"
                          danger
                          onClick={() => handleUnbindModel(modelTypeInfo.type)}
                          title="解绑模型"
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          未绑定
                        </div>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          size="small"
                          onClick={() => handleSelectModel(modelTypeInfo.type)}
                        >
                          选择模型
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 提示词 */}
          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileTextOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>提示词</span>
            </div>
            
            {/* 系统提示词 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                marginBottom: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>系统提示词</span>
                  <Tooltip title="多个系统提示词会拼接成一个发送给大模型">
                    <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                  </Tooltip>
                </div>
                <Dropdown menu={{ items: getPromptAddMenu('system') }} placement="bottomRight">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                  >
                    添加
                  </Button>
                </Dropdown>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {boundPrompts.system.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '12px', 
                    color: theme === 'dark' ? '#aaa' : '#999', 
                    fontSize: '12px',
                    border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.2)' : '1px dashed #d9d9d9',
                    borderRadius: '4px'
                  }}>
                    暂未绑定系统提示词
                  </div>
                ) : (
                  boundPrompts.system.map((prompt: any) => (
                    <div key={prompt.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      padding: '8px 12px',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                      borderRadius: '4px',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                    }}>
                      {prompt.prompt_source === 'library' ? (
                        <>
                          <FileTextOutlined style={{ fontSize: '14px', color: '#52c41a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                              {prompt.name}
                            </span>
                            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                              {prompt.description}
                            </span>
                            {prompt.tags && prompt.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {prompt.tags.map((tag: string, index: number) => (
                                  <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                    {tag}
                                  </Tag>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            type="text"
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => handleViewPrompt(prompt)}
                            title="查看提示词"
                          />
                        </>
                      ) : (
                        <>
                          <FormOutlined style={{ fontSize: '14px', color: '#faad14', flexShrink: 0 }} />
                          <Tooltip title={prompt.prompt_content || ''}>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <div style={{ 
                                fontSize: '13px', 
                                color: theme === 'dark' ? '#fff' : '#000',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textAlign: 'left'
                              }}>
                                {prompt.prompt_content}
                              </div>
                            </div>
                          </Tooltip>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleEditPrompt(prompt)}
                            title="编辑提示词"
                          />
                        </>
                      )}
                      <Button
                        type="text"
                        icon={<UpOutlined />}
                        size="small"
                        onClick={() => handleMovePromptUp(prompt, 'system')}
                        title="上移"
                      />
                      <Button
                        type="text"
                        icon={<DownOutlined />}
                        size="small"
                        onClick={() => handleMovePromptDown(prompt, 'system')}
                        title="下移"
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        size="small"
                        danger
                        onClick={() => handleUnbindPrompt(prompt.id)}
                        title="解绑提示词"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* 用户提示词 */}
            <div>
              <div style={{ 
                marginBottom: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000'  }}>用户提示词</span>
                  <Tooltip title="多个用户提示词会组装成多条用户消息发送给大模型">
                    <QuestionCircleOutlined style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'help' }} />
                  </Tooltip>
                </div>
                <Dropdown menu={{ items: getPromptAddMenu('user') }} placement="bottomRight">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                  >
                    添加
                  </Button>
                </Dropdown>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {boundPrompts.user.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '12px', 
                    color: theme === 'dark' ? '#aaa' : '#999', 
                    fontSize: '12px',
                    border: theme === 'dark' ? '1px dashed rgba(255, 255, 255, 0.2)' : '1px dashed #d9d9d9',
                    borderRadius: '4px'
                  }}>
                    暂未绑定用户提示词
                  </div>
                ) : (
                  boundPrompts.user.map((prompt: any) => (
                    <div key={prompt.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      padding: '8px 12px',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                      borderRadius: '4px',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                    }}>
                      {prompt.prompt_source === 'library' ? (
                        <>
                          <FileTextOutlined style={{ fontSize: '14px', color: '#52c41a', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-start' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                              {prompt.name}
                            </span>
                            <span style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                              {prompt.description}
                            </span>
                            {prompt.tags && prompt.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {prompt.tags.map((tag: string, index: number) => (
                                  <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                                    {tag}
                                  </Tag>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            type="text"
                            icon={<EyeOutlined />}
                            size="small"
                            onClick={() => handleViewPrompt(prompt)}
                            title="查看提示词"
                          />
                        </>
                      ) : (
                        <>
                          <FormOutlined style={{ fontSize: '14px', color: '#faad14', flexShrink: 0 }} />
                          <Tooltip title={prompt.prompt_content || ''}>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <div style={{ 
                                fontSize: '13px', 
                                color: theme === 'dark' ? '#fff' : '#000',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                textAlign: 'left'
                              }}>
                                {prompt.prompt_content}
                              </div>
                            </div>
                          </Tooltip>
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            size="small"
                            onClick={() => handleEditPrompt(prompt)}
                            title="编辑提示词"
                          />
                        </>
                      )}
                      <Button
                        type="text"
                        icon={<UpOutlined />}
                        size="small"
                        onClick={() => handleMovePromptUp(prompt, 'user')}
                        title="上移"
                      />
                      <Button
                        type="text"
                        icon={<DownOutlined />}
                        size="small"
                        onClick={() => handleMovePromptDown(prompt, 'user')}
                        title="下移"
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        size="small"
                        danger
                        onClick={() => handleUnbindPrompt(prompt.id)}
                        title="解绑提示词"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 关联工具 */}
          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ToolOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>关联工具</span>
            </div>
            
            {boundTools.length === 0 ? (
              <div 
                style={{ 
                  textAlign: 'center', 
                  padding: '32px 0', 
                  color: theme === 'dark' ? '#aaa' : '#999', 
                  fontSize: '14px',
                  border: theme === 'dark' ? '2px dashed rgba(255, 255, 255, 0.2)' : '2px dashed #d9d9d9',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onClick={handleSelectTool}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#667eea';
                  e.currentTarget.style.color = '#667eea';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d9d9d9';
                  e.currentTarget.style.color = theme === 'dark' ? '#aaa' : '#999';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  <PlusOutlined />
                </div>
                <div>点击添加工具</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {boundTools.map(server => (
                  <div key={server.server_id} style={{
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                    borderRadius: '4px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                  }}>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8'
                      }}
                      onClick={() => handleToggleServerExpand(server.server_id)}
                    >
                      <Avatar 
                        size={24} 
                        src={server.server_avatar} 
                        icon={<ApiOutlined />}
                        style={{ backgroundColor: '#667eea', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                          {server.server_name}
                        </div>
                        <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          {server.server_code}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                        {server.tools.length} 个工具
                      </div>
                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                        {expandedServers.includes(server.server_id) ? '▼' : '▶'}
                      </div>
                    </div>
                    {expandedServers.includes(server.server_id) && (
                      <div style={{ padding: '8px 12px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {server.tools.map((tool: any) => (
                            <div key={tool.id} style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              padding: '12px',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #f0f0f0',
                              borderRadius: '4px',
                              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>
                                    {tool.tool_title || tool.tool_name}
                                  </div>
                                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', textAlign: 'left' }}>
                                    {tool.tool_name}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                                    {tool.tool_type}
                                  </div>
                                  <Button
                                    type="text"
                                    icon={<DeleteOutlined />}
                                    size="small"
                                    danger
                                    onClick={() => handleUnbindTool(tool.id)}
                                    title="解绑工具"
                                  />
                                </div>
                              </div>
                              {tool.tool_description && (
                                <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', marginTop: '4px', textAlign: 'left' }}>
                                  {tool.tool_description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={handleSelectTool}
                >
                  添加工具
                </Button>
              </div>
            )}
          </div>

          {/* 关联知识库 */}
          <div style={{ 
            padding: '16px', 
            borderRadius: '4px', 
            border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9', 
            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
          }}>
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DatabaseOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>关联知识库</span>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>（多选）</span>
            </div>
            
            {knowledges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                暂无可用知识库
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {knowledges.map(knowledge => (
                  <div
                    key={knowledge.id}
                    onClick={() => {
                      const newSelectedIds = selectedKnowledgeIds.includes(knowledge.id)
                        ? selectedKnowledgeIds.filter(id => id !== knowledge.id)
                        : [...selectedKnowledgeIds, knowledge.id];
                      setSelectedKnowledgeIds(newSelectedIds);
                      setHasChanges(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${selectedKnowledgeIds.includes(knowledge.id) ? '#52c41a' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#d9d9d9')}`,
                      borderRadius: '4px',
                      background: selectedKnowledgeIds.includes(knowledge.id) 
                        ? (theme === 'dark' ? 'rgba(82, 196, 26, 0.1)' : 'rgba(82, 196, 26, 0.05)')
                        : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <Avatar 
                      size={24} 
                      icon={<DatabaseOutlined />}
                      style={{ backgroundColor: '#52c41a', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>
                      {knowledge.name}
                    </div>
                    {selectedKnowledgeIds.includes(knowledge.id) && (
                      <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 模型选择弹窗 */}
      <Modal
        title={`选择${MODEL_TYPES_TO_BIND.find(t => t.type === selectingModelType)?.name || '模型'}`}
        open={isModelSelectModalVisible}
        onCancel={() => setIsModelSelectModalVisible(false)}
        footer={null}
        width={600}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {availableModels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
            暂无可用模型
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {availableModels.map(model => (
              <div
                key={model.id}
                onClick={() => handleBindModel(model)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                  borderRadius: '4px',
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5';
                  e.currentTarget.style.borderColor = '#faad14';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff';
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8';
                }}
              >
                <img 
                  src={getProviderAvatar(model.provider || '')}
                  alt={model.provider}
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/src/assets/llm/default.svg';
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                    {model.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', marginTop: '4px' }}>
                    {model.provider}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {model.tags && (Array.isArray(model.tags) ? model.tags : JSON.parse(model.tags)).map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* 提示词选择弹窗 */}
      <Modal
        title={promptSelectMode === 'manual' ? '手动输入提示词' : '从提示词库选择'}
        open={isPromptSelectModalVisible}
        onCancel={() => {
          setIsPromptSelectModalVisible(false);
          setManualPromptContent('');
        }}
        footer={promptSelectMode === 'manual' ? [
          <Button key="cancel" onClick={() => {
            setIsPromptSelectModalVisible(false);
            setManualPromptContent('');
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleBindPromptManual}>
            确定
          </Button>
        ] : null}
        width={800}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {promptSelectMode === 'manual' ? (
          <div style={{ minHeight: '400px' }} className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
            <MDEditor
              value={manualPromptContent}
              onChange={(value) => setManualPromptContent(value || '')}
              height={400}
              preview="edit"
              placeholder="请输入提示词"
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000'
              }}
            />
          </div>
        ) : (
          <>
            {prompts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                暂无可用提示词
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
                {prompts.map(prompt => (
                  <div
                    key={prompt.id}
                    onClick={() => handleBindPromptFromLibrary(prompt.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                      borderRadius: '4px',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5';
                      e.currentTarget.style.borderColor = '#faad14';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff';
                      e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e8e8e8';
                    }}
                  >
                    <Avatar 
                      size={32} 
                      icon={<FileTextOutlined />}
                      style={{ backgroundColor: '#52c41a', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                        {prompt.name}
                      </div>
                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', marginTop: '4px' }}>
                        {prompt.description}
                      </div>
                    </div>
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {prompt.tags.map((tag: string, index: number) => (
                          <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    )}
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewPrompt(prompt);
                      }}
                      title="查看提示词"
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* 模型查看抽屉 */}
      <Drawer
        title="模型详情"
        placement="right"
        onClose={() => setViewModelDrawerVisible(false)}
        open={viewModelDrawerVisible}
        width={600}
        getContainer={false}
        className={`chatbot-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {currentModel && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <img 
                src={getProviderAvatar(currentModel.provider || '')}
                alt={currentModel.provider}
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/src/assets/llm/default.svg';
                }}
              />
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                  {currentModel.name}
                </h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                  {currentModel.provider} · {MODEL_TYPE_MAP[currentModel.model_type] || currentModel.model_type}
                </p>
              </div>
            </div>
            
            <Descriptions column={1} bordered>
              <Descriptions.Item label="模型类型">
                {MODEL_TYPE_MAP[currentModel.model_type] || currentModel.model_type}
              </Descriptions.Item>
              <Descriptions.Item label="端点地址">
                {currentModel.endpoint}
              </Descriptions.Item>
              <Descriptions.Item label="API Key">
                {currentModel.api_key ? '••••••••' : '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="支持图片">
                {currentModel.support_image ? '是' : '否'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {currentModel.status ? '启用' : '禁用'}
              </Descriptions.Item>
              <Descriptions.Item label="标签">
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {currentModel.tags && Array.isArray(currentModel.tags) ? currentModel.tags.map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px' }}>
                      {tag}
                    </Tag>
                  )) : currentModel.tags && typeof currentModel.tags === 'string' ? JSON.parse(currentModel.tags).map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px' }}>
                      {tag}
                    </Tag>
                  )) : null}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="配置">
                <pre style={{ 
                  fontSize: '12px', 
                  color: theme === 'dark' ? '#ccc' : '#333',
                  backgroundColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                  padding: '12px',
                  borderRadius: '4px',
                  overflowX: 'auto'
                }}>
                  {JSON.stringify(currentModel.config || {}, null, 2)}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {currentModel.created_at}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {currentModel.updated_at || '未更新'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 提示词查看弹窗 */}
      <Modal
        title="提示词详情"
        open={isPromptViewModalVisible}
        onCancel={() => setIsPromptViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsPromptViewModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {currentViewPrompt && (
          <div style={{ minHeight: '400px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                {currentViewPrompt.name}
              </h3>
              <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                {currentViewPrompt.description}
              </p>
              {currentViewPrompt.tags && currentViewPrompt.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {currentViewPrompt.tags.map((tag: string, index: number) => (
                    <Tag key={index} color="blue" style={{ fontSize: '10px', padding: '0 4px' }}>
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', marginBottom: '8px' }}>
                提示词内容
              </h4>
              <div 
                className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}
                style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
                  borderRadius: '8px',
                  padding: '16px',
                  border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
                  minHeight: '300px'
                }}
              >
                <MDEditor.Markdown
                  source={currentViewPrompt.prompt_content || currentViewPrompt.content || ''}
                  className={`md-editor ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 提示词编辑弹窗 */}
      <Modal
        title="编辑提示词"
        open={isPromptEditModalVisible}
        onCancel={() => {
          setIsPromptEditModalVisible(false);
          setEditingPrompt(null);
          setEditingPromptContent('');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsPromptEditModalVisible(false);
            setEditingPrompt(null);
            setEditingPromptContent('');
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSaveEditPrompt}>
            保存
          </Button>
        ]}
        width={800}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div style={{ minHeight: '400px' }} className={`md-editor-container ${theme === 'dark' ? 'dark' : 'light'}`}>
          <MDEditor
            value={editingPromptContent}
            onChange={(value) => setEditingPromptContent(value || '')}
            height={400}
            preview="edit"
            placeholder="请输入提示词内容"
            style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
              color: theme === 'dark' ? '#fff' : '#000'
            }}
          />
        </div>
      </Modal>

      {/* 工具选择弹窗 */}
      <Modal
        title="选择工具"
        open={isToolSelectModalVisible}
        onCancel={() => {
          setIsToolSelectModalVisible(false);
          setServerFilter('');
          setToolFilter('');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsToolSelectModalVisible(false);
            setServerFilter('');
            setToolFilter('');
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleBindTools}>
            绑定
          </Button>
        ]}
        width={800}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {/* 过滤输入框 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <Input
            placeholder="搜索服务名称"
            value={serverFilter}
            onChange={(e) => setServerFilter(e.target.value)}
            style={{ flex: 1 }}
          />
          <Input
            placeholder="搜索工具名称"
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>
        
        {mcpServersWithTools.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
            暂无可用MCP服务
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {mcpServersWithTools
              .filter(server => 
                server.name.toLowerCase().includes(serverFilter.toLowerCase()) ||
                server.code.toLowerCase().includes(serverFilter.toLowerCase())
              )
              .map(server => {
                // 过滤工具
                const filteredTools = server.tools.filter((tool: any) => 
                  (tool.title || tool.name).toLowerCase().includes(toolFilter.toLowerCase()) ||
                  tool.name.toLowerCase().includes(toolFilter.toLowerCase()) ||
                  (tool.description || tool.tool_description)?.toLowerCase().includes(toolFilter.toLowerCase()) ||
                  (tool.code || tool.tool_code)?.toLowerCase().includes(toolFilter.toLowerCase()) ||
                  (tool.tool_type && tool.tool_type.toLowerCase().includes(toolFilter.toLowerCase()))
                );
                
                // 如果工具过滤后为空，且用户输入了工具过滤条件，则不显示该服务
                if (toolFilter && filteredTools.length === 0) {
                  return null;
                }
                
                return (
                  <div key={server.id} style={{
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                    borderRadius: '4px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff'
                  }}>
                    <div 
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8'
                      }}
                      onClick={() => setExpandedModalServers(prev => 
                        prev.includes(server.id) 
                          ? prev.filter(id => id !== server.id) 
                          : [...prev, server.id]
                      )}
                    >
                      <Avatar 
                        size={24} 
                        src={server.avatar} 
                        icon={<ApiOutlined />}
                        style={{ backgroundColor: '#667eea', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                          {server.name}
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          {server.code}
                        </div>
                      </div>
                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                        {filteredTools.length} 个工具
                      </div>
                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                        {expandedModalServers.includes(server.id) ? '▼' : '▶'}
                      </div>
                    </div>
                    {expandedModalServers.includes(server.id) && (
                      <div style={{ padding: '8px 12px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
                        {filteredTools.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => {
                                // 全选
                                setSelectedTools(prev => ({
                                  ...prev,
                                  [server.id]: filteredTools.map(tool => tool.id)
                                }));
                              }}
                            >
                              全选
                            </Button>
                            <Button
                              type="text"
                              size="small"
                              onClick={() => {
                                // 反选
                                const currentSelected = selectedTools[server.id] || [];
                                const allToolIds = filteredTools.map(tool => tool.id);
                                const newSelected = allToolIds.filter(id => !currentSelected.includes(id));
                                setSelectedTools(prev => ({
                                  ...prev,
                                  [server.id]: newSelected
                                }));
                              }}
                            >
                              反选
                            </Button>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {filteredTools.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                              没有匹配的工具
                            </div>
                          ) : (
                            filteredTools.map((tool: any) => (
                              <div key={tool.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                padding: '12px',
                                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #f0f0f0',
                                borderRadius: '4px',
                                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                  <input
                                    type="checkbox"
                                    checked={(selectedTools[server.id] || []).includes(tool.id)}
                                    onChange={() => handleToolSelect(server.id, tool.id)}
                                    style={{
                                      accentColor: '#667eea',
                                      marginTop: '2px'
                                    }}
                                  />
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                                      {tool.title || tool.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                                      {tool.name}
                                    </div>
                                    {(tool.description || tool.tool_description) && (
                                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', marginTop: '4px' }}>
                                        {tool.description || tool.tool_description}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999', alignSelf: 'flex-start', marginTop: '2px' }}>
                                    {tool.tool_type}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChatbotSetting;
