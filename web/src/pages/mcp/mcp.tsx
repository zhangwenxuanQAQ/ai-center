import React, { useState, useEffect, useRef } from 'react';
import { Layout, Tree, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, message, Popconfirm, Pagination } from 'antd';
const { TextArea } = Input;
import { ApiOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
import type { TreeDataNode, TreeProps } from 'antd';
import { mcpService, MCPServer, MCPCategory } from '../../services/mcp';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './mcp.less';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;

const MCPManagement: React.FC = () => {
  const [categories, setCategories] = useState<MCPCategory[]>([]);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [sourceTypes, setSourceTypes] = useState<Record<string, string>>({});
  const [transportTypes, setTransportTypes] = useState<Record<string, string>>({});
  const [selectedSourceType, setSelectedSourceType] = useState<string>('thirdparty');
  const [selectedEditSourceType, setSelectedEditSourceType] = useState<string>('thirdparty');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('streamable_http');
  const [selectedEditTransportType, setSelectedEditTransportType] = useState<string>('streamable_http');
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalServers, setTotalServers] = useState<number>(0);
  
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<MCPCategory | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  
  const cardRefs = useRef<{ [key: string]: HTMLDivElement }>({});

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
    fetchServers();
    fetchSourceTypes();
    fetchTransportTypes();
  }, []);

  useEffect(() => {
    fetchServers(selectedCategory);
  }, [selectedCategory, searchKeyword]);

  const getAllCategoryKeys = (categories: MCPCategory[]): string[] => {
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
      const data = await mcpService.getCategoryTree();
      setCategories(data);
      const allKeys = getAllCategoryKeys(data);
      setExpandedKeys(allKeys);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchServers = async (categoryId?: string | null, page?: number, size?: number) => {
    setLoading(true);
    try {
      const data = await mcpService.getServers(
        page !== undefined ? page : currentPage,
        size !== undefined ? size : pageSize,
        categoryId || undefined,
        searchKeyword || undefined
      );
      setServers(data);
      setTotalServers(data.length);
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

  const handleAddCategory = () => {
    categoryForm.resetFields();
    const maxSortOrder = categories.length > 0 
      ? Math.max(...categories.map(c => c.sort_order || 0)) 
      : 0;
    categoryForm.setFieldsValue({ sort_order: maxSortOrder + 1 });
    setIsCategoryModalVisible(true);
  };

  const handleEditCategory = (category: MCPCategory) => {
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      parent_id: category.parent_id,
      sort_order: category.sort_order
    });
    setEditingCategory(category);
    setIsCategoryEditModalVisible(true);
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

  const handleCategorySort = async (category: MCPCategory, direction: 'up' | 'down') => {
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

      await mcpService.updateCategory(category.id, { sort_order: targetCategory.sort_order });
      await mcpService.updateCategory(targetCategory.id, { sort_order: category.sort_order });
      
      message.success('排序更新成功！');
      fetchCategories();
    } catch (error) {
      console.error('更新排序失败:', error);
    }
  };

  const handleDeleteCategory = async (category: MCPCategory) => {
    try {
      await mcpService.deleteCategory(category.id);
      message.success('分类删除成功！');
      fetchCategories();
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
      fetchCategories();
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
      fetchCategories();
    } catch (error) {
      console.error('更新分类失败:', error);
    }
  };

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };

    const buildCategoryNode = (category: MCPCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          <div className="category-actions">
            <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
            <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
            <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
            <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteCategory(category); }} okText="确认" cancelText="取消">
              <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除" className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
            </Popconfirm>
          </div>
        </div>
      ),
      key: `category-${category.id}`,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildCategoryNode(child)) : undefined,
    });

    const categoryNodes = categories.map(category => buildCategoryNode(category));
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
    return categories.map(category => buildNode(category));
  };

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
    setSelectedSourceType('thirdparty');
    setSelectedTransportType('streamable_http');
    form.setFieldsValue({ source_type: 'thirdparty', transport_type: 'streamable_http' });
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
    setIsEditModalVisible(true);
  };

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value);
    if (value === 'local') {
      setSelectedTransportType('streamable_http');
      form.setFieldsValue({ 
        transport_type: 'streamable_http',
        url: 'http://127.0.0.1:8082/mcp'
      });
    } else {
      form.setFieldsValue({ url: '' });
    }
  };

  const handleEditSourceTypeChange = (value: string) => {
    setSelectedEditSourceType(value);
    if (value === 'local') {
      setSelectedEditTransportType('streamable_http');
      editForm.setFieldsValue({ 
        transport_type: 'streamable_http',
        url: 'http://127.0.0.1:8082/mcp'
      });
    }
  };

  const handleTransportTypeChange = (value: string) => {
    setSelectedTransportType(value);
  };

  const handleEditTransportTypeChange = (value: string) => {
    setSelectedEditTransportType(value);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await mcpService.createServer(values);
      message.success('MCP服务创建成功！');
      setIsModalVisible(false);
      fetchServers(selectedCategory);
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
      fetchServers(selectedCategory);
    } catch (error) {
      console.error('更新失败:', error);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await mcpService.deleteServer(serverId);
      message.success('MCP服务删除成功！');
      fetchServers(selectedCategory);
    } catch (error) {
      console.error('删除失败:', error);
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

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <PageHeader items={[{ title: 'MCP配置', icon: <ApiOutlined /> }]} />

      <Layout className="mcp-layout">
        <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
          <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>分类</span>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} size="small" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
              新增分类
            </Button>
          </div>
          <Tree showIcon selectedKeys={selectedKeys} expandedKeys={expandedKeys} onSelect={handleTreeSelect} onExpand={handleTreeExpand} treeData={buildTreeData()} className={`category-tree ${theme === 'dark' ? 'dark' : 'light'}`} />
        </LeftSider>

        <Content className={`mcp-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddServer} style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}>
              新增MCP服务
            </Button>
            <Input
              placeholder="搜索MCP服务名称"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: '300px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
              className="no-border-input"
            />
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0' }}>
            {loading ? (
              <div className="loading-container"><Spin size="large" /></div>
            ) : servers.length === 0 ? (
              <Empty description="暂无MCP服务" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
            ) : (
              <Row gutter={[16, 16]}>
                {servers.map((server, index) => (
                  <Col key={server.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                    <div ref={(el) => { if (el) cardRefs.current[server.id] = el; }} onMouseMove={(e) => handleCardMouseMove(server.id, e)}>
                      <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '16px' }}>
                        <div className="card-content">
                          <div className="card-actions">
                            <Button type="text" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditServer(server); }} className="action-button" title="编辑" />
                            <Popconfirm title="确认删除" description="确定要删除这个MCP服务吗？" onConfirm={(e) => { e.stopPropagation(); handleDeleteServer(server.id); }} okText="确认" cancelText="取消">
                              <Button type="text" icon={<DeleteOutlined />} danger className="action-button" title="删除" />
                            </Popconfirm>
                          </div>
                          <div className="card-main">
                            <div className="card-avatar-container">
                              <div className="card-avatar">
                                {server.avatar ? (
                                  <img src={server.avatar} alt={server.name} style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover' }} />
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
        </Content>
      </Layout>

      {/* 新增MCP服务模态框 */}
      <Modal title="新增MCP服务" open={isModalVisible} onOk={handleSubmit} onCancel={() => setIsModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`mcp-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={form} layout="vertical" initialValues={{ source_type: 'thirdparty', transport_type: 'streamable_http' }}>
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
            <Input placeholder="请输入服务名称" />
          </Form.Item>
          <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
            <Input placeholder="请输入服务编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
            <Select placeholder="请选择来源类型" onChange={handleSourceTypeChange}>
              {Object.entries(sourceTypes).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="transport_type" label="传输类型" rules={[{ required: true, message: '请选择传输类型' }]}>
            <Select placeholder="请选择传输类型" onChange={handleTransportTypeChange} disabled={selectedSourceType === 'local'}>
              {Object.entries(transportTypes).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="avatar" label="服务头像">
            <Input placeholder="请输入头像URL（可选）" />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
          </Form.Item>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={3} placeholder="请输入服务描述" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: '请输入URL' }]}>
            <Input placeholder="请输入MCP服务URL" disabled={selectedSourceType === 'local'} />
          </Form.Item>
          {selectedTransportType === 'stdio' && (
            <Form.Item name="config" label="NPX命令">
              <TextArea rows={4} placeholder="以高德地图为例: npx -y @amap/amap-maps-mcp-server" />
            </Form.Item>
          )}
          {(selectedTransportType === 'sse' || selectedTransportType === 'streamable_http') && selectedSourceType === 'thirdparty' && (
            <Form.Item name="config" label="自定义参数（JSON格式）">
              <TextArea rows={4} placeholder='请输入JSON格式的自定义参数，例如：{"headers": {"Authorization": "Bearer xxx"}}' />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 编辑MCP服务模态框 */}
      <Modal title="编辑MCP服务" open={isEditModalVisible} onOk={handleEditSubmit} onCancel={() => setIsEditModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`mcp-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
            <Input placeholder="请输入服务名称" />
          </Form.Item>
          <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
            <Input placeholder="请输入服务编码（字母、数字、下划线）" />
          </Form.Item>
          <Form.Item name="source_type" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
            <Select placeholder="请选择来源类型" onChange={handleEditSourceTypeChange}>
              {Object.entries(sourceTypes).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="transport_type" label="传输类型" rules={[{ required: true, message: '请选择传输类型' }]}>
            <Select placeholder="请选择传输类型" onChange={handleEditTransportTypeChange} disabled={selectedEditSourceType === 'local'}>
              {Object.entries(transportTypes).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="avatar" label="服务头像">
            <Input placeholder="请输入头像URL（可选）" />
          </Form.Item>
          <Form.Item name="category_id" label="分类">
            <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
          </Form.Item>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={3} placeholder="请输入服务描述" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: '请输入URL' }]}>
            <Input placeholder="请输入MCP服务URL" disabled={selectedEditSourceType === 'local'} />
          </Form.Item>
          {selectedEditTransportType === 'stdio' && (
            <Form.Item name="config" label="NPX命令">
              <TextArea rows={4} placeholder="以高德地图为例: npx -y @amap/amap-maps-mcp-server" />
            </Form.Item>
          )}
          {(selectedEditTransportType === 'sse' || selectedEditTransportType === 'streamable_http') && selectedEditSourceType === 'thirdparty' && (
            <Form.Item name="config" label="自定义参数（JSON格式）">
              <TextArea rows={4} placeholder='请输入JSON格式的自定义参数，例如：{"headers": {"Authorization": "Bearer xxx"}}' />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 新增分类模态框 */}
      <Modal title="新增分类" open={isCategoryModalVisible} onOk={handleCategorySubmit} onCancel={() => setIsCategoryModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`mcp-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <Select placeholder="选择父分类（可选，不选则为顶级分类）">
              <Option value={null}>顶级分类</Option>
              {categories.map(category => (<Option key={category.id} value={category.id}>{category.name}</Option>))}
            </Select>
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" initialValue={1} rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分类模态框 */}
      <Modal title="编辑分类" open={isCategoryEditModalVisible} onOk={handleCategoryEditSubmit} onCancel={() => setIsCategoryEditModalVisible(false)} width={600} okText="保存" cancelText="取消" className={`mcp-modal ${theme === 'dark' ? 'dark' : 'light'}`}>
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <Select placeholder="选择父分类（可选，不选则为顶级分类）">
              <Option value={null}>顶级分类</Option>
              {flattenAllCategories(categories).filter(category => !editingCategory || category.id !== editingCategory.id).map(category => (<Option key={category.id} value={category.id}>{category.name}</Option>))}
            </Select>
          </Form.Item>
          <Form.Item name="sort_order" label="排序顺序" rules={[{ required: true, message: '请输入排序顺序' }]}>
            <Input type="number" placeholder="请输入排序顺序（大于0）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MCPManagement;