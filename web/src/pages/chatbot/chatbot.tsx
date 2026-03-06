import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Avatar, Tag, Empty, Spin, Button, Modal, Form, Input, Select, Upload, message, Dropdown, Popconfirm } from 'antd';
const { TextArea } = Input;
import { RobotOutlined, HomeOutlined, PlusOutlined, UploadOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TreeDataNode, TreeProps, UploadProps } from 'antd';
import { chatbotService, Chatbot, ChatbotCategory } from '../../services/chatbot';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './chatbot.less';

import WorkWeixinIcon from '../../assets/svg/企业微信.svg';
import LocalBotIcon from '../../assets/svg/本地机器人.svg';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

const sourceTypeIcons: Record<string, string> = {
  'work_weixin': WorkWeixinIcon,
  'local': LocalBotIcon,
};

const ChatbotManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ChatbotCategory[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // 新增机器人相关状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [sourceTypes, setSourceTypes] = useState<any[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('');
  const [selectedEditSourceType, setSelectedEditSourceType] = useState<string>('');
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>({});
  const [editSourceConfig, setEditSourceConfig] = useState<Record<string, string>>({});
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string>('');
  
  // 卡片引用
  const cardRefs = useRef<{ [key: number]: HTMLDivElement }>({});

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
    fetchCategories();
    fetchChatbots();
    fetchSourceTypes();
  }, []);

  useEffect(() => {
    fetchChatbots(selectedCategory);
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const data = await chatbotService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchChatbots = async (categoryId?: number | null) => {
    setLoading(true);
    try {
      const data = await chatbotService.getChatbots(categoryId || undefined);
      setChatbots(data);
    } catch (error) {
      console.error('Failed to fetch chatbots:', error);
    } finally {
      setLoading(false);
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

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: '全部',
      key: 'all',
      icon: <HomeOutlined />,
    };

    const categoryNodes: TreeDataNode[] = categories.map(category => ({
      title: category.name,
      key: `category-${category.id}`,
      icon: <RobotOutlined />,
    }));

    return [allNode, ...categoryNodes];
  };

  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length === 0) return;
    
    const key = selectedKeys[0] as string;
    if (key === 'all') {
      setSelectedCategory(null);
    } else if (key.startsWith('category-')) {
      const categoryId = parseInt(key.replace('category-', ''), 10);
      setSelectedCategory(categoryId);
    }
  };

  const getSourceTypeLabel = (sourceType?: string): string => {
    switch (sourceType) {
      case 'work_weixin':
        return '企业微信';
      case 'local':
        return '本地';
      default:
        return '本地';
    }
  };

  const getSourceTypeColor = (sourceType?: string): string => {
    switch (sourceType) {
      case 'work_weixin':
        return 'blue';
      case 'local':
        return 'green';
      default:
        return 'default';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleCardClick = (chatbotId: number) => {
    navigate(`/chatbots/${chatbotId}`);
  };

  const handleCardMouseMove = (chatbotId: number, e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRefs.current[chatbotId];
    if (!card) return;
    
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleAddChatbot = () => {
    form.resetFields();
    setSelectedSourceType('local');
    setSourceConfig({});
    setAvatarPreview('');
    setIsModalVisible(true);
  };

  const handleEditChatbot = (chatbot: Chatbot) => {
    // 填充编辑表单
    editForm.setFieldsValue({
      name: chatbot.name,
      code: chatbot.code,
      source_type: chatbot.source_type,
      greeting: chatbot.greeting,
      avatar: chatbot.avatar,
      category_id: chatbot.category_id,
      description: chatbot.description
    });
    setSelectedEditSourceType(chatbot.source_type || 'local');
    // 处理来源配置
    if (chatbot.source_config) {
      try {
        setEditSourceConfig(JSON.parse(chatbot.source_config));
      } catch (error) {
        setEditSourceConfig({});
      }
    } else {
      setEditSourceConfig({});
    }
    setEditAvatarPreview(chatbot.avatar || '');
    setIsEditModalVisible(true);
  };

  const handleEditSourceTypeChange = (value: string) => {
    setSelectedEditSourceType(value);
    // 自动填充默认值
    const sourceType = sourceTypes.find(st => st.source_type === value);
    if (sourceType && sourceType.config_fields) {
      const defaultConfig: Record<string, string> = {};
      sourceType.config_fields.forEach((field: any) => {
        if (field.default_value) {
          // 如果是回调地址，用当前编码替换占位符
          if (field.name === 'callback_url' && value === 'work_weixin') {
            const currentCode = editForm.getFieldValue('code') || '';
            defaultConfig[field.name] = field.default_value.replace('{code}', currentCode);
          } else {
            defaultConfig[field.name] = field.default_value;
          }
        }
      });
      setEditSourceConfig(defaultConfig);
    } else {
      setEditSourceConfig({});
    }
  };

  const handleEditSourceConfigChange = (field: string, value: string) => {
    setEditSourceConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields();
      
      const sourceConfigFields = getEditSourceConfigFields();
      const chatbotData = {
        ...values,
        source_config: selectedEditSourceType && sourceConfigFields.length > 0 ? JSON.stringify(editSourceConfig) : undefined
      };
      
      console.log('Submitting edited chatbot:', chatbotData);
      
      // 调用后端接口更新机器人
      await chatbotService.updateChatbot(chatbotData);
      
      message.success('机器人更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setSelectedEditSourceType('');
      setEditSourceConfig({});
      fetchChatbots(selectedCategory);
    } catch (error) {
      console.error('Form validation failed:', error);
      message.error('更新失败，请重试');
    }
  };

  const handleDeleteChatbot = async (chatbotId: number) => {
    try {
      // 调用后端接口删除机器人（逻辑删除）
      await chatbotService.deleteChatbot(chatbotId);
      
      message.success('机器人删除成功！');
      fetchChatbots(selectedCategory);
    } catch (error) {
      console.error('Delete chatbot failed:', error);
      message.error('删除失败，请重试');
    }
  };

  const getEditSourceConfigFields = () => {
    const sourceType = sourceTypes.find(st => st.source_type === selectedEditSourceType);
    if (!sourceType) return [];
    return sourceType.config_fields || [];
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    // 当来源是企业微信时，自动更新回调地址中的编码
    if (selectedSourceType === 'work_weixin') {
      const callbackField = getSourceConfigFields().find(f => f.name === 'callback_url');
      if (callbackField && callbackField.default_value) {
        const callbackUrl = callbackField.default_value.replace('{code}', code);
        setSourceConfig(prev => ({
          ...prev,
          callback_url: callbackUrl
        }));
      }
    }
  };

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value);
    // 自动填充默认值
    const sourceType = sourceTypes.find(st => st.source_type === value);
    if (sourceType && sourceType.config_fields) {
      const defaultConfig: Record<string, string> = {};
      sourceType.config_fields.forEach((field: any) => {
        if (field.default_value) {
          // 如果是回调地址，用空编码替换占位符
          if (field.name === 'callback_url' && value === 'work_weixin') {
            const currentCode = form.getFieldValue('code') || '';
            defaultConfig[field.name] = field.default_value.replace('{code}', currentCode);
          } else {
            defaultConfig[field.name] = field.default_value;
          }
        }
      });
      setSourceConfig(defaultConfig);
    } else {
      setSourceConfig({});
    }
  };

  const handleSourceConfigChange = (field: string, value: string) => {
    setSourceConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const sourceConfigFields = getSourceConfigFields();
      const chatbotData = {
        ...values,
        source_config: selectedSourceType && sourceConfigFields.length > 0 ? JSON.stringify(sourceConfig) : undefined
      };
      
      console.log('Submitting chatbot:', chatbotData);
      
      // 调用后端接口创建机器人
      await chatbotService.createChatbot(chatbotData);
      
      message.success('机器人创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setSelectedSourceType('');
      setSourceConfig({});
      fetchChatbots(selectedCategory);
    } catch (error) {
      console.error('Form validation failed:', error);
      message.error('创建失败，请重试');
    }
  };

  const compressImage = (file: File, maxWidth: number = 100, quality: number = 0.5): Promise<string> => {
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
        img.onerror = reject;
      };
      reader.onerror = reject;
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
      setTimeout(() => {
        if (onSuccess) {
          onSuccess({ status: 'done' }, file);
        }
      }, 0);
    },
    onChange: handleAvatarChange,
  };

  const editUploadProps: UploadProps = {
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
      setTimeout(() => {
        if (onSuccess) {
          onSuccess({ status: 'done' }, file);
        }
      }, 0);
    },
    onChange: handleEditAvatarChange,
  };

  const getSourceConfigFields = () => {
    const sourceType = sourceTypes.find(st => st.source_type === selectedSourceType);
    if (!sourceType) return [];
    return sourceType.config_fields || [];
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader 
        items={[
          { title: '机器人管理', icon: <RobotOutlined /> }
        ]} 
      />

      <Layout className="chatbot-layout">
        <LeftSider
          width={260}
          className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}
        >
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span>分类</span>
          </div>
          <Tree
            showIcon
            defaultSelectedKeys={['all']}
            onSelect={handleTreeSelect}
            treeData={buildTreeData()}
            className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`}
          />
        </LeftSider>

        <Content className={`chatbot-content ${theme === 'dark' ? 'dark' : 'light'}`}>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddChatbot}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '18px',
                padding: '0 20px',
                height: '36px'
              }}
            >
              新增机器人
            </Button>
          </div>
          {loading ? (
            <div className="loading-container">
              <Spin size="large" />
            </div>
          ) : chatbots.length === 0 ? (
            <Empty 
              description="暂无机器人" 
              className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
            />
          ) : (
            <Row gutter={[16, 16]}>
              {chatbots.map((chatbot, index) => (
                <Col 
                  key={chatbot.id} 
                  xs={24} 
                  sm={12} 
                  md={8} 
                  lg={6}
                  style={{ 
                    animationDelay: `${index * 0.1}s`,
                    animationFillMode: 'both'
                  }}
                >
                  <div
                    ref={(el) => {
                      if (el) cardRefs.current[chatbot.id] = el;
                    }}
                    onMouseMove={(e) => handleCardMouseMove(chatbot.id, e)}
                  >
                    <Card
                      hoverable
                      className={`chatbot-card ${theme === 'dark' ? 'dark' : 'light'}`}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div className="card-content">
                        <div className="card-actions">
                          <Button 
                            type="text" 
                            icon={<EditOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditChatbot(chatbot);
                            }}
                            className="action-button"
                            title="编辑"
                          />
                          <Popconfirm
                              title="确认删除"
                              description="确定要删除这个机器人吗？"
                              onConfirm={(e) => {
                                e.stopPropagation();
                                handleDeleteChatbot(chatbot.id);
                              }}
                              okText="确认"
                              cancelText="取消"
                            >
                              <Button 
                                type="text" 
                                icon={<DeleteOutlined />}
                                danger
                                className="action-button"
                                title="删除"
                              />
                            </Popconfirm>
                        </div>
                        <div className="card-main" onClick={() => handleCardClick(chatbot.id)}>
                          <div className="card-avatar-container">
                            <Avatar
                              size={72}
                              icon={<RobotOutlined />}
                              src={chatbot.avatar}
                              className="card-avatar"
                            />
                          </div>
                          <div className="card-title">{chatbot.name}</div>
                          <div className="card-meta">
                            <div className="card-source">
                              <img 
                                src={sourceTypeIcons[chatbot.source_type || 'local']} 
                                alt="" 
                                style={{ 
                                  width: 16, 
                                  height: 16,
                                  marginRight: 8,
                                  filter: theme === 'dark' ? 'invert(1) brightness(100%)' : 'none'
                                }} 
                              />
                              <span>{getSourceTypeLabel(chatbot.source_type)}</span>
                            </div>
                            <div className="card-date">{formatDate(chatbot.created_at)}</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </Content>
      </Layout>

      <Modal
        title="新增机器人"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            greeting: '你好，请问有什么需要提问的？',
            source_type: 'local'
          }}
        >
          <Form.Item
            name="name"
            label="机器人名称"
            rules={[{ required: true, message: '请输入机器人名称' }]}
          >
            <Input placeholder="请输入机器人名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="机器人编码"
            rules={[
              { required: true, message: '请输入机器人编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入机器人编码（字母、数字、下划线）" onChange={handleCodeChange} />
          </Form.Item>

          <Form.Item
            name="source_type"
            label="来源"
            rules={[{ required: true, message: '请选择来源' }]}
          >
            <Select 
              placeholder="请选择来源" 
              onChange={handleSourceTypeChange}
            >
              {sourceTypes.map(source => (
                <Option key={source.source_type} value={source.source_type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img 
                      src={sourceTypeIcons[source.source_type]} 
                      alt="" 
                      style={{ 
                        width: 20, 
                        height: 20,
                        filter: theme === 'dark' ? 'invert(1) brightness(100%)' : 'none'
                      }} 
                    />
                    <span>{source.source_name}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedSourceType && getSourceConfigFields().map(field => (
            <Form.Item
              key={field.name}
              label={field.title}
              rules={field.required ? [{ required: true, message: `请输入${field.title}` }] : []}
            >
              <Input 
                placeholder={field.description} 
                value={sourceConfig[field.name]}
                onChange={(e) => handleSourceConfigChange(field.name, e.target.value)}
              />
            </Form.Item>
          ))}

          <Form.Item
            name="greeting"
            label="欢迎语"
            rules={[{ required: true, message: '请输入欢迎语' }]}
          >
            <TextArea rows={2} placeholder="请输入欢迎语" />
          </Form.Item>

          <Form.Item
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {avatarPreview && (
                <img 
                  src={avatarPreview} 
                  alt="头像预览" 
                  style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '2px solid #d9d9d9'
                  }} 
                />
              )}
              <Upload {...uploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>

          <Form.Item
            name="category_id"
            label="分类"
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="机器人描述"
          >
            <TextArea rows={3} placeholder="请输入机器人描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑机器人模态框 */}
      <Modal
        title="编辑机器人"
        open={isEditModalVisible}
        onOk={handleEditSubmit}
        onCancel={() => setIsEditModalVisible(false)}
        width={600}
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form
          form={editForm}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="机器人名称"
            rules={[{ required: true, message: '请输入机器人名称' }]}
          >
            <Input placeholder="请输入机器人名称" />
          </Form.Item>

          <Form.Item
            name="code"
            label="机器人编码"
            rules={[
              { required: true, message: '请输入机器人编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入机器人编码（字母、数字、下划线）" />
          </Form.Item>

          <Form.Item
            name="source_type"
            label="来源"
            rules={[{ required: true, message: '请选择来源' }]}
          >
            <Select 
              placeholder="请选择来源" 
              onChange={handleEditSourceTypeChange}
            >
              {sourceTypes.map(source => (
                <Option key={source.source_type} value={source.source_type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img 
                      src={sourceTypeIcons[source.source_type]} 
                      alt="" 
                      style={{ 
                        width: 20, 
                        height: 20,
                        filter: theme === 'dark' ? 'invert(1) brightness(100%)' : 'none'
                      }} 
                    />
                    <span>{source.source_name}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedEditSourceType && getEditSourceConfigFields().map(field => (
            <Form.Item
              key={field.name}
              label={field.title}
              rules={field.required ? [{ required: true, message: `请输入${field.title}` }] : []}
            >
              <Input 
                placeholder={field.description} 
                value={editSourceConfig[field.name]}
                onChange={(e) => handleEditSourceConfigChange(field.name, e.target.value)}
              />
            </Form.Item>
          ))}

          <Form.Item
            name="greeting"
            label="欢迎语"
            rules={[{ required: true, message: '请输入欢迎语' }]}
          >
            <TextArea rows={2} placeholder="请输入欢迎语" />
          </Form.Item>

          <Form.Item
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {editAvatarPreview && (
                <img 
                  src={editAvatarPreview} 
                  alt="头像预览" 
                  style={{ 
                    width: 80, 
                    height: 80, 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '2px solid #d9d9d9'
                  }} 
                />
              )}
              <Upload {...editUploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>

          <Form.Item
            name="category_id"
            label="分类"
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="机器人描述"
          >
            <TextArea rows={3} placeholder="请输入机器人描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChatbotManagement;