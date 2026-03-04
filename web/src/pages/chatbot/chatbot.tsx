import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Avatar, Tag, Empty, Spin, Button, Breadcrumb, Modal, Form, Input, Select, Upload, message } from 'antd';
const { TextArea } = Input;
import { RobotOutlined, HomeOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { TreeDataNode, TreeProps, UploadProps } from 'antd';
import { chatbotService, Chatbot, ChatbotCategory } from '../../services/chatbot';
import './chatbot.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

const ChatbotManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ChatbotCategory[]>([]);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // 新增机器人相关状态
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [sourceTypes, setSourceTypes] = useState<any[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('');
  const [sourceConfig, setSourceConfig] = useState<Record<string, string>>({});
  
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
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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
    setSelectedSourceType('');
    setSourceConfig({});
    setIsModalVisible(true);
  };

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value);
    setSourceConfig({});
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
      
      const chatbotData = {
        ...values,
        source_config: selectedSourceType ? JSON.stringify(sourceConfig) : undefined
      };
      
      console.log('Submitting chatbot:', chatbotData);
      message.success('机器人创建成功！');
      setIsModalVisible(false);
      fetchChatbots(selectedCategory);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    action: 'https://api.example.com/upload',
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info) {
      if (info.file.status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (info.file.status === 'done') {
        message.success(`${info.file.name} 上传成功`);
        form.setFieldsValue({ avatar: info.file.response.url });
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
      }
    },
  };

  const getSourceConfigFields = () => {
    const sourceType = sourceTypes.find(st => st.source_type === selectedSourceType);
    if (!sourceType) return [];
    return sourceType.config_fields || [];
  };

  return (
    <div className={`chatbot-management ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className={`chatbot-header ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Breadcrumb
          className={theme === 'dark' ? 'dark' : 'light'}
          items={[
            {
              title: (
                <>
                  <HomeOutlined />
                  <span>首页</span>
                </>
              ),
              onClick: () => navigate('/'),
              className: 'breadcrumb-item',
            },
            {
              title: (
                <>
                  <RobotOutlined />
                  <span>机器人管理</span>
                </>
              ),
            },
          ]}
        />
      </div>

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
          <div className={`content-header ${theme === 'dark' ? 'dark' : 'light'}`}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddChatbot}
              className={theme === 'dark' ? 'dark' : ''}
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
                      onClick={() => handleCardClick(chatbot.id)}
                      cover={
                        <div className="card-avatar-wrapper">
                          <Avatar
                            size={80}
                            icon={<RobotOutlined />}
                            src={chatbot.avatar}
                            className="card-avatar"
                          />
                        </div>
                      }
                    >
                      <Card.Meta
                        title={
                          <div className="card-title">
                            {chatbot.name}
                          </div>
                        }
                        description={
                          <div className="card-description">
                            <div className="card-info">
                              <Tag color={getSourceTypeColor(chatbot.source_type)}>
                                {getSourceTypeLabel(chatbot.source_type)}
                              </Tag>
                            </div>
                            <div className="card-date">
                              {formatDate(chatbot.created_at)}
                            </div>
                          </div>
                        }
                      />
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
            greeting: '你好，请问有什么需要提问的？'
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
            name="description"
            label="机器人描述"
            rules={[{ required: true, message: '请输入机器人描述' }]}
          >
            <TextArea rows={3} placeholder="请输入机器人描述" />
          </Form.Item>

          <Form.Item
            name="category_id"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
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
            name="avatar"
            label="头像"
          >
            <Upload {...uploadProps} maxCount={1}>
              <Button icon={<UploadOutlined />}>点击上传</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name="greeting"
            label="欢迎语"
            rules={[{ required: true, message: '请输入欢迎语' }]}
          >
            <TextArea rows={2} placeholder="请输入欢迎语" />
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
                  {source.source_name}
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
                disabled={field.readonly}
                value={sourceConfig[field.name]}
                onChange={(e) => handleSourceConfigChange(field.name, e.target.value)}
              />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
};

export default ChatbotManagement;