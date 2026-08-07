import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, message, Popconfirm, Pagination, Upload, Tooltip } from 'antd';
import type { UploadProps } from 'antd';
const { TextArea } = Input;
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, ApiOutlined, ApiTwoTone, UploadOutlined, ToolOutlined, ThunderboltOutlined, CodeOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { toolkitService, ToolkitCategory } from '../../services/toolkit';
import { mcpService, MCPServer } from '../../services/mcp';
import '../../styles/common.css';
import './toolkit.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

// 工具类型图标映射
const TOOL_TYPE_ICON: Record<string, React.ReactNode> = {
  mcp: <ApiOutlined />,
  api: <ThunderboltOutlined />,
  code_script: <CodeOutlined />,
  builtin_tool: <ToolOutlined />,
};

// 工具类型颜色映射
const TOOL_TYPE_COLOR: Record<string, string> = {
  mcp: '#5a6fd6',
  api: '#52c41a',
  code_script: '#fa8c16',
  builtin_tool: '#eb2f96',
};

const ToolkitManagement: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ToolkitCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryType, setSelectedCategoryType] = useState<string | null>(null);
  const [selectedKeyType, setSelectedKeyType] = useState<'all' | 'tool_type' | 'category'>('all');
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
  const cardRefs = useRef<{ [key: string]: HTMLDivElement }>({});

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
  const [editingCategory, setEditingCategory] = useState<ToolkitCategory | null>(null);
  const [openKeys, setOpenKeys] = useState<string[]>([]);

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
    fetchSourceTypes();
    fetchTransportTypes();
    fetchLocalMcpConfig();
  }, []);

  // 选中分类或搜索条件变化时重新获取MCP服务
  useEffect(() => {
    setCurrentPage(1);
    fetchServers(1, pageSize);
  }, [selectedCategory, selectedCategoryType, selectedKeyType, searchName, filterSourceType]);

  useEffect(() => {
    fetchServers(currentPage, pageSize);
  }, [currentPage, pageSize]);

  const fetchCategories = async () => {
    try {
      const data = await toolkitService.getCategoryTree();
      setCategories(data);
      const allKeys = data.map(c => `type-${c.type || c.id}`);
      setOpenKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchServers = async (page?: number, size?: number) => {
    setLoading(true);
    try {
      const queryPage = page !== undefined ? page : currentPage;
      const querySize = size !== undefined ? size : pageSize;
      let categoryId: string | undefined;
      let toolType: string | undefined;

      if (selectedKeyType === 'category' && selectedCategory) {
        categoryId = selectedCategory;
      } else if (selectedKeyType === 'tool_type' && selectedCategoryType) {
        toolType = selectedCategoryType;
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

  const flattenAllCategories = (cats: ToolkitCategory[]): ToolkitCategory[] => {
    let result: ToolkitCategory[] = [];
    cats.forEach(cat => {
      result.push(cat);
      if (cat.children && cat.children.length > 0) {
        result = result.concat(flattenAllCategories(cat.children));
      }
    });
    return result;
  };

  const findCategoryById = (cats: ToolkitCategory[], id: string): ToolkitCategory | null => {
    for (const cat of cats) {
      if (cat.id === id) return cat;
      if (cat.children && cat.children.length > 0) {
        const found = findCategoryById(cat.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 获取分类的type（考虑子分类继承父分类type）
  const getCategoryType = (categoryId: string | null): string | null => {
    if (!categoryId) return null;
    const category = findCategoryById(categories, categoryId);
    if (category) {
      if (category.type) return category.type;
      if (category.parent_id) {
        const parent = findCategoryById(categories, category.parent_id);
        return parent?.type || null;
      }
    }
    return null;
  };

  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0
      ? Math.max(...categories.map(c => c.sort_order || 0))
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: ToolkitCategory) => {
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

  const handleCategorySort = async (category: ToolkitCategory, direction: 'up' | 'down') => {
    try {
      const allCategories = flattenAllCategories(categories);
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

      await toolkitService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await toolkitService.updateCategory(targetCategory.id, { sort_order: category.sort_order });

      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: ToolkitCategory) => {
    try {
      await toolkitService.deleteCategory(category.id);
      message.success('分类删除成功！');
      if (selectedCategory === category.id) {
        setSelectedCategory(null);
        setSelectedCategoryType(null);
        setSelectedKeyType('all');
        setSelectedKeys(['all']);
      }
      fetchCategories();
    } catch (error) {
      console.error('删除分类失败:', error);
    }
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields();
      await toolkitService.createCategory(values);
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
      await toolkitService.updateCategory(editingCategory.id, values);
      message.success('分类更新成功！');
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  // 构建Menu数据：全部 + 按工具类型分组的子菜单
  const buildMenuItems = (): MenuProps['items'] => {
    const buildSubMenu = (category: ToolkitCategory): React.ReactNode => {
      return (
        <div className="category-menu-node" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span className="category-name" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {category.name}
            {category.tool_count !== undefined && category.tool_count > 0 && (
              <span className="tool-count" style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>({category.tool_count})</span>
            )}
          </span>
          {!category.is_default && (
            <span className="category-actions" style={{ flexShrink: 0, marginLeft: 8, display: 'flex', gap: 2 }}>
              <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
              <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
              <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
              <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteCategory(category); }} okText="确认" cancelText="取消">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除" className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </span>
          )}
        </div>
      );
    };

    const buildCategoryMenuItems = (category: ToolkitCategory): any => {
      const key = `category-${category.id}`;
      if (category.children && category.children.length > 0) {
        return {
          key,
          label: buildSubMenu(category),
          children: category.children.map(child => buildCategoryMenuItems(child)),
        };
      }
      return {
        key,
        label: buildSubMenu(category),
      };
    };

    const items: any[] = [
      { key: 'all', label: '全部' },
    ];

    categories.forEach(category => {
      const rootKey = `type-${category.type || category.id}`;
      items.push({
        key: rootKey,
        label: (
          <div className="category-menu-node" style={{ display: 'flex', alignItems: 'center' }}>
            {TOOL_TYPE_ICON[category.type || ''] && (
              <span style={{ marginRight: 6, color: TOOL_TYPE_COLOR[category.type || ''] }}>
                {TOOL_TYPE_ICON[category.type || '']}
              </span>
            )}
            <span style={{ flex: 1 }}>{category.name}</span>
            {category.tool_count !== undefined && category.tool_count > 0 && (
              <span className="tool-count" style={{ marginLeft: 6, color: '#888', fontSize: 12 }}>({category.tool_count})</span>
            )}
          </div>
        ),
        children: category.children && category.children.length > 0
          ? category.children.map(child => buildCategoryMenuItems(child))
          : undefined,
      });
    });

    return items;
  };

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    const key = e.key;
    setSelectedKeys([key]);
    if (key === 'all') {
      setSelectedKeyType('all');
      setSelectedCategory(null);
      setSelectedCategoryType(null);
    } else if (key.startsWith('type-')) {
      // 根节点：按工具类型查询，不传category_id
      const toolType = key.replace('type-', '');
      setSelectedKeyType('tool_type');
      setSelectedCategory(null);
      setSelectedCategoryType(toolType);
    } else if (key.startsWith('category-')) {
      // 子分类：按category_id查询
      const categoryId = key.replace('category-', '');
      setSelectedKeyType('category');
      setSelectedCategory(categoryId);
      setSelectedCategoryType(getCategoryType(categoryId));
    }
  };

  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    setOpenKeys(keys as string[]);
  };

  const buildCategoryTreeSelectData = (): any[] => {
    const buildNode = (category: ToolkitCategory): any => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildNode(child)) : undefined,
    });
    return categories.map(category => buildNode(category));
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

  const handleAddServer = () => {
    form.resetFields();
    setSelectedSourceType('local');
    setSelectedTransportType('streamable_http');
    setAvatarPreview('');
    const defaultUrl = `http://${localMcpConfig.host}:${localMcpConfig.port}/mcp`;
    form.setFieldsValue({ source_type: 'local', transport_type: 'streamable_http', url: defaultUrl, category_id: selectedKeyType === 'category' ? (selectedCategory || undefined) : undefined });
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
      fetchCategories();
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
      fetchCategories();
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
      fetchCategories();
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

  const handleCardMouseMove = (serverId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRefs.current[serverId];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  };

  // 判断当前选中的分类是否为mcp类型或全部
  const showMcpList = !selectedCategoryType || selectedCategoryType === 'mcp';

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <Layout className="toolkit-layout">
        <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>工具分类</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} size="small" style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
              新增分类
            </Button>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            onClick={handleMenuClick}
            items={buildMenuItems()}
            className={`category-menu ${theme === 'dark' ? 'dark' : 'light'}`}
          />
        </LeftSider>

        <Content className={`toolkit-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px', boxSizing: 'border-box' }}>
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
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
                <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                {loading ? (
                  <div className="loading-container"><Spin size="large" /></div>
                ) : servers.length === 0 ? (
                  <Empty description="暂无MCP服务" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
                ) : (
                  <Row gutter={[16, 16]}>
                    {servers.map((server, index) => (
                      <Col key={server.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                        <div ref={(el) => { if (el) cardRefs.current[server.id] = el; }} onMouseMove={(e) => handleCardMouseMove(server.id, e)}>
                          <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '16px' }} onClick={() => navigate(`/mcp/setting/${server.id}`)}>
                            <div className="card-content">
                              <div className="card-actions">
                                <Tooltip title="测试连接">
                                  <Button type="text" icon={<ApiTwoTone />} onClick={(e) => { e.stopPropagation(); handleTestServerConnection(server); }} className="action-button" />
                                </Tooltip>
                                <Button type="text" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditServer(server); }} className="action-button" title="编辑" />
                                <Popconfirm title="确认删除" description="确定要删除这个MCP服务吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteServer(server.id); }} okText="确认" cancelText="取消">
                                  <Button type="text" icon={<DeleteOutlined />} danger className="action-button" title="删除" onClick={(e) => e.stopPropagation()} />
                                </Popconfirm>
                              </div>
                              <div className="card-main">
                                <div className="card-avatar-container">
                                  <div className="card-avatar">
                                    {server.avatar ? (
                                      <img src={server.avatar} alt={server.name} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
                                    ) : (
                                      <ApiOutlined style={{ fontSize: '32px' }} />
                                    )}
                                  </div>
                                </div>
                                <div className="card-title">{server.name}</div>
                                <div className="card-meta">
                                  <div className="card-source">{getSourceTypeLabel(server.source_type)} | {getTransportTypeLabel(server.transport_type)}</div>
                                  <div className="card-date">{formatDate(server.created_at)}</div>
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
          ) : (
            /* 非MCP类型分类，显示功能开发中 */
            <div className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`}>
              <Empty description={`${selectedCategoryType === 'api' ? 'API接口' : selectedCategoryType === 'code_script' ? '代码脚本' : selectedCategoryType === 'builtin_tool' ? '内置工具' : '该分类'} 功能开发中`} />
            </div>
          )}
        </Content>
      </Layout>

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
    </div>
  );
};

export default ToolkitManagement;
