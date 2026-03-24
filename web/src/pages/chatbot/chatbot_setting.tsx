import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, message, Row, Col, Upload, Spin, Tag, Avatar, Modal } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, UploadOutlined, RobotOutlined, FileTextOutlined, DatabaseOutlined, ToolOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { chatbotService, Chatbot, ChatbotCategory } from '../../services/chatbot';
import { promptService, Prompt } from '../../services/prompt';
import { knowledgeService, Knowledge } from '../../services/knowledge';
import { mcpService, MCPServer } from '../../services/mcp';
import { llmModelService, LLMModel } from '../../services/llm_model';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './chatbot_setting.less';

import WorkWeixinIcon from '../../assets/svg/企业微信.svg';
import LocalBotIcon from '../../assets/svg/本地机器人.svg';

const sourceTypeIcons: Record<string, string> = {
  'work_weixin': WorkWeixinIcon,
  'local': LocalBotIcon,
};

const { Option } = Select;

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
    }
  }, [id]);

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
              <span style={{ fontWeight: 500, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>绑定模型</span>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>（单选）</span>
            </div>
            
            {llmModels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                暂无可用模型
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {llmModels.map(model => (
                  <div
                    key={model.id}
                    onClick={() => {
                      setSelectedModelId(selectedModelId === parseInt(model.id) ? undefined : parseInt(model.id));
                      setHasChanges(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${selectedModelId === parseInt(model.id) ? '#faad14' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#d9d9d9')}`,
                      borderRadius: '4px',
                      background: selectedModelId === parseInt(model.id) 
                        ? (theme === 'dark' ? 'rgba(250, 173, 20, 0.1)' : 'rgba(250, 173, 20, 0.05)')
                        : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <Avatar 
                      size={24} 
                      icon={<ApiOutlined />}
                      style={{ backgroundColor: '#faad14', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>
                      {model.name}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <Tag color="blue" style={{ fontSize: '10px', padding: '0 4px', margin: 0 }}>{model.provider}</Tag>
                    </div>
                    {selectedModelId === parseInt(model.id) && (
                      <CheckCircleOutlined style={{ color: '#faad14', fontSize: '14px' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <span style={{ fontWeight: 500, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>提示词</span>
            </div>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择提示词"
              value={selectedPromptId}
              onChange={(value) => {
                setSelectedPromptId(value);
                setHasChanges(true);
              }}
              allowClear
              showSearch
              size="small"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {prompts.map(prompt => (
                <Option key={prompt.id} value={prompt.id}>{prompt.name}</Option>
              ))}
            </Select>
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
              <span style={{ fontWeight: 500, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>关联工具</span>
              <span style={{ fontSize: '12px', color: theme === 'dark' ? '#aaa' : '#999' }}>（多选）</span>
            </div>
            
            {mcpServers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: theme === 'dark' ? '#aaa' : '#999', fontSize: '12px' }}>
                暂无可用工具
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mcpServers.map(server => (
                  <div
                    key={server.id}
                    onClick={() => {
                      const newSelectedIds = selectedMcpIds.includes(server.id)
                        ? selectedMcpIds.filter(id => id !== server.id)
                        : [...selectedMcpIds, server.id];
                      setSelectedMcpIds(newSelectedIds);
                      setHasChanges(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 12px',
                      border: `1px solid ${selectedMcpIds.includes(server.id) ? '#667eea' : (theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#d9d9d9')}`,
                      borderRadius: '4px',
                      background: selectedMcpIds.includes(server.id) 
                        ? (theme === 'dark' ? 'rgba(102, 126, 234, 0.1)' : 'rgba(102, 126, 234, 0.05)')
                        : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <Avatar 
                      size={24} 
                      src={server.avatar} 
                      icon={<ApiOutlined />}
                      style={{ backgroundColor: '#667eea', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>
                      {server.name}
                    </div>
                    {selectedMcpIds.includes(server.id) && (
                      <CheckCircleOutlined style={{ color: '#667eea', fontSize: '14px' }} />
                    )}
                  </div>
                ))}
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
              <span style={{ fontWeight: 500, fontSize: '13px', color: theme === 'dark' ? '#fff' : '#000' }}>关联知识库</span>
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
    </div>
  );
};

export default ChatbotSetting;
