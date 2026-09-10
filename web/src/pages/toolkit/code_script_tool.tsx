import React, { useState, useEffect } from 'react';
import { Layout, Tree, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select, TreeSelect, Switch, message, Popconfirm, Pagination, Drawer, Tag, Tooltip } from 'antd';
import type { TreeDataNode, TreeProps } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UpOutlined, DownOutlined, CodeOutlined, ClockCircleOutlined, PlayCircleOutlined, MinusCircleOutlined } from '@ant-design/icons';
import CodeEditor from '../../components/CodeEditor';
import ToolTestResult from '../../components/ToolTestResult';
import ParamValueInput from '../../components/ParamValueInput';
import { codeScriptService, CodeScript, CodeScriptCategory, CodeScriptParam } from '../../services/code_script';

const { Sider: LeftSider, Content } = Layout;
const { Option } = Select;
const { TextArea } = Input;

// 新增脚本默认代码模板（必须包含main方法，支持入参与**kwargs透传）
const DEFAULT_CODE_TEMPLATE = `def main(a=1, b=2, **kwargs):
    # 代码必须包含 main 方法作为执行入口
    # main函数的形参与"入参定义"中的参数名对应，执行时自动注入用户传参
    # **kwargs 可接收用户传入的其余参数
    # 仅允许导入安全模块（json/math/re/datetime/pandas/numpy等）
    # 禁止文件读写、系统命令、网络请求等危险操作
    return {"sum": a + b, "extra": kwargs}
`;

// 入参类型选项（与后端PARAM_TYPES一致）
const PARAM_TYPE_OPTIONS = [
  { label: 'string', value: 'string' },
  { label: 'integer', value: 'integer' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'array', value: 'array' },
  { label: 'object', value: 'object' },
];

interface CodeScriptToolProps {
  theme: 'light' | 'dark';
}

const CodeScriptTool: React.FC<CodeScriptToolProps> = ({ theme }) => {
  const [categories, setCategories] = useState<CodeScriptCategory[]>([]);
  const [scripts, setScripts] = useState<CodeScript[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 脚本相关状态
  const [searchName, setSearchName] = useState<string>('');
  const [searchDescription, setSearchDescription] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [totalScripts, setTotalScripts] = useState<number>(0);

  // 分类弹窗
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCategoryEditModalVisible, setIsCategoryEditModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [categoryEditForm] = Form.useForm();
  const [editingCategory, setEditingCategory] = useState<CodeScriptCategory | null>(null);

  // 脚本编辑弹窗
  const [isScriptModalVisible, setIsScriptModalVisible] = useState(false);
  const [isScriptEditModalVisible, setIsScriptEditModalVisible] = useState(false);
  const [scriptForm] = Form.useForm();
  const [scriptEditForm] = Form.useForm();
  const [editingScript, setEditingScript] = useState<CodeScript | null>(null);
  // 编辑器内容（Form.List外的受控状态，避免弹窗内重复初始化）
  const [editorCode, setEditorCode] = useState<string>(DEFAULT_CODE_TEMPLATE);
  const [editorEditCode, setEditorEditCode] = useState<string>('');

  // 测试执行抽屉
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [testCode, setTestCode] = useState<string>('');
  const [testParams, setTestParams] = useState<CodeScriptParam[]>([]);
  const [testParamsInput, setTestParamsInput] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; result: any; message: string; error?: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchScripts(selectedCategory, 1, pageSize);
  }, [selectedCategory, searchStatus]);

  useEffect(() => {
    fetchScripts(selectedCategory, currentPage, pageSize);
  }, [currentPage, pageSize]);

  // 触发搜索（回车或失焦时调用）
  const triggerSearch = () => {
    setCurrentPage(1);
    fetchScripts(selectedCategory, 1, pageSize);
  };

  const fetchCategories = async () => {
    try {
      const tree = await codeScriptService.getCategoryTree();
      setCategories(tree);
      const allKeys = getAllCategoryKeys(tree);
      setExpandedKeys(allKeys);
    } catch (error: any) {
      message.error({ content: `获取分类失败: ${error.message}`, key: 'fetchCat' });
    }
  };

  const getAllCategoryKeys = (cats: CodeScriptCategory[]): string[] => {
    let keys: string[] = [];
    cats.forEach(c => {
      keys.push(`category-${c.id}`);
      if (c.children && c.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(c.children));
      }
    });
    return keys;
  };

  const fetchScripts = async (categoryId: string | null, page: number, size: number) => {
    setLoading(true);
    try {
      const result = await codeScriptService.getScripts(page, size, categoryId || undefined, searchName || undefined, searchStatus, searchDescription || undefined);
      setScripts(result.data);
      setTotalScripts(result.total);
    } catch (error: any) {
      message.error({ content: `获取代码脚本失败: ${error.message}`, key: 'fetchScript' });
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

    const buildCategoryNode = (category: CodeScriptCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={category.name}>
            {category.name}
          </div>
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
  const handleCategorySort = async (category: CodeScriptCategory, direction: 'up' | 'down') => {
    try {
      const newSort = direction === 'up' ? (category.sort_order || 0) - 1 : (category.sort_order || 0) + 1;
      await codeScriptService.updateCategory(category.id, { sort_order: newSort });
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
      await codeScriptService.createCategory(values);
      message.success({ content: '分类创建成功', key: 'createCat' });
      setIsCategoryModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `创建失败: ${error.message}`, key: 'createCat' });
    }
  };

  const handleEditCategory = (category: CodeScriptCategory) => {
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
      await codeScriptService.updateCategory(editingCategory.id, values);
      message.success({ content: '分类更新成功', key: 'updateCat' });
      setIsCategoryEditModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `更新失败: ${error.message}`, key: 'updateCat' });
    }
  };

  const handleDeleteCategory = async (category: CodeScriptCategory) => {
    try {
      await codeScriptService.deleteCategory(category.id);
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

  // 脚本CRUD
  const handleAddScript = () => {
    scriptForm.resetFields();
    setEditorCode(DEFAULT_CODE_TEMPLATE);
    scriptForm.setFieldsValue({ params: [] });
    if (selectedCategory) {
      scriptForm.setFieldsValue({ category_id: selectedCategory });
    }
    setIsScriptModalVisible(true);
  };

  const handleCreateScript = async () => {
    try {
      const values = await scriptForm.validateFields();
      const submitData = { ...values, content: editorCode };
      await codeScriptService.createScript(submitData);
      message.success({ content: '代码脚本创建成功', key: 'createScript' });
      setIsScriptModalVisible(false);
      fetchScripts(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `创建失败: ${error.message}`, key: 'createScript', duration: 5 });
    }
  };

  const handleEditScript = (script: CodeScript) => {
    setEditingScript(script);
    setEditorEditCode(script.content || '');
    scriptEditForm.setFieldsValue({
      name: script.name,
      description: script.description,
      category_id: script.category_id,
      status: script.status !== false,
      params: (script.params || []).map(p => ({ ...p })),
    });
    setIsScriptEditModalVisible(true);
  };

  const handleUpdateScript = async () => {
    try {
      const values = await scriptEditForm.validateFields();
      if (!editingScript) return;
      const submitData = { ...values, content: editorEditCode };
      await codeScriptService.updateScript(editingScript.id, submitData);
      message.success({ content: '代码脚本更新成功', key: 'updateScript' });
      setIsScriptEditModalVisible(false);
      fetchScripts(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `更新失败: ${error.message}`, key: 'updateScript', duration: 5 });
    }
  };

  const handleDeleteScript = async (scriptId: string) => {
    try {
      await codeScriptService.deleteScript(scriptId);
      message.success({ content: '代码脚本删除成功', key: 'deleteScript' });
      fetchScripts(selectedCategory, currentPage, pageSize);
    } catch (error: any) {
      message.error({ content: `删除失败: ${error.message}`, key: 'deleteScript' });
    }
  };

  // 打开测试执行抽屉
  const openTestDrawer = (script: CodeScript) => {
    setTestCode(script.content || '');
    setTestParams((script.params || []).map(p => ({ ...p })));
    const initialInput: Record<string, any> = {};
    (script.params || []).forEach(p => {
      if (p.default !== undefined && p.default !== null) {
        initialInput[p.name] = p.default;
      }
    });
    setTestParamsInput(initialInput);
    setTestResult(null);
    setTestDrawerVisible(true);
  };

  // 测试参数值变更
  const handleTestParamChange = (paramName: string, value: any) => {
    setTestParamsInput(prev => ({ ...prev, [paramName]: value }));
  };

  // 测试执行代码（通过后端沙箱执行，支持传参）
  const handleTestScript = async () => {
    if (!testCode || !testCode.trim()) {
      message.warning({ content: '代码内容为空', key: 'test' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      // 按参数类型转换输入值：array/object解析JSON，其余过滤空值
      const paramsInput: Record<string, any> = {};
      const typeMap = new Map(testParams.map(p => [p.name, p.type]));
      Object.entries(testParamsInput).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        const paramType = typeMap.get(key);
        if ((paramType === 'array' || paramType === 'object') && typeof value === 'string') {
          try { paramsInput[key] = JSON.parse(value); } catch {
            message.warning({ content: `参数 "${key}" 须为合法JSON`, key: 'test' });
          }
        } else {
          paramsInput[key] = value;
        }
      });
      const result = await codeScriptService.testScriptContent(testCode, 30, paramsInput, testParams);
      // 接口data即为main函数返回的原始结果
      setTestResult({ status: 'success', result: result, message: '执行成功' });
      message.success({ content: '代码执行成功', key: 'test' });
    } catch (error: any) {
      setTestResult({ status: 'error', result: null, message: error.message || '执行失败', error: error.message });
      message.error({ content: `执行失败: ${error.message}`, key: 'test', duration: 5 });
    } finally {
      setTesting(false);
    }
  };

  // 分类树选择数据（弹窗内用）
  const buildCategoryTreeSelectData = (): TreeDataNode[] => {
    const buildNode = (category: CodeScriptCategory): TreeDataNode => ({
      title: category.name,
      value: category.id,
      key: category.id,
      children: category.children && category.children.length > 0 ? category.children.map(child => buildNode(child)) : undefined,
    });
    return categories.map(category => buildNode(category));
  };

  // 渲染入参定义表单（公共方法，供新增和编辑弹窗复用）
  const renderParamsForm = () => (
    <Form.List name="params">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'name']} noStyle rules={[{ required: true, message: '参数名必填' }, { pattern: /^[A-Za-z_][A-Za-z0-9_]*$/, message: '须为合法Python标识符' }]}>
                  <Input placeholder="参数名（对应main形参）" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'type']} noStyle rules={[{ required: true, message: '请选择类型' }]}>
                  <Select placeholder="参数类型" options={PARAM_TYPE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={3}>
                <Form.Item {...restField} name={[name, 'required']} noStyle valuePropName="checked">
                  <Switch checkedChildren="必填" unCheckedChildren="选填" size="small" style={{ marginTop: 4 }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item {...restField} name={[name, 'default']} noStyle>
                  <Input placeholder="默认值（可选）" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item {...restField} name={[name, 'description']} noStyle>
                  <Input placeholder="参数描述（可选）" />
                </Form.Item>
              </Col>
              <Col span={1} style={{ textAlign: 'center' }}>
                <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
              </Col>
            </Row>
          ))}
          <Form.Item>
            <Button type="dashed" onClick={() => add({ name: '', type: 'string', required: false })} icon={<PlusOutlined />} style={{ width: '100%' }}>
              添加入参
            </Button>
          </Form.Item>
        </>
      )}
    </Form.List>
  );

  // 渲染测试入参输入表单（公共组件，按参数类型渲染输入控件）
  const renderTestParamsInput = () => {
    if (!testParams || testParams.length === 0) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>入参设置：</div>
        {testParams.map(param => (
          <ParamValueInput
            key={param.name}
            param={param}
            value={testParamsInput[param.name]}
            onChange={(value) => handleTestParamChange(param.name, value)}
            theme={theme}
          />
        ))}
      </div>
    );
  };

  // 渲染执行结果（公共组件：支持展开收起、成功/失败不同样式）
  const renderTestResult = () => {
    if (!testResult) return null;
    return <ToolTestResult testResult={testResult} theme={theme} maxHeight={300} />;
  };

  return (
    <>
      <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>代码脚本分类</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCategory} size="small" style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddScript} style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}>
            新增代码脚本
          </Button>
          <Input
            placeholder="搜索脚本名称"
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
            placeholder="搜索脚本描述"
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

        {/* 代码脚本列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 16px' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {loading ? (
            <div className="loading-container"><Spin size="large" /></div>
          ) : scripts.length === 0 ? (
            <Empty description="暂无代码脚本" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
          ) : (
            <Row gutter={[16, 16]}>
              {scripts.map((script, index) => (
                <Col key={script.id} xs={24} sm={12} md={8} lg={6} style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                  <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`} bodyStyle={{ padding: '0' }} onClick={() => handleEditScript(script)}>
                    <div className="card-content">
                      {/* 头部：图标 + 名称 */}
                      <div className="card-header">
                        <div className="card-icon" style={{ background: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)' }}>
                          <CodeOutlined style={{ fontSize: '24px', color: '#fff' }} />
                        </div>
                        <div className="card-info">
                          <div className="card-title">{script.name}</div>
                          <div className="card-subtitle">{script.description || '暂无描述'}</div>
                        </div>
                      </div>
                      {/* 中间：状态 + 入参数量 */}
                      <div className="card-tags">
                        <span className="card-tag" style={{ background: script.status === false ? 'rgba(255, 77, 79, 0.1)' : 'rgba(250, 140, 22, 0.1)', color: script.status === false ? '#ff4d4f' : '#fa8c16', borderColor: script.status === false ? 'rgba(255, 77, 79, 0.3)' : 'rgba(250, 140, 22, 0.3)' }}>
                          {script.status === false ? '停用' : '启用'}
                        </span>
                        {script.params && script.params.length > 0 && (
                          <span className="card-tag" style={{ background: 'rgba(22, 119, 255, 0.1)', color: '#1677ff', borderColor: 'rgba(22, 119, 255, 0.3)' }}>
                            {script.params.length}个入参
                          </span>
                        )}
                      </div>
                      {/* 底部：创建时间 + 操作按钮 */}
                      <div className="card-footer">
                        <div className="card-time">
                          <ClockCircleOutlined /> 创建时间: {formatDate(script.created_at)}
                        </div>
                        <div className="card-actions-bottom">
                          <Button icon={<PlayCircleOutlined />} onClick={(e) => { e.stopPropagation(); openTestDrawer(script); }} className="action-btn test" title="测试执行"><span>测试</span></Button>
                          <Button icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEditScript(script); }} className="action-btn edit" title="编辑"><span>编辑</span></Button>
                          <Popconfirm title="确认删除" description="确定要删除这个代码脚本吗？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteScript(script.id); }} okText="确认" cancelText="取消">
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
        {totalScripts > 0 && (
          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalScripts}
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

      {/* 新增代码脚本弹窗 */}
      <Modal
        title="新增代码脚本"
        open={isScriptModalVisible}
        onOk={handleCreateScript}
        onCancel={() => setIsScriptModalVisible(false)}
        okText="创建"
        cancelText="取消"
        width={1000}
      >
        <Form form={scriptForm} layout="vertical">
          <Form.Item name="name" label="脚本名称" rules={[{ required: true, message: '请输入脚本名称' }]}>
            <Input placeholder="请输入脚本名称" />
          </Form.Item>
          <Form.Item name="description" label="脚本描述">
            <TextArea rows={2} placeholder="请输入脚本描述" />
          </Form.Item>
          <Form.Item label={
            <Tooltip title="入参定义与main函数形参对应，执行时按参数名注入用户传入的参数值">
              <span>入参定义（对应main函数形参）</span>
            </Tooltip>
          }>
            {renderParamsForm()}
          </Form.Item>
          <Form.Item label="Python代码（必须包含main方法）">
            <div style={{ marginBottom: 16 }}>
              <CodeEditor
                value={editorCode}
                onChange={(value) => setEditorCode(value)}
                theme={theme}
                showValidateButton
              />
            </div>
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

      {/* 编辑代码脚本弹窗 */}
      <Modal
        title="编辑代码脚本"
        open={isScriptEditModalVisible}
        onOk={handleUpdateScript}
        onCancel={() => setIsScriptEditModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={1000}
      >
        <Form form={scriptEditForm} layout="vertical">
          <Form.Item name="name" label="脚本名称" rules={[{ required: true, message: '请输入脚本名称' }]}>
            <Input placeholder="请输入脚本名称" />
          </Form.Item>
          <Form.Item name="description" label="脚本描述">
            <TextArea rows={2} placeholder="请输入脚本描述" />
          </Form.Item>
          <Form.Item label={
            <Tooltip title="入参定义与main函数形参对应，执行时按参数名注入用户传入的参数值">
              <span>入参定义（对应main函数形参）</span>
            </Tooltip>
          }>
            {renderParamsForm()}
          </Form.Item>
          <Form.Item label="Python代码（必须包含main方法）">
            <div style={{ marginBottom: 16 }}>
              <CodeEditor
                value={editorEditCode}
                onChange={(value) => setEditorEditCode(value)}
                theme={theme}
                showValidateButton
              />
            </div>
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

      {/* 测试执行抽屉 - 在page-container内滑出 */}
      <Drawer
        title="测试执行"
        placement="right"
        width={700}
        getContainer={false}
        rootClassName={`toolkit-drawer ${theme === 'dark' ? 'dark' : 'light'}`}
        open={testDrawerVisible}
        onClose={() => setTestDrawerVisible(false)}
        styles={{
          header: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff', color: theme === 'dark' ? '#fff' : '#000' },
          body: { background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5', color: theme === 'dark' ? '#fff' : '#000', padding: '24px' },
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <CodeEditor
            value={testCode}
            height="350px"
            onChange={(value) => setTestCode(value)}
            theme={theme}
            showValidateButton
          />
        </div>
        {renderTestParamsInput()}
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleTestScript} loading={testing} style={{ width: '100%', marginBottom: 16 }}>
          {testing ? '执行中...' : '执行测试'}
        </Button>
        {renderTestResult()}
      </Drawer>
    </>
  );
};

export default CodeScriptTool;
