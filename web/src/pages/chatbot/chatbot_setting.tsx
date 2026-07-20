import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Upload, Spin, Tag, Avatar, Modal, Table, Slider, InputNumber, Switch, Drawer, Descriptions, Dropdown, Tooltip, Tabs, Anchor } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, UploadOutlined, RobotOutlined, FileTextOutlined, DatabaseOutlined, ToolOutlined, ApiOutlined, CheckCircleOutlined, EyeOutlined, EyeInvisibleOutlined, DeleteOutlined, PlusOutlined, SettingOutlined, CloseOutlined, EditOutlined, AppstoreOutlined, QuestionCircleOutlined, FormOutlined, UpOutlined, DownOutlined, CopyOutlined, ReloadOutlined, CodeOutlined, GlobalOutlined, DownloadOutlined, LinkOutlined, ExportOutlined, SendOutlined, MinusOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { MenuProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import ChatMarkdown from '../../components/ChatMarkdown';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { chatbotService, Chatbot, ChatbotCategory } from '../../services/chatbot';
import { promptService, Prompt } from '../../services/prompt';
import { knowledgebaseService, Knowledgebase } from '../../services/knowledgebase';
import { mcpService, MCPServer } from '../../services/mcp';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { integrationService, IntegrationConfig, IntegrationConfigsDetail, IntegrationConfigParam } from '../../services/integration';
import '../../styles/common.css';
import './chatbot_setting.less';
import { getDefaultAvatar } from '../../utils/avatar';

// 默认头像资源（从 integration/assets 目录导入）
import userAvatar1 from '../../integration/assets/user-1.svg';
import userAvatar2 from '../../integration/assets/user-2.svg';
import userAvatar3 from '../../integration/assets/user-3.svg';
import assistantAvatar1 from '../../integration/assets/assistant-1.svg';
import assistantAvatar2 from '../../integration/assets/assistant-2.svg';
import assistantAvatar3 from '../../integration/assets/assistant-3.svg';
import forbiddenIcon from '../../integration/assets/forbidden.svg';

const DEFAULT_USER_AVATARS = [
  { key: 'user-1', src: userAvatar1, label: '用户1' },
  { key: 'user-2', src: userAvatar2, label: '用户2' },
  { key: 'user-3', src: userAvatar3, label: '用户3' },
];

const DEFAULT_BOT_AVATARS = [
  { key: 'assistant-1', src: assistantAvatar1, label: '机器人1' },
  { key: 'assistant-2', src: assistantAvatar2, label: '机器人2' },
  { key: 'assistant-3', src: assistantAvatar3, label: '机器人3' },
];

// 图标 key 到导入模块的映射
const AVATAR_KEY_TO_SRC: { [key: string]: string } = {
  'forbidden': forbiddenIcon,
  'user-1': userAvatar1,
  'user-2': userAvatar2,
  'user-3': userAvatar3,
  'assistant-1': assistantAvatar1,
  'assistant-2': assistantAvatar2,
  'assistant-3': assistantAvatar3,
};

interface CodeBlockProps {
  node: any;
  inline: boolean;
  className: string;
  children: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.body.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const updatedTheme = (document.body.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(updatedTheme);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
  return getDefaultAvatar();
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
  
  const [knowledges, setKnowledges] = useState<Knowledgebase[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | undefined>(undefined);
  
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
  // 读取全局主色（与 tab 选中色保持一致）
  const primaryColor = (() => { try { return getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#5a6fd6'; } catch { return '#5a6fd6'; } })();
  const [expandedModalServers, setExpandedModalServers] = useState<string[]>([]);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [integrationConfigParams, setIntegrationConfigParams] = useState<IntegrationConfigParam[]>([]);

  const [selectedTools, setSelectedTools] = useState<Record<string, string[]>>({});
  const [serverFilter, setServerFilter] = useState<string>('');
  const [toolFilter, setToolFilter] = useState<string>('');
  
  // 知识库绑定相关state
  const [boundKnowledgebases, setBoundKnowledgebases] = useState<any[]>([]);
  const [isKnowledgebaseSelectModalVisible, setIsKnowledgebaseSelectModalVisible] = useState(false);
  const [selectedKnowledgebases, setSelectedKnowledgebases] = useState<string[]>([]);
  const [knowledgebaseFilter, setKnowledgebaseFilter] = useState<string>('');
  const [expandedKnowledgebases, setExpandedKnowledgebases] = useState<string[]>([]);
  const [knowledgebaseDocuments, setKnowledgebaseDocuments] = useState<Record<string, any[]>>({});
  const [documentConstants, setDocumentConstants] = useState<any>(null);
  const [availableKnowledgebases, setAvailableKnowledgebases] = useState<Knowledgebase[]>([]);

  // 插件集成相关state
  const [integrationData, setIntegrationData] = useState<IntegrationConfigsDetail | null>(null);
  const [integrationLoading, setIntegrationLoading] = useState(false);
  const [integrationActiveTab, setIntegrationActiveTab] = useState<string>('api');
  const [integrationCodeTab, setIntegrationCodeTab] = useState<string>('sidebar');
  const [integrationConfigValues, setIntegrationConfigValues] = useState<Record<string, any>>({});
  const [originalIntegrationConfigValues, setOriginalIntegrationConfigValues] = useState<Record<string, any>>({});
  // 发布页签锚点高亮状态
  const [pubActiveAnchor, setPubActiveAnchor] = useState<string>('preview');

  // 监听发布滚动容器，更新锚点高亮（requestAnimationFrame 防抖）
  const pubScrollRef = React.useRef<HTMLDivElement>(null);
  const pubScrollRafRef = React.useRef<number>(0);
  const onPubScroll = React.useCallback(() => {
    cancelAnimationFrame(pubScrollRafRef.current);
    pubScrollRafRef.current = requestAnimationFrame(() => {
      const container = pubScrollRef.current;
      if (!container) return;
      const containerTop = container.getBoundingClientRect().top;
      const sections = ['preview', 'code', 'download'];
      let active = 'preview';
      for (const sec of sections) {
        const el = container.querySelector(`#pub-${sec}`);
        if (el) {
          const elTop = (el as HTMLElement).getBoundingClientRect().top;
          if (elTop <= containerTop + 30) {
            active = sec;
          }
        }
      }
      setPubActiveAnchor(active);
    });
  }, []);

  // 计算集成配置是否有变动（脏状态）
  const isIntegrationDirty = React.useMemo(() => {
    if (!integrationData?.integration) return false;
    return JSON.stringify(integrationConfigValues) !== JSON.stringify(originalIntegrationConfigValues);
  }, [integrationConfigValues, originalIntegrationConfigValues, integrationData]);

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    setTheme(currentTheme as 'light' | 'dark');

    const observer = new MutationObserver(() => {
      const updatedTheme = document.body.getAttribute('data-theme') || 'light';
      setTheme(updatedTheme as 'light' | 'dark');
      fetchIntegrationConfigs(id);
      fetchIntegrationConfigParams();
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
      fetchBoundKnowledgebases(id);
      fetchDocumentConstants();
      fetchIntegrationConfigs(id);
      fetchIntegrationConfigParams();
    }
  }, [id]);

  const fetchDocumentConstants = async () => {
    try {
      const data = await knowledgebaseService.getDocumentConstants();
      setDocumentConstants(data);
    } catch (error) {
      console.error('Failed to fetch document constants:', error);
    }
  };

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

  const fetchBoundKnowledgebases = async (chatbotId: string) => {
    try {
      const knowledgebases = await chatbotService.getChatbotKnowledgebases(chatbotId);
      setBoundKnowledgebases(knowledgebases);
    } catch (error) {
      console.error('Failed to fetch bound knowledgebases:', error);
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

  const handleSelectKnowledgebase = async () => {
    setSelectedKnowledgebases([]);
    setExpandedKnowledgebases([]);
    setKnowledgebaseFilter('');
    setKnowledgebaseDocuments({});
    
    setIsKnowledgebaseSelectModalVisible(true);
    
    try {
      const result = await knowledgebaseService.getKnowledgebases(1, 100);
      setAvailableKnowledgebases(result.data || []);
    } catch (error) {
      console.error('Failed to fetch knowledgebases:', error);
      message.error('获取知识库列表失败');
    }
  };

  const handleKnowledgebaseSelect = (knowledgebaseId: string) => {
    setSelectedKnowledgebases(prev => 
      prev.includes(knowledgebaseId)
        ? prev.filter(id => id !== knowledgebaseId)
        : [...prev, knowledgebaseId]
    );
  };

  const handleToggleKnowledgebaseExpand = async (knowledgebaseId: string) => {
    const isExpanded = expandedKnowledgebases.includes(knowledgebaseId);
    
    if (isExpanded) {
      setExpandedKnowledgebases(prev => prev.filter(id => id !== knowledgebaseId));
    } else {
      setExpandedKnowledgebases(prev => [...prev, knowledgebaseId]);
      
      if (!knowledgebaseDocuments[knowledgebaseId]) {
        try {
          const result = await knowledgebaseService.getDocuments(knowledgebaseId, 1, 100, undefined, undefined, undefined, true);
          const enabledDocs = result.data.filter((doc: any) => doc.status === true);
          setKnowledgebaseDocuments(prev => ({
            ...prev,
            [knowledgebaseId]: enabledDocs
          }));
        } catch (error) {
          console.error(`Failed to fetch documents for knowledgebase ${knowledgebaseId}:`, error);
          setKnowledgebaseDocuments(prev => ({
            ...prev,
            [knowledgebaseId]: []
          }));
        }
      }
    }
  };

  const handleBindKnowledgebases = async () => {
    if (!chatbot) return;
    if (selectedKnowledgebases.length === 0) {
      message.warning('请选择要绑定的知识库');
      return;
    }
    await chatbotService.bindKnowledgebasesToChatbot(chatbot.id, selectedKnowledgebases);
    message.success('知识库绑定成功');
    setIsKnowledgebaseSelectModalVisible(false);
    fetchBoundKnowledgebases(chatbot.id);
  };

  const handleUnbindKnowledgebase = async (kbBindingId: string) => {
    if (!chatbot) return;
    try {
      await chatbotService.unbindKnowledgebaseFromChatbot(chatbot.id, kbBindingId);
      message.success('知识库解绑成功');
      fetchBoundKnowledgebases(chatbot.id);
    } catch (error) {
      console.error('Failed to unbind knowledgebase:', error);
      message.error('知识库解绑失败');
    }
  };

  const fetchIntegrationConfigParams = async () => {
    try {
      // 传递 chatbot_id，后端会将机器人头像添加到机器人头像列表
      const params = await integrationService.getConfigParams(id);
      setIntegrationConfigParams(params || []);
    } catch (error) {
      console.error('Failed to fetch integration config params:', error);
    }
  };

  // 根据CONFIG_PARAMS从 integrationData 中提取配置值
  const initConfigValues = (data: IntegrationConfigsDetail | null, params: any[]) => {
    if (!data?.configs || !params?.length) return;
    const values: Record<string, any> = {};
    const configs = data.configs;
    const flattenParams = (items: any[], prefix: string) => {
      for (const item of items) {
        const fullKey = prefix ? `${prefix}.${item.key}` : item.key;
        if (item.type === 'section' && item.children) {
          flattenParams(item.children, fullKey);
        } else {
          // 从 configs中获取值
          const parts = fullKey.split('.');
          let val: any = configs;
          for (const p of parts) {
            val = val?.[p];
          }
          values[fullKey] = val !== undefined ? val : (item.default ?? '');
        }
      }
    };
    flattenParams(params, '');
    // 标题和欢迎语为空时，使用机器人名称和欢迎语作为默认值
    if (chatbot) {
      const titleKey = 'interface_config.sidebar.title';
      const wmKey = 'chat_config.welcome_messages';
      if (!values[titleKey]) {
        values[titleKey] = chatbot.name || '';
      }
      if (!values[wmKey] || (Array.isArray(values[wmKey]) && values[wmKey].length === 0)) {
        values[wmKey] = chatbot.greeting ? [chatbot.greeting] : [];
      }
    }
    setIntegrationConfigValues(values);
    setOriginalIntegrationConfigValues(JSON.parse(JSON.stringify(values))); // 保存原始值用于恢复
  };

  const handleConfigValueChange = (key: string, value: any) => {
    setIntegrationConfigValues(prev => ({ ...prev, [key]: value }));
  };

  // 恢复集成配置到原始值
  const handleRestoreIntegrationConfigs = () => {
    setIntegrationConfigValues(JSON.parse(JSON.stringify(originalIntegrationConfigValues)));
    message.success('配置已恢复');
  };

  // 恢复到初始状态（重置到默认参数）
  const handleResetToDefault = () => {
    Modal.confirm({
      title: '确认重置？',
      content: '此操作将重置所有插件配置参数为默认值，并保存到数据库。',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        if (!chatbot) return;
        try {
          // 从配置参数定义中提取默认值
          const defaultValues: Record<string, any> = {};
          const extractDefaults = (items: any[], prefix: string = '') => {
            for (const item of items) {
              const fullKey = prefix ? `${prefix}.${item.key}` : item.key;
              if (item.type === 'section' && item.children) {
                extractDefaults(item.children, fullKey);
              } else if (item.default !== undefined) {
                defaultValues[fullKey] = item.default;
              }
            }
          };
          extractDefaults(integrationConfigParams);

          // 重建嵌套的configs对象
          const configs: Record<string, any> = {};
          for (const [fullKey, value] of Object.entries(defaultValues)) {
            const parts = fullKey.split('.');
            let obj = configs;
            for (let i = 0; i < parts.length - 1; i++) {
              if (!obj[parts[i]]) obj[parts[i]] = {};
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
          }

          await integrationService.saveIntegration(chatbot.id, { configs });
          message.success('已重置');
          // 更新配置值和原始值，不重新获取
          setIntegrationConfigValues(JSON.parse(JSON.stringify(defaultValues)));
          setOriginalIntegrationConfigValues(JSON.parse(JSON.stringify(defaultValues)));
          // 更新integrationData中的configs
          setIntegrationData(prev => prev ? { ...prev, configs: { ...prev.configs, ...configs } } : prev);
        } catch (error) {
          console.error('Failed to reset to default:', error);
          message.error('重置失败');
        }
      }
    });
  };

  const handleSaveIntegrationConfigs = async () => {
    if (!chatbot) return;
    try {
      // 从 integrationConfigValues 重建嵌套的configs对象
      const configs: Record<string, any> = {};
      for (const [fullKey, value] of Object.entries(integrationConfigValues)) {
        const parts = fullKey.split('.');
        let obj = configs;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      }
      await integrationService.saveIntegration(chatbot.id, { configs });
      message.success('配置已保存');
      // 更新原始值，不重新获取配置
      setOriginalIntegrationConfigValues(JSON.parse(JSON.stringify(integrationConfigValues)));
      // 更新integrationData中的configs
      setIntegrationData(prev => prev ? { ...prev, configs: { ...prev.configs, ...configs } } : prev);
    } catch (error) {
      console.error('Failed to save integration configs:', error);
      message.error('保存配置失败');
    }
  };

  // 从扁平的 integrationConfigValues 中获取嵌套配置值
  const getConfigValue = (path: string, defaultValue?: any) => {
    return integrationConfigValues[path] ?? defaultValue;
  };

  // 生成预览URL：通过后端接口生成token，不暴露配置参数
  const generatePreviewUrl = useCallback(async (widgetType: 'sidebar' | 'iframe'): Promise<string> => {
    const apiKey = integrationData?.integration?.api_key?.[0] || '';

    console.log('[预览] integrationData:', integrationData);
    console.log('[预览] apiKey:', apiKey);

    if (!apiKey) {
      console.error('[预览] 缺少API密钥');
      message.error('缺少API密钥，请先保存配置');
      return '';
    }

    try {
      const url = `${import.meta.env.VITE_API_BASE_URL || ''}/aicenter/v1/integration/preview`;
      console.log('[预览] 请求URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: widgetType,
          api_key: apiKey,
        }),
      });

      const result = await response.json();
      console.log('[预览] 响应结果:', result);

      if (result.code === 200 && result.data?.preview_url) {
        // 后端返回相对路径，前端拼接完整 URL
        const previewUrl = window.location.origin + result.data.preview_url;
        console.log('[预览] 生成成功:', previewUrl);
        return previewUrl;
      } else {
        console.error('[预览] 生成失败:', result.message);
        message.error(result.message || '生成预览链接失败');
        return '';
      }
    } catch (error) {
      console.error('[预览] 请求异常:', error);
      message.error('网络请求失败，请检查网络连接');
      return '';
    }
  }, [integrationData]);

  // 生成嵌入代码：只传递api_key，配置从后端接口获取
  const generateEmbedCode = (widgetType: 'sidebar' | 'iframe'): string => {
    const apiKey = integrationData?.integration?.api_key?.[0] || '';
    if (!apiKey) return '';

    const baseUrl = window.location.origin;

    if (widgetType === 'sidebar') {
      // 悬浮球侧边栏：只传递api_key，初始化时从后端获取配置
      return `<!-- AI助手悬浮球侧边栏 -->
<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/integration/sidebar.js?api_key=${apiKey}';
    document.body.appendChild(script);
  })();
</script>
<noscript>请启用JavaScript以使用AI助手</noscript>`;
    } else {
      // iframe嵌入：只传递api_key，配置从后端获取
      return `<!-- AI助手iframe嵌入 -->
<iframe
  src="${baseUrl}/integration/chat?api_key=${apiKey}"
  style="width: 100%; height: 600px; border: none; border-radius: 8px;"
  allow="microphone"
></iframe>`;
    }
  };

  // 当配置参数或集成数据加载完成后初始化配置值
  useEffect(() => {
    if (integrationData && integrationConfigParams.length > 0) {
      initConfigValues(integrationData, integrationConfigParams);
    }
  }, [integrationData, integrationConfigParams]);

  // 配置有变动时，F5刷新页面提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isIntegrationDirty || hasChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isIntegrationDirty, hasChanges]);

  // 渲染单个配置参数的控件
  const renderConfigControl = (param: any, fullKey: string) => {
    const value = integrationConfigValues[fullKey];
    switch (param.type) {
      case 'text':
        return (
          <Input
            value={value ?? param.default ?? ''}
            onChange={e => handleConfigValueChange(fullKey, e.target.value)}
            placeholder={param.description}
          />
        );
      case 'number':
        return (
          <InputNumber
            value={value ?? param.default ?? 0}
            onChange={v => handleConfigValueChange(fullKey, v)}
            min={param.min}
            max={param.max}
            style={{ width: '100%' }}
          />
        );
      case 'switch':
        return (
          <div style={{ display: 'inline-flex' }}>
            <Switch
              checked={value ?? param.default ?? false}
              onChange={v => handleConfigValueChange(fullKey, v)}
            />
          </div>
        );
      case 'select':
        return (
          <Select
            value={value ?? param.default}
            onChange={v => handleConfigValueChange(fullKey, v)}
            style={{ width: '100%' }}
            options={param.options?.map((opt: any) => ({ label: opt.label, value: opt.value }))}
          />
        );
      case 'theme_select':
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(param.options || []).map((opt: any) => (
              <div
                key={opt.key}
                onClick={() => handleConfigValueChange(fullKey, opt.color)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: opt.color,
                  border: (value ?? param.default) === opt.color
                    ? '3px solid var(--primary-color)'
                    : theme === 'dark' ? '2px solid rgba(255,255,255,0.2)' : '2px solid #d9d9d9',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', color: opt.color === '#ffffff' ? '#333' : '#fff'
                }}
                title={opt.label}
              >
                {(value ?? param.default) === opt.color && '✓'}
              </div>
            ))}
            {/* 自定义颜色输入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: value && !param.options?.some((opt: any) => opt.color === value) ? value : 'transparent',
                  border: value && !param.options?.some((opt: any) => opt.color === value)
                    ? '3px solid var(--primary-color)'
                    : theme === 'dark' ? '2px solid rgba(255,255,255,0.2)' : '2px solid #d9d9d9',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                title="自定义颜色"
              >
                <input
                  type="color"
                  value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ffffff'}
                  onChange={e => handleConfigValueChange(fullKey, e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '14px', color: theme === 'dark' ? '#aaa' : '#999' }}>+</span>
              </div>
            </div>
          </div>
        );
      case 'color':
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(param.presets || []).map((opt: any) => (
              <div
                key={opt.key}
                onClick={() => handleConfigValueChange(fullKey, opt.color)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: opt.color === 'none' ? 'transparent' : opt.color,
                  border: (value ?? param.default) === opt.color
                    ? '3px solid var(--primary-color)'
                    : theme === 'dark' ? '2px solid rgba(255,255,255,0.2)' : '2px solid #d9d9d9',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px',
                  position: 'relative'
                }}
                title={opt.label}
              >
                {opt.color === 'none' ? (
                  <span style={{ fontSize: '18px', color: theme === 'dark' ? '#aaa' : '#999' }}>∅</span>
                ) : (
                  (value ?? param.default) === opt.color && <span style={{ color: '#fff' }}>✓</span>
                )}
              </div>
            ))}
            {/* 自定义颜色输入 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: value && !param.presets?.some((opt: any) => opt.color === value) ? value : 'transparent',
                  border: value && !param.presets?.some((opt: any) => opt.color === value)
                    ? '3px solid var(--primary-color)'
                    : theme === 'dark' ? '2px solid rgba(255,255,255,0.2)' : '2px solid #d9d9d9',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                title="自定义颜色"
              >
                <input
                  type="color"
                  value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#ffffff'}
                  onChange={e => handleConfigValueChange(fullKey, e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '16px', color: theme === 'dark' ? '#aaa' : '#999' }}>+</span>
              </div>
            </div>
          </div>
        );
      case 'tag_list':
        return (
          <Select
            mode="tags"
            value={value ?? param.default ?? []}
            onChange={v => handleConfigValueChange(fullKey, v)}
            style={{ width: '100%' }}
            placeholder={param.description || '输入后回车添加'}
            tokenSeparators={[',']}
          />
        );
      case 'upload': {
        // 如果后端返回了 default_avatars，直接使用（后端已经处理了禁止图标）
        // 否则使用前端默认列表并添加禁止图标
        let defaultAvatars: any[];
        if (param.default_avatars && param.default_avatars.length > 0) {
          defaultAvatars = param.default_avatars;
        } else {
          const baseAvatars = param.avatar_type === 'user' ? DEFAULT_USER_AVATARS : DEFAULT_BOT_AVATARS;
          const forbiddenOption = { key: 'forbidden', src: '', label: '禁止' };
          defaultAvatars = [forbiddenOption, ...baseAvatars];
        }
        
        // 当前值是否选中「禁止」（空字符串）
        const isForbiddenSelected = !value || value === '';
        return (
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {defaultAvatars.map(av => {
                const isSelected = av.src === '' ? isForbiddenSelected : value === av.src;
                const isForbiddenOption = av.src === '';
                return (
                  <div
                    key={av.key}
                    onClick={() => handleConfigValueChange(fullKey, av.src)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      overflow: 'hidden', cursor: 'pointer',
                      border: isSelected
                        ? `2px solid var(--primary-color)`
                        : theme === 'dark' ? '2px solid rgba(255,255,255,0.15)' : '2px solid #e8e8e8',
                      transition: 'all 0.2s',
                      boxShadow: isSelected ? '0 0 0 2px rgba(90, 111, 214, 0.3)' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isForbiddenOption
                        ? (theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f5f5f5')
                        : undefined
                    }}
                    title={av.label}
                  >
                    {isForbiddenOption ? (
                      <img src={forbiddenIcon} alt="禁止" style={{ width: '20px', height: '20px', opacity: 0.5 }} />
                    ) : (
                      <img 
                        src={AVATAR_KEY_TO_SRC[av.key] || av.src} 
                        alt={av.label} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    )}
                  </div>
                );
              })}
              <Upload
                className="avatar-upload-btn"
                beforeUpload={(file) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    handleConfigValueChange(fullKey, reader.result as string);
                  };
                  reader.readAsDataURL(file);
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: theme === 'dark' ? 'none' : '1px dashed #d9d9d9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '14px',
                  color: theme === 'dark' ? '#888' : '#bbb',
                  background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'transparent'
                }}>
                  <PlusOutlined />
                </div>
              </Upload>
              {value && !defaultAvatars.find(a => a.src === value) && (
                <div style={{ position: 'relative' }}>
                  <img src={value} alt="custom" style={{
                    width: 36, height: 36, borderRadius: '50%', objectFit: 'cover',
                    border: '2px solid var(--primary-color)',
                    boxShadow: '0 0 0 2px rgba(90, 111, 214, 0.3)'
                  }} />
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => handleConfigValueChange(fullKey, '')}
                    style={{ position: 'absolute', top: -6, right: -6, fontSize: '10px', padding: 0 }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      }
      default:
        return (
          <Input
            value={value ?? param.default ?? ''}
            onChange={e => handleConfigValueChange(fullKey, e.target.value)}
            size="small"
          />
        );
    }
  };

  // 渲染配置参数区块
  const renderConfigSection = (items: any[], prefix: string, depth: number = 0) => {
    return items.map(item => {
      const fullKey = prefix ? `${prefix}.${item.key}` : item.key;
      if (item.type === 'section' && item.children) {
        return (
          <div key={fullKey} style={{
            padding: depth > 0 ? '12px' : '0',
            border: depth > 0 ? (theme === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid #f0f0f0') : 'none',
            borderRadius: depth > 0 ? '6px' : '0',
            background: depth > 0 ? (theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fafafa') : 'transparent'
          }}>
            <div style={{
              fontSize: depth === 0 ? '14px' : '14px',
              fontWeight: 500,
              color: theme === 'dark' ? '#fff' : '#000',
              marginBottom: '12px',
              textAlign: 'left'
            }}>
              {item.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: depth === 0 ? '0' : '0' }}>
              {renderConfigSection(item.children, fullKey, depth + 1)}
            </div>
          </div>
        );
      }
      return (
        <div key={fullKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
            {item.label}
            {item.description && (
              <Tooltip title={item.description}>
                <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
              </Tooltip>
            )}
          </div>
          {renderConfigControl(item, fullKey)}
        </div>
      );
    });
  };

  const fetchIntegrationConfigs = async (chatbotId: string) => {
    setIntegrationLoading(true);
    try {
      const result = await integrationService.getIntegrationConfigs(chatbotId);
      setIntegrationData(result);
    } catch (error) {
      console.error('Failed to fetch integration configs:', error);
    } finally {
      setIntegrationLoading(false);
    }
  };

  const handleEnableIntegration = async () => {
    if (!chatbot) return;
    try {
      // 启用时使用机器人名称和欢迎语作为默认值
      const defaultConfigs: Record<string, any> = {};
      if (chatbot.name) {
        defaultConfigs['interface_config.sidebar.title'] = chatbot.name;
      }
      if (chatbot.greeting) {
        defaultConfigs['chat_config.welcome_messages'] = [chatbot.greeting];
      }
      // 重建嵌套configs对象
      const configs: Record<string, any> = {};
      for (const [fullKey, value] of Object.entries(defaultConfigs)) {
        const parts = fullKey.split('.');
        let obj = configs;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!obj[parts[i]]) obj[parts[i]] = {};
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = value;
      }
      await integrationService.saveIntegration(chatbot.id, Object.keys(configs).length > 0 ? { configs } : undefined);
      message.success('集成配置已启用');
      fetchIntegrationConfigs(chatbot.id);
    } catch (error) {
      console.error('Failed to enable integration:', error);
      message.error('启用集成配置失败');
    }
  };

  const handleRegenerateApiKey = async () => {
    if (!chatbot) return;
    Modal.confirm({
      title: '确认重新生成API密钥？',
      content: '重新生成后，旧的API密钥将失效，已集成的第三方服务需要重新配置。',
      onOk: async () => {
        try {
          await integrationService.regenerateApiKey(chatbot.id);
          message.success('API密钥已重新生成');
          fetchIntegrationConfigs(chatbot.id);
        } catch (error) {
          console.error('Failed to regenerate API key:', error);
          message.error('重新生成API密钥失败');
        }
      }
    });
  };

  const handleCopyCode = (code: string) => {
    const text = String(code ?? '');
    if (!text) {
      message.warning('没有可复制的内容');
      return;
    }

    const fallbackCopy = (textToCopy: string): boolean => {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.readOnly = true;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      try {
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textToCopy.length);
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setIntegrationCopied(true);
        message.success('代码已复制到剪贴板');
        setTimeout(() => setIntegrationCopied(false), 2000);
      }).catch(() => {
        if (fallbackCopy(text)) {
          setIntegrationCopied(true);
          message.success('代码已复制到剪贴板');
          setTimeout(() => setIntegrationCopied(false), 2000);
        } else {
          message.error('复制失败，请手动复制');
        }
      });
    } else {
      if (fallbackCopy(text)) {
        setIntegrationCopied(true);
        message.success('代码已复制到剪贴板');
        setTimeout(() => setIntegrationCopied(false), 2000);
      } else {
        message.error('复制失败，请手动复制');
      }
    }
  };

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChanges || isIntegrationDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }, [hasChanges, isIntegrationDirty]);

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
        avatar: data.avatar || '',
        category_id: data.category_id,
        prompt_id: data.prompt_id,
        knowledge_id: data.knowledge_id,
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
        avatar: data.avatar || '',
        category_id: data.category_id
      });
      setAvatarPreview(data.avatar || '');
      setSelectedPromptId(data.prompt_id);
      setSelectedKnowledgeId(data.knowledge_id || undefined);
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
      const data = await knowledgebaseService.getKnowledgebases();
      setKnowledges(data.data || []);
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
    
    // 头像变化检测
    const avatarChanged = avatarPreview !== originalData.avatar;
    
    setHasChanges(changed || avatarChanged);
  };

  const handleRestore = () => {
    form.setFieldsValue({
      ...originalData,
      avatar: originalData.avatar || ''
    });
    setAvatarPreview(originalData.avatar || '');
    setSelectedPromptId(originalData.prompt_id);
    setSelectedKnowledgeId(originalData.knowledge_id);
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
        knowledge_id: selectedKnowledgeId,
        model_id: selectedModelId,
        mcp_ids: selectedMcpIds.map(id => parseInt(id)),
        source_config: selectedSourceType && sourceConfigFields.length > 0 ? JSON.stringify(sourceConfig) : undefined
      };
      await chatbotService.updateChatbot(chatbot.id, updateData);
      setOriginalData({
        ...values,
        prompt_id: selectedPromptId,
        knowledge_id: selectedKnowledgeId,
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
        // 延迟检查变化，确保表单值已更新
        setTimeout(() => {
          handleValuesChange();
        }, 0);
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
      <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '20px' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
          返回列表
        </Button>
      </div>

      <div className="chatbot-setting-container" style={{ display: 'flex', gap: '8px', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
        {/* 左侧基本信息 */}
        <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', overflowX: 'hidden' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .hide-scrollbar-inner::-webkit-scrollbar { display: none; } .hide-scrollbar-inner { -ms-overflow-style: none; scrollbar-width: none; } .pub-anchor .ant-anchor::before { border-inline-start: none !important; } .pub-anchor .ant-anchor-ink { display: none !important; } .pub-anchor .ant-anchor-link { padding-block: 6px; padding-inline-start: 16px; position: relative; cursor: pointer; } .pub-anchor .ant-anchor-link::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 6px; height: 6px; border-radius: 50%; background: transparent; transition: background 0.2s; } .pub-anchor .ant-anchor-link-active::before { background: #1677ff; } .pub-anchor[data-theme="dark"] .ant-anchor-link-title { color: rgba(255,255,255,0.65); font-size: 13px; white-space: nowrap; } .pub-anchor[data-theme="dark"] .ant-anchor-link-title:hover { color: #1677ff; } .pub-anchor[data-theme="dark"] .ant-anchor-link-active .ant-anchor-link-title { color: #1677ff; font-weight: 500; } .pub-anchor[data-theme="light"] .ant-anchor-link-title { color: rgba(0,0,0,0.65); font-size: 13px; white-space: nowrap; } .pub-anchor[data-theme="light"] .ant-anchor-link-title:hover { color: #1677ff; } .pub-anchor[data-theme="light"] .ant-anchor-link-active .ant-anchor-link-title { color: #1677ff; font-weight: 500; } code { background: transparent !important; }`}</style>
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
                    <>
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
                      <Button 
                        icon={<DeleteOutlined />} 
                        danger 
                        size="small"
                        onClick={() => {
                          form.setFieldsValue({ avatar: '' });
                          setAvatarPreview('');
                          // 延迟检查变化，确保表单值已更新
                          setTimeout(() => {
                            handleValuesChange();
                          }, 0);
                        }}
                      >
                        清空
                      </Button>
                    </>
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
              gap: '8px',
              alignItems: 'center'
            }}>
              {hasChanges && (
                <span style={{ color: '#faad14', fontSize: 12, marginRight: 'auto' }}>
                  • 有未保存的变动
                </span>
              )}
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
                              target.src = getDefaultAvatar();
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
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                  e.currentTarget.style.color = 'var(--primary-color)';
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
                        src={server.server_avatar || undefined} 
                        icon={<ApiOutlined />}
                        style={{ backgroundColor: 'var(--primary-color)', flexShrink: 0 }}
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
            </div>
            
            {boundKnowledgebases.length === 0 ? (
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
                onClick={handleSelectKnowledgebase}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#52c41a';
                  e.currentTarget.style.color = '#52c41a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#d9d9d9';
                  e.currentTarget.style.color = theme === 'dark' ? '#aaa' : '#999';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  <PlusOutlined />
                </div>
                <div>点击添加知识库</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {boundKnowledgebases.map((kb: any) => (
                  <div key={kb.binding_id} style={{
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                    borderRadius: '4px',
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fff',
                    padding: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                        <Avatar 
                          size={24} 
                          src={kb.kb_avatar || undefined}
                          icon={<DatabaseOutlined />}
                          style={{ backgroundColor: '#52c41a', flexShrink: 0 }}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                            {kb.kb_name}
                          </div>
                          <div style={{ fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                            {kb.kb_code}
                          </div>
                          {kb.kb_description && (
                            <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                              {kb.kb_description}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          文档: {kb.enabled_doc_num || 0}
                        </div>
                        <Button
                          type="text"
                          icon={<DeleteOutlined />}
                          size="small"
                          danger
                          onClick={() => handleUnbindKnowledgebase(kb.binding_id)}
                          title="解绑知识库"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={handleSelectKnowledgebase}
                >
                  添加知识库
                </Button>
              </div>
            )}
          </div>

          {/* 第三方插件集成 */}
        <div style={{
          padding: '16px',
          borderRadius: '4px',
          border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
          background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fafafa'
        }}>
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GlobalOutlined style={{ fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }} />
              <span style={{ fontWeight: 500, fontSize: '14px', color: theme === 'dark' ? '#fff' : '#000' }}>第三方插件集成</span>
            </div>
            {integrationData?.integration && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={handleResetToDefault}
                >
                  重置
                </Button>
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={handleRestoreIntegrationConfigs}
                  disabled={!isIntegrationDirty}
                >
                  恢复
                </Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  onClick={handleSaveIntegrationConfigs}
                  disabled={!isIntegrationDirty}
                >
                  保存
                </Button>
                {isIntegrationDirty && (
                  <span style={{ color: '#faad14', fontSize: '12px', marginLeft: '4px' }}>
                    • 有未保存的变动
                  </span>
                )}
              </div>
            )}
          </div>
          
          {integrationLoading ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <Spin />
            </div>
          ) : !integrationData?.integration ? (
            <div style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: '13px', color: theme === 'dark' ? '#aaa' : '#999', marginBottom: '12px' }}>
                尚未启用第三方插件集成
              </div>
              <Button type="primary" onClick={handleEnableIntegration}>
                启用集成
              </Button>
            </div>
          ) : (
            <Tabs
              activeKey={integrationActiveTab}
              onChange={setIntegrationActiveTab}
              items={[
                {
                  key: 'api',
                  label: <span><ApiOutlined /> API集成</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* API密钥 */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', marginBottom: '4px', textAlign: 'left' }}>API密钥</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Input
                            value={apiKeyVisible ? (integrationData.integration.api_key?.[0] || '') : '••••••••••••••••••••••'}
                            readOnly
                            style={{ flex: 1 }}
                          />
                          <Button
                            icon={apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            size="small"
                            onClick={() => setApiKeyVisible(!apiKeyVisible)}
                          />
                          <Button
                            icon={<CopyOutlined />}
                            size="small"
                            onClick={() => handleCopyCode(integrationData.integration.api_key?.[0] || '')}
                          />
                          <Button
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={handleRegenerateApiKey}
                          >
                            重新生成
                          </Button>
                        </div>
                      </div>
                      
                      {/* Base URL */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', marginBottom: '4px', textAlign: 'left' }}>Base URL</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Input
                            value={integrationData.integration.openai_base_url || ''}
                            readOnly
                            style={{ flex: 1 }}
                          />
                          <Button
                            icon={<CopyOutlined />}
                            size="small"
                            onClick={() => handleCopyCode(integrationData.integration.openai_base_url || '')}
                          />
                        </div>
                      </div>
                      
                      {/* 接口文档 */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', marginBottom: '8px', textAlign: 'left' }}>接口文档</div>
                        <Tabs
                          size="small"
                          items={[
                            {
                              key: 'chat_api',
                              label: '聊天接口',
                              children: (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#666', textAlign: 'left' }}>
                                    POST {integrationData.integration.openai_base_url || ''}/chat/completions
                                  </div>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>请求示例</div>
                                  <Tabs
                                    size="small"
                                    items={[
                                      {
                                        key: 'curl',
                                        label: 'cURL',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="bash"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.chat?.request_example?.curl || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.chat?.request_example?.curl || '')}
                                            />
                                          </div>
                                        )
                                      },
                                      {
                                        key: 'python',
                                        label: 'Python',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="python"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.chat?.request_example?.python || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.chat?.request_example?.python || '')}
                                            />
                                          </div>
                                        )
                                      }
                                    ]}
                                  />
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>响应示例</div>
                                  <Tabs
                                    size="small"
                                    items={[
                                      {
                                        key: 'stream',
                                        label: '流式响应',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="text"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.chat?.stream_response_example || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.chat?.stream_response_example || '')}
                                            />
                                          </div>
                                        )
                                      },
                                      {
                                        key: 'non_stream',
                                        label: '非流式响应',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="json"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.chat?.non_stream_response_example || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.chat?.non_stream_response_example || '')}
                                            />
                                          </div>
                                        )
                                      }
                                    ]}
                                  />
                                </div>
                              )
                            },
                            {
                              key: 'messages_api',
                              label: '获取聊天记录',
                              children: (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#666', textAlign: 'left' }}>
                                    GET {integrationData.integration.openai_base_url || ''}/chat/{'{chat_id}'}/messages
                                  </div>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>请求示例</div>
                                  <Tabs
                                    size="small"
                                    items={[
                                      {
                                        key: 'curl',
                                        label: 'cURL',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="bash"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.get_messages?.request_example?.curl || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.get_messages?.request_example?.curl || '')}
                                            />
                                          </div>
                                        )
                                      },
                                      {
                                        key: 'python',
                                        label: 'Python',
                                        children: (
                                          <div style={{ position: 'relative' }}>
                                            <SyntaxHighlighter
                                              language="python"
                                              style={theme === 'dark' ? oneDark : oneLight}
                                              customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                              wrapLongLines
                                            >
                                              {integrationData.configs?.api_config?.get_messages?.request_example?.python || ''}
                                            </SyntaxHighlighter>
                                            <Button
                                              icon={<CopyOutlined />}
                                              size="small"
                                              style={{ position: 'absolute', top: '8px', right: '8px' }}
                                              onClick={() => handleCopyCode(integrationData.configs?.api_config?.get_messages?.request_example?.python || '')}
                                            />
                                          </div>
                                        )
                                      }
                                    ]}
                                  />
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>响应示例</div>
                                  <div style={{ position: 'relative' }}>
                                    <SyntaxHighlighter
                                      language="json"
                                      style={theme === 'dark' ? oneDark : oneLight}
                                      customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', maxWidth: '100%', overflowX: 'auto', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                      wrapLongLines
                                    >
                                      {integrationData.configs?.api_config?.get_messages?.response_example || ''}
                                    </SyntaxHighlighter>
                                    <Button
                                      icon={<CopyOutlined />}
                                      size="small"
                                      style={{ position: 'absolute', top: '8px', right: '8px' }}
                                      onClick={() => handleCopyCode(integrationData.configs?.api_config?.get_messages?.response_example || '')}
                                    />
                                  </div>
                                </div>
                              )
                            }
                          ]}
                        />
                      </div>
                    </div>
                  )
                },
                {
                  key: 'interface',
                  label: <span><CodeOutlined /> 界面配置</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {integrationConfigParams.length > 0 ? (
                        <Tabs
                          size="small"
                          items={[
                            {
                              key: 'common',
                              label: '通用配置',
                              children: (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, 1fr)',
                                  gap: '16px 24px'
                                }}>
                                  {integrationConfigParams.filter(p => p.key === 'interface_config').flatMap(p => p.children?.find(c => c.key === 'common_config')?.children?.map((item: any) => {
                                    const fullKey = `interface_config.common_config.${item.key}`;
                                    const isAvatar = item.type === 'upload';
                                    return (
                                      <div key={fullKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px', ...(isAvatar ? { gridColumn: 'span 2' } : {}) }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
                                          {item.label}
                                          {item.description && (
                                            <Tooltip title={item.description}>
                                              <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
                                            </Tooltip>
                                          )}
                                        </div>
                                        {renderConfigControl(item, fullKey)}
                                      </div>
                                    );
                                  }) || []) || []}
                                </div>
                              )
                            },
                            {
                              key: 'sidebar',
                              label: '悬浮球侧边栏',
                              children: (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, 1fr)',
                                  gap: '16px 24px'
                                }}>
                                  {integrationConfigParams.filter(p => p.key === 'interface_config').flatMap(p => p.children?.find(c => c.key === 'sidebar')?.children?.map((item: any) => {
                                    const fullKey = `interface_config.sidebar.${item.key}`;
                                    return (
                                      <div key={fullKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
                                          {item.label}
                                          {item.description && (
                                            <Tooltip title={item.description}>
                                              <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
                                            </Tooltip>
                                          )}
                                        </div>
                                        {renderConfigControl(item, fullKey)}
                                      </div>
                                    );
                                  }) || []) || []}
                                </div>
                              )
                            },
                            {
                              key: 'iframe',
                              label: 'iframe',
                              children: (
                                <div style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(2, 1fr)',
                                  gap: '16px 24px'
                                }}>
                                  {integrationConfigParams.filter(p => p.key === 'interface_config').flatMap(p => p.children?.find(c => c.key === 'iframe')?.children?.map((item: any) => {
                                    const fullKey = `interface_config.iframe.${item.key}`;
                                    return (
                                      <div key={fullKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
                                          {item.label}
                                          {item.description && (
                                            <Tooltip title={item.description}>
                                              <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
                                            </Tooltip>
                                          )}
                                        </div>
                                        {renderConfigControl(item, fullKey)}
                                      </div>
                                    );
                                  }) || []) || []}
                                </div>
                              )
                            }
                          ]}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          加载配置参数中...
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'chat_config',
                  label: <span><SettingOutlined /> 聊天配置</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {integrationConfigParams.length > 0 ? (
                        <>
                          {/* 非欢迎语配置项 - 两列布局 */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 24px' }}>
                            {integrationConfigParams.filter(p => p.key === 'chat_config').flatMap(p => p.children?.filter((c: any) => c.key !== 'welcome_messages').map((item: any) => {
                              const fullKey = `chat_config.${item.key}`;
                              return (
                                <div key={fullKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
                                    {item.label}
                                    {item.description && (
                                      <Tooltip title={item.description}>
                                        <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
                                      </Tooltip>
                                    )}
                                  </div>
                                  {renderConfigControl(item, fullKey)}
                                </div>
                              );
                            }) || []) || []}
                          </div>
                          {/* 欢迎语 - 输入框形式 */}
                          {(() => {
                            const wmParam = integrationConfigParams.filter(p => p.key === 'chat_config').flatMap(p => p.children?.filter((c: any) => c.key === 'welcome_messages') || [])[0];
                            if (!wmParam) return null;
                            const wmKey = 'chat_config.welcome_messages';
                            const wmValues: string[] = integrationConfigValues[wmKey] || [];
                            return (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#ccc' : '#333', textAlign: 'left' }}>
                                    {wmParam.label}
                                    {wmParam.description && (
                                      <Tooltip title={wmParam.description}>
                                        <QuestionCircleOutlined style={{ marginLeft: '4px', color: theme === 'dark' ? '#888' : '#bbb', fontSize: '12px' }} />
                                      </Tooltip>
                                    )}
                                  </div>
                                  <Button
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleConfigValueChange(wmKey, [...wmValues, ''])}
                                  >
                                    添加
                                  </Button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {wmValues.map((msg, idx) => (
                                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                      <Input
                                        value={msg}
                                        onChange={e => {
                                          const newVals = [...wmValues];
                                          newVals[idx] = e.target.value;
                                          handleConfigValueChange(wmKey, newVals);
                                        }}
                                        placeholder="输入欢迎语"
                                        style={{ flex: 1 }}
                                      />
                                      <Button
                                        size="small"
                                        icon={<MinusOutlined />}
                                        onClick={() => {
                                          const newVals = wmValues.filter((_, i) => i !== idx);
                                          handleConfigValueChange(wmKey, newVals);
                                        }}
                                      />
                                    </div>
                                  ))}
                                  {wmValues.length === 0 && (
                                    <div style={{ fontSize: '12px', color: theme === 'dark' ? '#888' : '#999', textAlign: 'left' }}>
                                      暂无欢迎语，点击上方"添加"按钮新增
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          加载配置参数中...
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'publish',
                  label: <span><SendOutlined /> 发布</span>,
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Tabs
                        activeKey={integrationCodeTab}
                        onChange={(key) => { setIntegrationCodeTab(key); setPubActiveAnchor('preview'); }}
                        items={[
                          {
                            key: 'sidebar',
                            label: '悬浮球侧边栏',
                            children: (() => {
                              const wt = 'sidebar';
                              const containerId = `publish-scroll-${wt}`;
                              const cardBorder = theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8';
                              const embedCode = generateEmbedCode(wt);
                              return (
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <div className="pub-anchor" data-theme={theme} style={{ width: '110px', flexShrink: 0, paddingRight: '12px', borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8' }}>
                                    <Anchor
                                      affix={false}
                                      targetOffset={20}
                                      target={`#${containerId}`}
                                      getCurrentAnchor={() => `#pub-${pubActiveAnchor}`}
                                      onClick={(e, link) => {
                                        e.preventDefault();
                                        const sec = link.href.replace('#pub-', '');
                                        const container = pubScrollRef.current;
                                        const target = container?.querySelector(`#pub-${sec}`);
                                        if (target && container) {
                                          const containerTop = container.getBoundingClientRect().top;
                                          const targetTop = (target as HTMLElement).getBoundingClientRect().top;
                                          container.scrollTo({ top: container.scrollTop + (targetTop - containerTop) - 8, behavior: 'smooth' });
                                        }
                                        setPubActiveAnchor(sec);
                                      }}
                                      items={[
                                        { key: 'preview', href: '#pub-preview', title: '预览' },
                                        { key: 'code', href: '#pub-code', title: '嵌入代码' },
                                        { key: 'download', href: '#pub-download', title: '下载文件' },
                                      ]}
                                    />
                                  </div>
                                  <div
                                    id={containerId}
                                    ref={pubScrollRef}
                                    onScroll={onPubScroll}
                                    style={{ flex: 1, maxHeight: '520px', overflowY: 'auto' }}
                                    className="hide-scrollbar"
                                  >
                                    <div id="pub-preview">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>预览</span>
                                        <Tooltip title="生成临时URL并在新窗口预览插件效果">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ marginBottom: '12px', textAlign: 'left' }}>
                                        <Button
                                          type="primary"
                                          icon={<EyeOutlined />}
                                          onClick={async () => {
                                            const url = await generatePreviewUrl('sidebar');
                                            if (!url) { message.warning('配置参数不完整，无法预览'); return; }
                                            window.open(url, '_blank');
                                          }}
                                        >
                                          打开预览
                                        </Button>
                                      </div>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: cardBorder, margin: '16px 0' }} />
                                    <div id="pub-code">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>嵌入代码</span>
                                        <Tooltip title="将代码复制到您的网站中使用，变量已替换为实际值">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ position: 'relative', marginBottom: '12px', width: '100%' }}>
                                        <SyntaxHighlighter
                                          language="html"
                                          style={theme === 'dark' ? oneDark : oneLight}
                                          customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', overflowX: 'auto', wordBreak: 'break-word', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                          wrapLongLines
                                        >
                                          {embedCode}
                                        </SyntaxHighlighter>
                                        <Button
                                          icon={<CopyOutlined />}
                                          size="small"
                                          style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}
                                          onClick={() => handleCopyCode(embedCode)}
                                        >
                                          复制代码
                                        </Button>
                                      </div>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: cardBorder, margin: '16px 0' }} />
                                    <div id="pub-download">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>下载文件</span>
                                        <Tooltip title="下载离线部署包（zip），解压后可直接使用">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ textAlign: 'left' }}>
                                        <Button
                                          type="primary"
                                          icon={<DownloadOutlined />}
                                          onClick={() => {
                                            if (chatbot) {
                                              window.open(integrationService.downloadPackage(chatbot.id, wt), '_blank');
                                            }
                                          }}
                                        >
                                          下载部署包
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          },
                          {
                            key: 'iframe',
                            label: 'iframe嵌入',
                            children: (() => {
                              const wt = 'iframe';
                              const containerId = `publish-scroll-${wt}`;
                              const cardBorder = theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8';
                              const embedCode = generateEmbedCode(wt);
                              return (
                                <div style={{ display: 'flex', gap: '16px' }}>
                                  <div className="pub-anchor" data-theme={theme} style={{ width: '110px', flexShrink: 0, paddingRight: '12px', borderRight: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e8e8e8' }}>
                                    <Anchor
                                      affix={false}
                                      targetOffset={20}
                                      target={`#${containerId}`}
                                      getCurrentAnchor={() => `#pub-${pubActiveAnchor}`}
                                      onClick={(e, link) => {
                                        e.preventDefault();
                                        const sec = link.href.replace('#pub-', '');
                                        const container = pubScrollRef.current;
                                        const target = container?.querySelector(`#pub-${sec}`);
                                        if (target && container) {
                                          const containerTop = container.getBoundingClientRect().top;
                                          const targetTop = (target as HTMLElement).getBoundingClientRect().top;
                                          container.scrollTo({ top: container.scrollTop + (targetTop - containerTop) - 8, behavior: 'smooth' });
                                        }
                                        setPubActiveAnchor(sec);
                                      }}
                                      items={[
                                        { key: 'preview', href: '#pub-preview', title: '预览' },
                                        { key: 'code', href: '#pub-code', title: '嵌入代码' },
                                        { key: 'download', href: '#pub-download', title: '下载文件' },
                                      ]}
                                    />
                                  </div>
                                  <div
                                    id={containerId}
                                    ref={pubScrollRef}
                                    onScroll={onPubScroll}
                                    style={{ flex: 1, maxHeight: '520px', overflowY: 'auto' }}
                                    className="hide-scrollbar"
                                  >
                                    <div id="pub-preview">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>预览</span>
                                        <Tooltip title="生成临时URL并在新窗口预览插件效果">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ marginBottom: '12px', textAlign: 'left' }}>
                                        <Button
                                          type="primary"
                                          icon={<EyeOutlined />}
                                          onClick={async () => {
                                            const url = await generatePreviewUrl('iframe');
                                            if (!url) { message.warning('配置参数不完整，无法预览'); return; }
                                            window.open(url, '_blank');
                                          }}
                                        >
                                          打开预览
                                        </Button>
                                      </div>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: cardBorder, margin: '16px 0' }} />
                                    <div id="pub-code">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>嵌入代码</span>
                                        <Tooltip title="将代码复制到您的网站中使用，变量已替换为实际值">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ position: 'relative', marginBottom: '12px', width: '100%' }}>
                                        <SyntaxHighlighter
                                          language="html"
                                          style={theme === 'dark' ? oneDark : oneLight}
                                          customStyle={{ margin: 0, borderRadius: '4px', fontSize: '12px', overflowX: 'auto', wordBreak: 'break-word', background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#f5f5f5' }}
                                          wrapLongLines
                                        >
                                          {embedCode}
                                        </SyntaxHighlighter>
                                        <Button
                                          icon={<CopyOutlined />}
                                          size="small"
                                          style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 10 }}
                                          onClick={() => handleCopyCode(embedCode)}
                                        >
                                          复制代码
                                        </Button>
                                      </div>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: cardBorder, margin: '16px 0' }} />
                                    <div id="pub-download">
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>下载文件</span>
                                        <Tooltip title="下载离线部署包（zip），解压后可直接使用">
                                          <EyeOutlined style={{ color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }} />
                                        </Tooltip>
                                      </div>
                                      <div style={{ textAlign: 'left' }}>
                                        <Button
                                          type="primary"
                                          icon={<DownloadOutlined />}
                                          onClick={() => {
                                            if (chatbot) {
                                              window.open(integrationService.downloadPackage(chatbot.id, wt), '_blank');
                                            }
                                          }}
                                        >
                                          下载部署包
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          }
                        ]}
                      />
                    </div>
                  )
                }
              ]}
            />
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
                    target.src = getDefaultAvatar();
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
                  target.src = getDefaultAvatar();
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
                <ChatMarkdown
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
                        style={{ backgroundColor: 'var(--primary-color)', flexShrink: 0 }}
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
                                      accentColor: 'var(--primary-color)',
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

      {/* 知识库选择弹窗 */}
      <Modal
        title="选择知识库"
        open={isKnowledgebaseSelectModalVisible}
        onCancel={() => {
          setIsKnowledgebaseSelectModalVisible(false);
          setKnowledgebaseFilter('');
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setIsKnowledgebaseSelectModalVisible(false);
            setKnowledgebaseFilter('');
          }}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleBindKnowledgebases}>
            绑定
          </Button>
        ]}
        width={800}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        {/* 搜索输入框 */}
        <div style={{ marginBottom: '16px' }}>
          <Input
            placeholder="搜索知识库名称或编码"
            value={knowledgebaseFilter}
            onChange={(e) => setKnowledgebaseFilter(e.target.value)}
          />
        </div>
        
        {availableKnowledgebases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: theme === 'dark' ? '#aaa' : '#999' }}>
            暂无可用知识库
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
            {availableKnowledgebases
              .filter(knowledge => 
                knowledge.name.toLowerCase().includes(knowledgebaseFilter.toLowerCase()) ||
                knowledge.code.toLowerCase().includes(knowledgebaseFilter.toLowerCase())
              )
              .map(knowledge => (
                <div key={knowledge.id} style={{
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
                      borderBottom: expandedKnowledgebases.includes(knowledge.id) 
                        ? (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8')
                        : 'none'
                    }}
                    onClick={() => handleKnowledgebaseSelect(knowledge.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedKnowledgebases.includes(knowledge.id)}
                      onChange={() => handleKnowledgebaseSelect(knowledge.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        accentColor: '#52c41a'
                      }}
                    />
                    <Avatar 
                      size={24} 
                      src={knowledge.avatar || undefined}
                      icon={<DatabaseOutlined />}
                      style={{ backgroundColor: '#52c41a', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000' }}>
                          {knowledge.name}
                        </div>
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                          {knowledge.code}
                        </div>
                      </div>
                      {knowledge.description && (
                        <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', textAlign: 'left' }}>
                          {knowledge.description}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                      文档: {knowledgebaseDocuments[knowledge.id] ? knowledgebaseDocuments[knowledge.id].length : (knowledge.enabled_doc_num || knowledge.doc_num || 0)}
                    </div>
                    <div 
                      style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', cursor: 'pointer', padding: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleKnowledgebaseExpand(knowledge.id);
                      }}
                    >
                      {expandedKnowledgebases.includes(knowledge.id) ? '▼' : '▶'}
                    </div>
                  </div>
                  {expandedKnowledgebases.includes(knowledge.id) && (
                    <div style={{ padding: '8px 12px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
                      {knowledgebaseDocuments[knowledge.id] === undefined ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                          加载中...
                        </div>
                      ) : knowledgebaseDocuments[knowledge.id].length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                          暂无启用的数据集
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {knowledgebaseDocuments[knowledge.id].map((doc: any) => {
                            const sourceTypeLabel = documentConstants?.source_types 
                              ? (documentConstants.source_types.find((st: any) => st.key === doc.source_type)?.label || doc.source_type || '未知来源')
                              : (doc.source_type || '未知来源');
                            
                            return (
                              <div key={doc.id} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                padding: '12px',
                                border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid #f0f0f0',
                                borderRadius: '4px',
                                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : '#fafafa'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>
                                      {doc.title || '无标题'}
                                    </div>
                                    {doc.file_name && (
                                      <div style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999', textAlign: 'left' }}>
                                        文档名称: {doc.file_name}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '11px', color: theme === 'dark' ? '#aaa' : '#999' }}>
                                    {sourceTypeLabel}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChatbotSetting;
