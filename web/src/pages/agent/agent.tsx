import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Tree, Card, Row, Col, Avatar, Empty, Spin, Button, Modal, Form, Input, message, Popconfirm, TreeSelect, Upload, Pagination, Select, Switch, Tag } from 'antd';
import { ApartmentOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, CheckCircleOutlined, CloseCircleOutlined, UploadOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps, UploadProps } from 'antd';
import { agentService, AgentCategory, AgentInstance } from '../../services/agent';
import '../../styles/common.css';
import './agent.less';

const { Sider: LeftSider, Content } = Layout;
const { TextArea } = Input;
const { Option } = Select;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const AgentManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AgentCategory[]>([]);
  const [agents, setAgents] = useState<AgentInstance[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [editAvatarPreview, setEditAvatarPreview] = useState<string>('');
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalAgents, setTotalAgents] = useState<number>(0);
  
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<AgentCategory | null>(null);

  const cardRefs = useRef<{ [key: string]: HTMLDivElement }>({});
  const isChangingPageSize = useRef<boolean>(false);
  const isInitialLoad = useRef<boolean>(true);
  
  // 标签相关状态
  const [tags, setTags] = useState<string[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [showEditTagInput, setShowEditTagInput] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newEditTag, setNewEditTag] = useState('');
  const tagInputRef = useRef<Input>(null);
  const editTagInputRef = useRef<Input>(null);

  const debouncedSearchName = useDebouncedValue(searchName, 500);
  const debouncedSearchCode = useDebouncedValue(searchCode, 500);

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
  }, []);

  useEffect(() => {
    // 只有在非初始加载时才调用分页查询
    if (!isInitialLoad.current) {
      fetchAgents(selectedCategory, 1, pageSize);
    }
  }, [debouncedSearchName, debouncedSearchCode, selectedCategory, filterStatus]);

  const getAllCategoryKeys = (categories: AgentCategory[]): string[] => {
    let keys: string[] = [];
    categories.forEach(category => {
      keys.push(`category-${category.id}`);
      if (category.children && Array.isArray(category.children) && category.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(category.children));
      }
    });
    return keys;
  };

  const fetchCategories = async () => {
    try {
      const data = await agentService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
      
      // 只有首次加载时才自动选择默认分类
      if (isInitialLoad.current) {
        // 查找默认选中的分类
        const findDefaultSelectCategory = (categories: AgentCategory[]): AgentCategory | null => {
          for (const category of categories) {
            if (category.is_default_select) {
              return category;
            }
            if (category.children && category.children.length > 0) {
              const found = findDefaultSelectCategory(category.children);
              if (found) return found;
            }
          }
          return null;
        };
        
        const defaultSelectCategory = findDefaultSelectCategory(data);
        let categoryId = null;
        if (defaultSelectCategory) {
          setSelectedKeys([`category-${defaultSelectCategory.id}`]);
          setSelectedCategory(defaultSelectCategory.id);
          categoryId = defaultSelectCategory.id;
        }
        
        // 标记初始加载完成
        isInitialLoad.current = false;
        
        // 延迟调用fetchAgents，确保在状态更新后执行
        setTimeout(() => {
          fetchAgents(categoryId, 1, pageSize);
        }, 0);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchAgents = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      const response = await agentService.getAgents(
        page !== undefined ? page : currentPage,
        size !== undefined ? size : pageSize,
        categoryId || selectedCategory,
        debouncedSearchName,
        debouncedSearchCode,
        filterStatus || undefined
      );
      setAgents(response.data || []);
      setTotalAgents(response.total || 0);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      setAgents([]);
      setTotalAgents(0);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...categories.map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: AgentCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order,
      is_default_select: category.is_default_select || false
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
  };

  const flattenAllCategories = (cats: AgentCategory[]): AgentCategory[] => {
    let result: AgentCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const handleCategorySort = async (category: AgentCategory, direction: 'up' | 'down') => {
    try {
      const allCategories = flattenAllCategories(categories);
      const siblingCategories = allCategories.filter(c => 
        !c.is_default && 
        c.parent_id === category.parent_id
      );
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

      await agentService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await agentService.updateCategory(targetCategory.id, { sort_order: category.sort_order });

      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: AgentCategory) => {
    try {
      await agentService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await agentService.createCategory(values);
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
      await agentService.updateCategory(editingCategory.id, values);
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

    const categoryNodes: TreeDataNode[] = [];

    const buildCategoryNode = (category: AgentCategory): TreeDataNode => {
      return {
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
        children: category.children && Array.isArray(category.children) && category.children.length > 0 
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      };
    };

    const defaultCategories = categories.filter(category => category.is_default);
    const normalCategories = categories.filter(category => !category.is_default);

    defaultCategories.forEach(category => {
      categoryNodes.push({
        title: (
          <div className="category-tree-node" style={{ cursor: 'pointer' }}>
            <div className="category-name">{category.name}</div>
          </div>
        ),
        key: `category-${category.id}`,
        children: category.children && Array.isArray(category.children) && category.children.length > 0 
          ? category.children.map(child => buildCategoryNode(child))
          : undefined,
      });
    });

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

  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: AgentCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0
        ? category.children.map(child => buildNode(child))
        : undefined,
    });
    return categories.map(category => buildNode(category));
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

  const parseTags = (tagsStr?: string): string[] => {
    if (!tagsStr) return [];
    try {
      const parsed = JSON.parse(tagsStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleCardClick = (agentId: string) => {
    navigate(`/agent/setting/${agentId}`);
  };

  const handleCardMouseMove = (agentId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRefs.current[agentId];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  const handleAddAgent = () => {
    form.resetFields();
    setAvatarPreview('');
    setTags([]);
    setShowTagInput(false);
    setNewTag('');
    setIsModalVisible(true);
  };

  const handleEditAgent = (agent: AgentInstance) => {
    setEditingAgentId(agent.id);
    
    // 解析标签数据
    let tagsArray: string[] = [];
    if (agent.tags) {
      try {
        tagsArray = typeof agent.tags === 'string' ? JSON.parse(agent.tags) : agent.tags;
      } catch (e) {
        console.error('Failed to parse tags:', e);
        tagsArray = [];
      }
    }
    
    editForm.setFieldsValue({
      name: agent.name,
      code: agent.code,
      description: agent.description,
      avatar: agent.avatar,
      category_id: agent.category_id,
      status: agent.status !== false
    });
    setEditAvatarPreview(agent.avatar || '');
    setEditTags(tagsArray);
    setShowEditTagInput(false);
    setNewEditTag('');
    setIsEditModalVisible(true);
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

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 处理标签数据，转换为JSON字符串
      const submitData = {
        ...values,
        tags: tags.length > 0 ? JSON.stringify(tags) : null
      };
      
      await agentService.createAgent(submitData);
      message.success('智能体创建成功！');
      setIsModalVisible(false);
      form.resetFields();
      setAvatarPreview('');
      setTags([]);
      setShowTagInput(false);
      setNewTag('');
      fetchAgents(selectedCategory);
    } catch (error) {
      console.error('创建失败:', error);
    }
  };

  const handleEditModalOk = async () => {
    if (!editingAgentId) return;
    try {
      const values = await editForm.validateFields();
      
      // 处理标签数据，转换为JSON字符串
      const submitData = {
        ...values,
        tags: editTags.length > 0 ? JSON.stringify(editTags) : null
      };
      
      await agentService.updateAgent(editingAgentId, submitData);
      message.success('智能体更新成功！');
      setIsEditModalVisible(false);
      editForm.resetFields();
      setEditingAgentId(null);
      setEditTags([]);
      setShowEditTagInput(false);
      setNewEditTag('');
      fetchAgents(selectedCategory);
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await agentService.deleteAgent(agentId);
      message.success('智能体删除成功！');
      fetchAgents(selectedCategory);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleAddEditTag = () => {
    if (newEditTag.trim() && !editTags.includes(newEditTag.trim())) {
      setEditTags([...editTags, newEditTag.trim()]);
      setNewEditTag('');
    }
  };

  const handleRemoveEditTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const getDefaultAvatar = () => {
    return '../../assets/agent/default_workflow.svg';
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <Layout className="agent-layout">
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
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)',
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

        <Content className={`agent-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center',padding:'16px' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddAgent}
              style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)',
                border: 'none',
                borderRadius: '18px',
                padding: '0 20px',
                height: '36px'
              }}
            >
              新增智能体
            </Button>
            <Input
              placeholder="搜索智能体名称"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
              style={{
                width: '200px',
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
            <Input
              placeholder="搜索智能体编码"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
              style={{
                width: '200px',
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
              placeholder="按状态筛选"
              value={filterStatus}
              onChange={setFilterStatus}
              style={{
                width: '120px',
                height: '36px',
                borderRadius: '18px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                border: 'none',
                color: theme === 'dark' ? '#ffffff' : '#000000'
              }}
            >
              <Option value="">全部状态</Option>
              <Option value="true">启用</Option>
              <Option value="false">禁用</Option>
            </Select>
          </div>

          <div style={{ 
            flex: 1, 
            minHeight: 0,
            overflowY: 'auto', 
            marginBottom: '0',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }} className="hide-scrollbar">
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {loading ? (
              <div className="loading-container">
                <Spin size="large" />
              </div>
            ) : agents.length === 0 ? (
              <Empty 
                description="暂无智能体" 
                className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} 
              />
            ) : (
              <Row gutter={[16, 16]}>
                {agents.map((agent, index) => (
                  <Col 
                    key={agent.id} 
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
                        if (el) cardRefs.current[agent.id] = el;
                      }}
                      onMouseMove={(e) => handleCardMouseMove(agent.id, e)}
                    >
                      <Card
                        hoverable
                        className={`agent-card ${theme === 'dark' ? 'dark' : 'light'}`}
                        bodyStyle={{ padding: '16px' }}
                      >
                        <div className="card-content">
                          <div className="card-actions">
                            <Button 
                              type="text" 
                              icon={<EditOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAgent(agent);
                              }}
                              className="action-button"
                              title="编辑"
                            />
                            <Popconfirm
                              title="确认删除"
                              description="确定要删除这个智能体吗？"
                              onConfirm={(e) => {
                                e.stopPropagation();
                                handleDeleteAgent(agent.id);
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
                          <div className="card-main" onClick={() => handleCardClick(agent.id)}>
                            <div className="card-avatar-container">
                              <Avatar
                                size={72}
                                icon={<ApartmentOutlined />}
                                src={agent.avatar || getDefaultAvatar()}
                                className="card-avatar"
                              />
                            </div>
                            <div className="card-title">{agent.name}</div>
                            <div className="card-meta">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <div className="card-code" style={{ fontSize: '13px', color: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                                  {agent.code}
                                </div>
                                <div className="card-status">
                                  {agent.status !== false ? (
                                    <Tag icon={<CheckCircleOutlined />} color="success">启用</Tag>
                                  ) : (
                                    <Tag icon={<CloseCircleOutlined />} color="error">禁用</Tag>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div className="card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: 0 }}>
                                  {parseTags(agent.tags).slice(0, 3).map((tag, idx) => (
                                    <Tag key={idx} style={{ marginBottom: 0 }}>{tag}</Tag>
                                  ))}
                                  {parseTags(agent.tags).length > 3 && (
                                    <Tag style={{ marginBottom: 0 }}>+{parseTags(agent.tags).length - 3}</Tag>
                                  )}
                                </div>
                                <div className="card-date">{formatDate(agent.created_at)}</div>
                              </div>
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

          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalAgents}
              onChange={(page) => {
                if (!isChangingPageSize.current) {
                  setCurrentPage(page);
                  fetchAgents(selectedCategory, page, pageSize);
                } else {
                  isChangingPageSize.current = false;
                }
              }}
              onShowSizeChange={(current, size) => {
                isChangingPageSize.current = true;
                setPageSize(size);
                setCurrentPage(1);
                fetchAgents(selectedCategory, 1, size);
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
              }}
              className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
              style={{ margin: 0 }}
            />
          </div>
        </Content>
      </Layout>

      <Modal
        title="新增智能体"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`agent-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="智能体名称"
            rules={[{ required: true, message: '请输入智能体名称' }]}
          >
            <Input placeholder="请输入智能体名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="智能体编码"
            rules={[
              { required: true, message: '请输入智能体编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入智能体编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="智能体描述"
            rules={[{ required: true, message: '请输入智能体描述' }]}
          >
            <TextArea rows={3} placeholder="请输入描述，介绍智能体的功能" />
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
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {avatarPreview && (
                <>
                  <img 
                    src={avatarPreview} 
                    alt="头像预览" 
                    style={{ 
                      width: 60, 
                      height: 60, 
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
                    }}
                  >
                    清空
                  </Button>
                </>
              )}
              <Upload {...uploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>
          <Form.Item label="标签">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {tags.map((tag, index) => (
                  <Tag
                    key={index}
                    closable
                    onClose={() => handleRemoveTag(tag)}
                    style={{ 
                      background: theme === 'dark' ? 'rgba(24, 144, 255, 0.2)' : '#f0f0f0',
                      border: '1px solid #1890ff',
                      color: theme === 'dark' ? '#fff' : '#000'
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
                {showTagInput ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Input
                      ref={tagInputRef}
                      type="text"
                      size="small"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="输入标签"
                      style={{ width: 120, height: 24 }}
                    />
                    <Button size="small" onClick={handleAddTag} style={{ height: 24 }}>添加</Button>
                    <Button size="small" onClick={() => setShowTagInput(false)} style={{ height: 24 }}>取消</Button>
                  </div>
                ) : (
                  <Tag
                    onClick={() => {
                      setShowTagInput(true);
                      setTimeout(() => tagInputRef.current?.focus(), 100);
                    }}
                    style={{ borderStyle: 'dashed', height: 24, minWidth: 80, cursor: 'pointer' }}
                  >
                    <PlusOutlined /> 添加标签
                  </Tag>
                )}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑智能体"
        open={isEditModalVisible}
        onOk={handleEditModalOk}
        onCancel={() => setIsEditModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`agent-modal ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="智能体名称"
            rules={[{ required: true, message: '请输入智能体名称' }]}
          >
            <Input placeholder="请输入智能体名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="智能体编码"
            rules={[
              { required: true, message: '请输入智能体编码' },
              { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }
            ]}
          >
            <Input placeholder="请输入智能体编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item
            name="description"
            label="智能体描述"
            rules={[{ required: true, message: '请输入智能体描述' }]}
          >
            <TextArea rows={3} placeholder="请输入描述，介绍智能体的功能" />
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
            name="avatar"
            label="头像"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {editAvatarPreview && (
                <>
                  <img 
                    src={editAvatarPreview} 
                    alt="头像预览" 
                    style={{ 
                      width: 60, 
                      height: 60, 
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
                      editForm.setFieldsValue({ avatar: '' });
                      setEditAvatarPreview('');
                    }}
                  >
                    清空
                  </Button>
                </>
              )}
              <Upload {...editUploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>点击上传</Button>
              </Upload>
            </div>
          </Form.Item>
          <Form.Item label="标签">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {editTags.map((tag, index) => (
                  <Tag
                    key={index}
                    closable
                    onClose={() => handleRemoveEditTag(tag)}
                    style={{ 
                      background: theme === 'dark' ? 'rgba(24, 144, 255, 0.2)' : '#f0f0f0',
                      border: '1px solid #1890ff',
                      color: theme === 'dark' ? '#fff' : '#000'
                    }}
                  >
                    {tag}
                  </Tag>
                ))}
                {showEditTagInput ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Input
                      ref={editTagInputRef}
                      type="text"
                      size="small"
                      value={newEditTag}
                      onChange={(e) => setNewEditTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddEditTag()}
                      placeholder="输入标签"
                      style={{ width: 120, height: 24 }}
                    />
                    <Button size="small" onClick={handleAddEditTag} style={{ height: 24 }}>添加</Button>
                    <Button size="small" onClick={() => setShowEditTagInput(false)} style={{ height: 24 }}>取消</Button>
                  </div>
                ) : (
                  <Tag
                    onClick={() => {
                      setShowEditTagInput(true);
                      setTimeout(() => editTagInputRef.current?.focus(), 100);
                    }}
                    style={{ borderStyle: 'dashed', height: 24, minWidth: 80, cursor: 'pointer' }}
                  >
                    <PlusOutlined /> 添加标签
                  </Tag>
                )}
              </div>
            </div>
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onOk={handleCategorySubmit}
        onCancel={() => setIsCategoryModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`agent-modal ${theme === 'dark' ? 'dark' : 'light'}`}
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
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            initialValue={1}
            rules={[{ required: true, message: '请输入排序顺序' }]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
          <Form.Item
            name="is_default_select"
            label="默认选中"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑分类"
        open={isCategoryEditModalVisible}
        onOk={handleCategoryEditSubmit}
        onCancel={() => setIsCategoryEditModalVisible(false)}
        width={600}
        okText="保存"
        cancelText="取消"
        className={`agent-modal ${theme === 'dark' ? 'dark' : 'light'}`}
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
            <TreeSelect
              placeholder="请选择父分类"
              treeData={buildCategoryTreeSelectData()}
              treeDefaultExpandAll
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="sort_order"
            label="排序顺序"
            rules={[{ required: true, message: '请输入排序顺序' }]}
          >
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
          <Form.Item
            name="is_default_select"
            label="默认选中"
            valuePropName="checked"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentManagement;
