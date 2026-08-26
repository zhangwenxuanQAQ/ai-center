import React, { useState, useEffect } from 'react';
import { Layout, Tree, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, Switch, message, Popconfirm, Pagination } from 'antd';
import type { TreeDataNode, TreeProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, ThunderboltOutlined, ClockCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService, ApiServerCategory, ApiServer, HEADER_TYPE_OPTIONS, parseHeaders, stringifyHeaders } from '../../services/api_server';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

interface ApiToolProps {
  theme: 'light' | 'dark';
}

const ApiTool: React.FC<ApiToolProps> = ({ theme }) => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ApiServerCategory[]>([]);
  const [servers, setServers] = useState<ApiServer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 服务相关状态
  const [searchName, setSearchName] = useState<string>('');
  const [searchDescription, setSearchDescription] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalServers, setTotalServers] = useState<number>(0);

  // 分类弹窗
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<ApiServerCategory | null>(null);

  // 服务弹窗
  const [isServerModalVisible, setIsServerModalVisible] = useState(false);
  const [isServerEditModalVisible, setIsServerEditModalVisible] = useState(false);
  const [serverForm] = Form.useForm();
  const [serverEditForm] = Form.useForm();
  const [editingServer, setEditingServer] = useState<ApiServer | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchServers(selectedCategory, 1, pageSize);
  }, [selectedCategory, searchStatus]);

  useEffect(() => {
    fetchServers(selectedCategory, currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 触发搜索（回车或失焦时调用）
  const triggerSearch = () => {
    setCurrentPage(1);
    fetchServers(selectedCategory, 1, pageSize);
  };

  const fetchCategories = async () => {
    try {
      const tree = await apiService.getCategoryTree();
      setCategories(tree);
      const allKeys = getAllCategoryKeys(tree);
      setExpandedKeys(allKeys);
    } catch (error: any) {
      message.error({ content: `获取分类失败: ${error.message}`, key: 'fetchCat' });
    }
  };

  const getAllCategoryKeys = (cats: ApiServerCategory[]): string[] => {
    let keys: string[] = [];
    cats.forEach(c => {
      keys.push(`category-${c.id}`);
      if (c.children && c.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(c.children));
      }
    });
    return keys;
  };

  const fetchServers = async (categoryId: string | null, page: number, size: number) => {
    setLoading(true);
    try {
      const result = await apiService.getServers(page, size, categoryId || undefined, searchName || undefined, searchStatus, searchDescription || undefined);
      setServers(result.data);
      setTotalServers(result.total);
    } catch (error: any) {
      message.error({ content: `获取API服务失败: ${error.message}`, key: 'fetchServer' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  // 构建分类树数据
  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };

    const buildCategoryNode = (category: ApiServerCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>{category.name}</div>
          {!category.is_default && (
            <div className="category-actions">
              <Button type="text" icon={<UpOutlined />} size="small" title="上移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'up'); }} />
              <Button type="text" icon={<DownOutlined />} size="small" title="下移" onClick={(e) => { e.stopPropagation(); handleCategorySort(category, 'down'); }} />
              <Button type="text" icon={<EditOutlined />} size="small" title="编辑" onClick={(e) => { e.stopPropagation(); handleEditCategory(category); }} />
              <Popconfirm title="确认删除" description="确定要删除这个分类吗？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteCategory(category); }} okText="确认" cancelText="取消">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除" className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </div>
          )}
        </div>
      ),
      key: `category-${category.id}`,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildCategoryNode(child)) : undefined,
    });

    const categoryNodes = categories.map(category => buildCategoryNode(category));
    return [allNode, ...categoryNodes];
  };

  const handleTreeSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length === 0) return;
    const key = keys[0] as string;
    setSelectedKeys(keys as string[]);
    if (key === 'all') {
      setSelectedCategory(null);
    } else if (key.startsWith('category-')) {
      setSelectedCategory(key.replace('category-', ''));
    }
  };

  const handleTreeExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys as string[]);
  };

  // 分类排序
  const handleCategorySort = async (category: ApiServerCategory, direction: 'up' | 'down') => {
    try {
      const newSort = direction === 'up' ? (category.sort_order || 0) - 1 : (category.sort_order || 0) + 1;
      await apiService.updateCategory(category.id, { sort_order: newSort });
      fetchCategories();
    } catch (error: any) {
      message.error({ content: `排序失败: ${error.message}`, key: 'sortCat' });
    }
  };

  // 分类CRUD
  const handleAddCategory = () => {
    categoryForm.resetFields();
    categoryForm.setFieldsValue({ parent_id: undefined, sort_order: 0 });
    setIsCategoryModalVisible(true);
  };

  const handleCreateCategory = async () => {
    try {
      const values = await categoryForm.validateFields();
      await apiService.createCategory(values);
      message.success({ content: '分类创建成功', key: 'createCat' });
      setIsCategoryModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `创建失败: ${error.message}`, key: 'createCat' });
    }
  };

  const handleEditCategory = (category: ApiServerCategory) => {
    setEditingCategory(category);
    categoryEditForm.setFieldsValue({
      name: category.name,
      description: category.description,
      sort_order: category.sort_order,
    });
    setIsCategoryEditModalVisible(true);
  };

  const handleUpdateCategory = async () => {
    try {
      const values = await categoryEditForm.validateFields();
      if (!editingCategory) return;
      await apiService.updateCategory(editingCategory.id, values);
      message.success({ content: '分类更新成功', key: 'updateCat' });
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `更新失败: ${error.message}`, key: 'updateCat' });
    }
  };

  const handleDeleteCategory = async (category: ApiServerCategory) => {
    try {
      await apiService.deleteCategory(category.id);
      message.success({ content: '分类删除成功', key: 'deleteCat' });
      if (selectedCategory === category.id) {
        setSelectedCategory(null);
        setSelectedKeys(['all']);
      }
      fetchCategories();
    } catch (error: any) {
      message.error({ content: `删除失败: ${error.message}`, key: 'deleteCat' });
    }
  };

  // 服务CRUD
  const handleAddServer = () => {
    serverForm.resetFields();
    serverForm.setFieldsValue({ headers: [] });
    if (selectedCategory) {
      serverForm.setFieldsValue({ category_id: selectedCategory });
    }
    setIsServerModalVisible(true);
  };

  const handleCreateServer = async () => {
    try {
      const values = await serverForm.validateFields();
      const submitData = { ...values, headers: stringifyHeaders(values.headers) };
      await apiService.createServer(submitData);
      message.success({ content: 'API服务创建成功', key: 'createServer' });
      setIsServerModalVisible(false);
      fetchServers(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `创建失败: ${error.message}`, key: 'createServer' });
    }
  };

  const handleEditServer = (server: ApiServer) => {
    setEditingServer(server);
    serverEditForm.setFieldsValue({
      name: server.name,
      description: server.description,
      url: server.url,
      headers: parseHeaders(server.headers),
      category_id: server.category_id,
      status: server.status !== false,
    });
    setIsServerEditModalVisible(true);
  };

  const handleUpdateServer = async () => {
    try {
      const values = await serverEditForm.validateFields();
      if (!editingServer) return;
      const submitData = { ...values, headers: stringifyHeaders(values.headers) };
      await apiService.updateServer(editingServer.id, submitData);
      message.success({ content: 'API服务更新成功', key: 'updateServer' });
      setIsServerEditModalVisible(false);
      fetchServers(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `更新失败: ${error.message}`, key: 'updateServer' });
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    try {
      await apiService.deleteServer(serverId);
      message.success({ content: 'API服务删除成功', key: 'deleteServer' });
      fetchServers(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      message.error({ content: `删除失败: ${error.message}`, key: 'deleteServer' });
    }
  };

  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: ApiServerCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildNode(child)) : undefined,
    });
    return categories.map(category => buildNode(category));
  };

  // 渲染请求头动态行表单（公共方法，供新增和编辑弹窗复用）
  const renderHeadersForm = () => (
    <Form.List name="headers">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col span={7}>
                <Form.Item {...restField} name={[name, 'key']} noStyle>
                  <Input placeholder="参数名" />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item {...restField} name={[name, 'value']} noStyle>
                  <Input placeholder="参数值" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item {...restField} name={[name, 'type']} noStyle>
                  <Select placeholder="参数类型" options={HEADER_TYPE_OPTIONS} allowClear />
                </Form.Item>
              </Col>
              <Col span={2} style={{ textAlign: 'center' }}>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
              </Col>
            </Row>
          ))}
          <Form.Item>
            <Button type="dashed" onClick={() => add({ key: '', value: '', type: 'string' })} icon={<PlusOutlined />} style={{ width: '100%' }}>
              添加
            </Button>
          </Form.Item>
        </>
      )}
    </Form.List>
  );

  return (
    <>
      <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>API服务分类</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} size="small" style={{ background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
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

      <Content className={`toolkit-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
        {/* 工具栏 */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', padding: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddServer} style={{ background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}>
            新增API服务
          </Button>
          <Input
            placeholder="搜索服务名称"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onPressEnter={triggerSearch}
            onBlur={triggerSearch}
            prefix={<SearchOutlined />}
            style={{ width: '200px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
            className="no-border-input"
            allowClear
            onClear={() => { setSearchName(''); triggerSearch(); }}
          />
          <Input
            placeholder="搜索服务描述"
            value={searchDescription}
            onChange={(e) => setSearchDescription(e.target.value)}
            onPressEnter={triggerSearch}
            onBlur={triggerSearch}
            prefix={<SearchOutlined />}
            style={{ width: '200px', height: '36px', borderRadius: '18px', background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff', border: 'none' }}
            className="no-border-input"
            allowClear
            onClear={() => { setSearchDescription(''); triggerSearch(); }}
          />
          <Select
            placeholder="请选择状态"
            value={searchStatus}
            onChange={(value) => setSearchStatus(value)}
            allowClear
            style={{ width: 120, height: '36px' }}
          >
            <Option value="true">启用</Option>
            <Option value="false">停用</Option>
          </Select>
        </div>

        {/* API服务列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 16px' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {loading ? (
            <div className="loading-container"><Spin size="large" /></div>
          ) : servers.length === 0 ? (
            <Empty description="暂无API服务" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
          ) : (
            <Row gutter={[16, 16]}>
              {servers.map((server, index) => (
                <Col key={server.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                  <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '0' }} onClick={() => navigate(`/api/setting/${server.id}`)}>
                    <div className="card-content">
                      {/* 头部：图标 + 名称 */}
                      <div className="card-header">
                        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' }}>
                          {server.avatar ? (
                            <img src={server.avatar} alt={server.name} style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover' }} />
                          ) : (
                            <ThunderboltOutlined style={{ fontSize: '24px', color: '#fff' }} />
                          )}
                        </div>
                        <div className="card-info">
                          <div className="card-title">{server.name}</div>
                          <div className="card-subtitle">{server.url || '未配置URL'}</div>
                        </div>
                      </div>
                      {/* 中间：描述 */}
                      <div className="card-tags">
                        <span className="card-tag">{server.description || '暂无描述'}</span>
                        <span className="card-tag" style={{ background: server.status === false ? 'rgba(255, 77, 79, 0.1)' : 'rgba(82, 196, 26, 0.1)', color: server.status === false ? '#ff4d4f' : '#52c41a', borderColor: server.status === false ? 'rgba(255, 77, 79, 0.3)' : 'rgba(82, 196, 26, 0.3)' }}>
                          {server.status === false ? '停用' : '启用'}
                        </span>
                      </div>
                      {/* 底部：创建时间 + 操作按钮 */}
                      <div className="card-footer">
                        <div className="card-time">
                          <ClockCircleOutlined /> 创建时间: {formatDate(server.created_at)}
                        </div>
                        <div className="card-actions-bottom">
                          <Button icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditServer(server); }} className="action-btn edit" title="编辑"><span>编辑</span></Button>
                          <Popconfirm title="确认删除" description="确定要删除这个API服务吗？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteServer(server.id); }} okText="确认" cancelText="取消">
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
      </Content>

      {/* 新增分类弹窗 */}
      <Modal
        title="新增分类"
        open={isCategoryModalVisible}
        onOk={handleCreateCategory}
        onCancel={() => setIsCategoryModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <Input placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="parent_id" label="父分类">
            <TreeSelect
              treeData={buildCategoryTreeSelectData()}
              placeholder="请选择父分类（不选为顶级分类）"
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号" initialValue={0}>
            <Input type="number" placeholder="请输入排序序号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑分类弹窗 */}
      <Modal
        title="编辑分类"
        open={isCategoryEditModalVisible}
        onOk={handleUpdateCategory}
        onCancel={() => setIsCategoryEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form form={categoryEditForm} layout="vertical">
          <Form.Item name="name" label="分类名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item name="description" label="分类描述">
            <Input placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序序号">
            <Input type="number" placeholder="请输入排序序号" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增API服务弹窗 */}
      <Modal
        title="新增API服务"
        open={isServerModalVisible}
        onOk={handleCreateServer}
        onCancel={() => setIsServerModalVisible(false)}
        okText="创建"
        cancelText="取消"
        width={700}
      >
        <Form form={serverForm} layout="vertical">
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
            <Input placeholder="请输入API服务名称" />
          </Form.Item>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={2} placeholder="请输入服务描述" />
          </Form.Item>
          <Form.Item name="url" label="基础URL">
            <Input placeholder="例如：https://api.example.com" />
          </Form.Item>
          <Form.Item label="请求头">
            {renderHeadersForm()}
          </Form.Item>
          <Form.Item name="category_id" label="所属分类">
            <TreeSelect
              treeData={buildCategoryTreeSelectData()}
              placeholder="请选择分类"
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑API服务弹窗 */}
      <Modal
        title="编辑API服务"
        open={isServerEditModalVisible}
        onOk={handleUpdateServer}
        onCancel={() => setIsServerEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form form={serverEditForm} layout="vertical">
          <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
            <Input placeholder="请输入API服务名称" />
          </Form.Item>
          <Form.Item name="description" label="服务描述">
            <TextArea rows={2} placeholder="请输入服务描述" />
          </Form.Item>
          <Form.Item name="url" label="基础URL">
            <Input placeholder="例如：https://api.example.com" />
          </Form.Item>
          <Form.Item label="请求头">
            {renderHeadersForm()}
          </Form.Item>
          <Form.Item name="category_id" label="所属分类">
            <TreeSelect
              treeData={buildCategoryTreeSelectData()}
              placeholder="请选择分类"
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default ApiTool;
