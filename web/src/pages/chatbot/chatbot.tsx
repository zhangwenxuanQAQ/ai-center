import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Avatar, Tag, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, Upload, message, Dropdown, Popconfirm, Pagination } from 'antd';
const { TextArea } = Input;
import { RobotOutlined, HomeOutlined, PlusOutlined, UploadOutlined, MoreOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
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
  const [editingChatbotId, setEditingChatbotId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [searchSourceType, setSearchSourceType] = useState<string>('');
  const [filteredChatbots, setFilteredChatbots] = useState<Chatbot[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalChatbots, setTotalChatbots] = useState<number>(0);
  
  // 分类相关状态
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<ChatbotCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  
  // 卡片引用
  const cardRefs = useRef<{ [key: number]: HTMLDivElement }>({});
  // 防止切换pageSize时重复调用API的标志
  const isChangingPageSize = useRef<boolean>(false);

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

  useEffect(() => {
    // 当搜索关键词或来源类型变化时，重新获取数据
    fetchChatbots(selectedCategory, 1, pageSize);
  }, [searchKeyword, searchSourceType, selectedCategory]); // 移除pageSize依赖，避免修改每页大小时重复调用



  // 递归获取所有分类节点的键
  const getAllCategoryKeys = (categories: ChatbotCategory[]): string[] => {
    let keys: string[] = [];
    categories.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const fetchCategories = async () => {
    try {
      const data = await chatbotService.getCategoryTree();
      console.log('Fetched categories:', data);
      setCategories(data);
      // 计算所有需要展开的节点键
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchChatbots = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      const response = await chatbotService.getChatbots(
        categoryId || undefined, 
        page !== undefined ? page : currentPage, 
        size !== undefined ? size : pageSize, 
        searchKeyword, 
        searchSourceType || undefined,
        undefined // 不传递编码参数，避免名称过滤时也过滤编码
      );
      const data = response.data;
      setChatbots(data);
      setFilteredChatbots(data);
      setTotalChatbots(response.total);
    } catch (error) {
      console.error('Failed to fetch chatbots:', error);
      // 在错误情况下也设置为空数组，避免undefined错误
      setChatbots([]);
      setFilteredChatbots([]);
      setTotalChatbots(0);
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

  // 分类相关处理函数
  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...categories.map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: ChatbotCategory) => {
    console.log('Editing category:', category);
    console.log('Category parent_id:', category.parent_id);
    console.log('Categories state:', categories);
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  // 扁平化所有分类，包括子分类
  const flattenAllCategories = (cats: ChatbotCategory[]): ChatbotCategory[] => {
    let result: ChatbotCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: ChatbotCategory, direction: 'up' | 'down') => {
    try {
      // 扁平化所有分类
      const allCategories = flattenAllCategories(categories);
      
      // 获取同一父分类下的所有非默认分类
      const siblingCategories = allCategories.filter(c => 
        !c.is_default && 
        c.parent_id === category.parent_id
      );
      
      // 按排序顺序排序
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

      await chatbotService.updateCategoryOrder(category.id, targetCategory.sort_order);
      await chatbotService.updateCategoryOrder(targetCategory.id, category.sort_order);
      
      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: ChatbotCategory) => {
    try {
      await chatbotService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await chatbotService.createCategory(values);
      message.success('分类创建成功！');
      setIsCategoryModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('创建分类失败:', error);
    }
  };

  const handleCategoryEditSubmit = async () => {
    if (!editingCategory) return;
    try {
      const values = await categoryEditForm.validateFields();
      await chatbotService.updateCategory(editingCategory.id, values);
      message.success('分类更新成功！');
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name">全部</div>
        </div>
      ),
      key: 'all',
    };

    // 构建分类节点
    const categoryNodes: TreeDataNode[] = [];

    // 递归构建分类树
    const buildCategoryNode = (category: ChatbotCategory): TreeDataNode => {
    const node: TreeDataNode = {
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          <div className="category-actions">
            <Button
              type="text"
              icon={<UpOutlined />}
              size="small"
              title="上移"
              onClick={(e) => {
                e.stopPropagation();
                handleCategorySort(category, 'up');
              }}
            />
            <Button
              type="text"
              icon={<DownOutlined />}
              size="small"
              title="下移"
              onClick={(e) => {
                e.stopPropagation();
                handleCategorySort(category, 'down');
              }}
            />
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              title="编辑"
              onClick={(e) => {
                e.stopPropagation();
                handleEditCategory(category);
              }}
            />
            <Popconfirm
              title="确认删除"
              description="确定要删除这个分类吗？"
              onConfirm={(e) => {
                e.stopPropagation();
                handleDeleteCategory(category);
              }}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                title="删除"
                className="delete-category-btn"
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </div>
        </div>
      ),
      key: `category-${category.id}`,
      children: category.children && category.children.length > 0 
        ? category.children.map(child => buildCategoryNode(child))
        : undefined,
    };
    return node;
  };

    // 分离默认分类和普通分类
    const defaultCategories = categories.filter(category => category.is_default);
    const normalCategories = categories.filter(category => !category.is_default);

    // 首先添加默认分类（如果存在），默认分类不需要操作按钮
    defaultCategories.forEach(category => {
      categoryNodes.push({
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer' }}>
            <div className="category-name">{category.name}</div>
          </div>
        ),
        key: `category-${category.id}`,
        children: category.children && category.children.length > 0 
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      });
    });

    // 然后添加普通分类，带操作按钮
    normalCategories.forEach(category => {
      categoryNodes.push(buildCategoryNode(category));
    });

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

  // 构建分类下拉树数据
  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: ChatbotCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0
        ? category.children.map(child => buildNode(child))
        : undefined,
    });

    return categories.map(category => buildNode(category));
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
    // 保存正在编辑的机器人ID
    setEditingChatbotId(chatbot.id);
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
      if (editingChatbotId) {
        await chatbotService.updateChatbot(editingChatbotId, chatbotData);
        message.success('机器人更新成功！');
        setIsEditModalVisible(false);
        editForm.resetFields();
        setSelectedEditSourceType('');
        setEditSourceConfig({});
        setEditingChatbotId(null);
        fetchChatbots(selectedCategory);
      } else {
        throw new Error('编辑的机器人ID不存在');
      }
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteChatbot = async (chatbotId: number) => {
    try {
      // 调用后端接口删除机器人（逻辑删除）
      await chatbotService.deleteChatbot(chatbotId);
      
      message.success('机器人删除成功！');
      fetchChatbots(selectedCategory);
    } catch (error) {
      console.error('删除失败:', error);
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
      console.error('创建失败:', error);
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
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>分类</span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddCategory}
              size="small"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '12px',
                padding: '0 12px',
                height: '28px',
                fontSize: '12px'
              }}
            >
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

        <Content className={`chatbot-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* 搜索栏和按钮区域 - 固定位置 */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            <Input
              placeholder="搜索机器人名称"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              style={{
                width: '300px',
                height: '36px',
                borderRadius: '18px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000'
              }}
              className="no-border-input"
            />
            <Select
              placeholder="按来源筛选"
              value={searchSourceType}
              onChange={setSearchSourceType}
              style={{
                width: '200px',
                borderRadius: '18px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000',
                height: '36px'
              }}
            >
              <Option value="">全部来源</Option>
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
          </div>
          
          {/* 机器人列表区域 - 可滚动，隐藏滚动条 */}
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            marginBottom: '0',
            /* 隐藏滚动条但保留滚动功能 */
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
            '&::-webkit-scrollbar': {
              display: 'none' /* Chrome, Safari and Opera */
            }
          }}>
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : filteredChatbots.length === 0 ? (
              <Empty 
                description="暂无机器人" 
                className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
              />
            ) : (
              <Row gutter={[16, 16]}>
                {filteredChatbots.map((chatbot, index) => (
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
          </div>
          
          {/* 分页栏区域 - 固定位置 */}
          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalChatbots}
              onChange={(page) => {
                // 如果是因为切换pageSize导致的页码变化，不调用API
                if (!isChangingPageSize.current) {
                  setCurrentPage(page);
                  fetchChatbots(selectedCategory, page, pageSize);
                } else {
                  // 重置标志，不调用API
                  isChangingPageSize.current = false;
                }
              }}
              onShowSizeChange={(current, size) => {
                // 设置标志，防止onChange回调重复调用API
                isChangingPageSize.current = true;
                // 更新状态
                setPageSize(size);
                setCurrentPage(1);
                // 直接调用API，使用新的size参数
                fetchChatbots(selectedCategory, 1, size);
              }}
              showSizeChanger
              showQuickJumper
              showTotal={(total) => `共 ${total} 条记录`}
              pageSizeOptions={['12', '24', '36', '48']}
              locale={{
                items_per_page: '条/页',
                jump_to: '前往',
                jump_to_confirm: '确定',
                page: '页',
                prev_page: '上一页',
                next_page: '下一页',
                prev_5: '向前 5 页',
                next_5: '向后 5 页',
                prev_3: '向前 3 页',
                next_3: '向后 3 页',
                first: '第一页',
                last: '最后一页'
              }}
              className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{
                margin: 0
              }}
            />
          </div>
        </Content>
      </Layout>

      <Modal
        title="新增机器人"
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
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
            <TreeSelect
              placeholder="请选择分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
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
        okText="保存"
        cancelText="取消"
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
            <TreeSelect
              placeholder="请选择分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="机器人描述"
          >
            <TextArea rows={3} placeholder="请输入机器人描述" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增分类模态框 */}
      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onOk={handleCategorySubmit}
        onCancel={() => setIsCategoryModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分类描述"
          >
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item
            name="parent_id"
            label="父分类"
          >
            <Select placeholder="选择父分类（可选，不选则为顶级分类）">
              <Option value={null}>顶级分类</Option>
              {categories.map(category => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            initialValue={1}
            rules={[
              { required: true, message: '请输入排序顺序' },
              { 
                validator: (_, value) => {
                  const num = Number(value);
                  if (value === '' || value === undefined || value === null) {
                    return Promise.reject('请输入排序顺序');
                  }
                  if (isNaN(num)) {
                    return Promise.reject('请输入有效的数字');
                  }
                  if (num < 1) {
                    return Promise.reject('排序号必须大于0');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分类模态框 */}
      <Modal
        title="编辑分类"
        open={isCategoryEditModalVisible}
        onOk={handleCategoryEditSubmit}
        onCancel={() => setIsCategoryEditModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`chatbot-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分类描述"
          >
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item
            name="parent_id"
            label="父分类"
          >
            <Select placeholder="选择父分类（可选，不选则为顶级分类）">
              <Option value={null}>顶级分类</Option>
              {(() => {
                // 扁平化解分类树为一维数组
                const flattenCategories = (cats: ChatbotCategory[]): ChatbotCategory[] => {
                  let result: ChatbotCategory[] = [];
                  cats.forEach(cat => {
                    result.push(cat);
                    if (cat.children) {
                      result = result.concat(flattenCategories(cat.children));
                    }
                  });
                  return result;
                };
                const allCategories = flattenCategories(categories);
                return allCategories
                  .filter(category => !editingCategory || category.id !== editingCategory.id)
                  .map(category => (
                    <Option key={category.id} value={category.id}>
                      {category.name}
                    </Option>
                  ));
              })()}
            </Select>
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            rules={[
              { required: true, message: '请输入排序顺序' },
              { 
                validator: (_, value) => {
                  const num = Number(value);
                  if (value === '' || value === undefined || value === null) {
                    return Promise.reject('请输入排序顺序');
                  }
                  if (isNaN(num)) {
                    return Promise.reject('请输入有效的数字');
                  }
                  if (num < 1) {
                    return Promise.reject('排序号必须大于0');
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ChatbotManagement;