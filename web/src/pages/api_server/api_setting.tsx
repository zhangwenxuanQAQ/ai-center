import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Table, Switch, Modal, message, Popconfirm, Space, Tag, Select, Pagination, Row, Col, Tooltip, Typography, Radio, Collapse, Dropdown } from 'antd';
const { TextArea } = Input;
const { Text } = Typography;
const { Panel } = Collapse;
import { SaveOutlined, UndoOutlined, DeleteOutlined, EditOutlined, PlusOutlined, ImportOutlined, ClearOutlined, ArrowLeftOutlined, ThunderboltOutlined, MinusCircleOutlined, DownOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { apiService, ApiServer, ApiInterface, ApiServerCategory, HEADER_TYPE_OPTIONS, parseHeaders, stringifyHeaders } from '../../services/api_server';
import '../../styles/common.css';
import './api_setting.less';

const { Option } = Select;

// HTTP请求方法选项
const HTTP_METHOD_OPTIONS = [
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
];

// 参数位置选项
const PARAM_IN_OPTIONS = [
  { label: 'query', value: 'query' },
  { label: 'path', value: 'path' },
  { label: 'header', value: 'header' },
  { label: 'body', value: 'body' },
];

// 参数类型选项
const PARAM_TYPE_OPTIONS = [
  { label: 'string', value: 'string' },
  { label: 'integer', value: 'integer' },
  { label: 'number', value: 'number' },
  { label: 'boolean', value: 'boolean' },
  { label: 'array', value: 'array' },
  { label: 'object', value: 'object' },
];

// 解析configs字符串/对象为表单可用的配置对象
const parseConfigs = (configs: any) => {
  let cfg: any = {};
  if (!configs) return { method: 'GET', path: '', parameters: [], headers: [] };
  if (typeof configs === 'string') {
    try { cfg = JSON.parse(configs); } catch { cfg = {}; }
  } else {
    cfg = { ...configs };
  }
  // 兼容headers可能是字典或数组
  let headers = cfg.headers || [];
  if (headers && !Array.isArray(headers) && typeof headers === 'object') {
    headers = Object.entries(headers).map(([key, value]: any) => ({ key, value: String(value), type: 'string' }));
  }
  return {
    method: cfg.method || 'GET',
    path: cfg.path || '',
    parameters: Array.isArray(cfg.parameters) ? cfg.parameters : [],
    headers,
  };
};

// 将表单配置对象序列化为configs JSON字符串
const stringifyConfigs = (cfg: any): string => {
  return JSON.stringify({
    method: cfg.method || 'GET',
    path: cfg.path || '',
    parameters: (cfg.parameters || []).filter((p: any) => p.name && p.name.trim()),
    headers: (cfg.headers || []).filter((h: any) => h.key && h.key.trim()),
  });
};

const ApiSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [server, setServer] = useState<ApiServer | null>(null);
  const [originalData, setOriginalData] = useState<any>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [categories, setCategories] = useState<ApiServerCategory[]>([]);

  // 接口列表
  const [interfaces, setInterfaces] = useState<ApiInterface[]>([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchPath, setSearchPath] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [searchMethod, setSearchMethod] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 接口测试弹窗
  const [isTestModalVisible, setIsTestModalVisible] = useState(false);
  const [testingInterface, setTestingInterface] = useState<ApiInterface | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testParams, setTestParams] = useState<Array<{ name: string; value: any; type: string; in: string }>>([]);
  const [testHeaders, setTestHeaders] = useState<Array<{ key: string; value: any; type: string }>>([]);

  // 接口弹窗
  const [isInterfaceModalVisible, setIsInterfaceModalVisible] = useState(false);
  const [editingInterface, setEditingInterface] = useState<ApiInterface | null>(null);
  const [interfaceForm] = Form.useForm();

  // Swagger导入弹窗
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [swaggerInputType, setSwaggerInputType] = useState<'url' | 'json'>('url');
  const [swaggerUrl, setSwaggerUrl] = useState('');
  const [swaggerJson, setSwaggerJson] = useState('');
  const [swaggerHeaders, setSwaggerHeaders] = useState<Array<{ key: string; value: string; type: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [parsedInterfaces, setParsedInterfaces] = useState<ApiInterface[]>([]);
  const [parsedLoading, setParsedLoading] = useState(false);
  const [selectedParsedKeys, setSelectedParsedKeys] = useState<string[]>([]);
  const [parsedPage, setParsedPage] = useState(1);
  const [parsedPageSize] = useState(20);
  const [parsedSearchTitle, setParsedSearchTitle] = useState('');
  const [parsedSearchDesc, setParsedSearchDesc] = useState('');
  const [parsedSearchPath, setParsedSearchPath] = useState('');

  useEffect(() => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    setTheme(currentTheme as 'dark' | 'light');

    const observer = new MutationObserver(() => {
      const newTheme = document.body.getAttribute('data-theme') || 'dark';
      setTheme(newTheme as 'dark' | 'light');
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (id) {
      fetchServer(id);
      fetchCategories();
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchInterfaces();
    }
  }, [id, currentPage, pageSize, searchStatus, searchMethod]);

  // 触发搜索（回车或失焦时调用）
  const triggerSearch = () => {
    setCurrentPage(1);
    fetchInterfaces();
  };

  const fetchServer = async (serverId: string) => {
    setLoading(true);
    try {
      const data = await apiService.getServer(serverId);
      setServer(data);
      const formData: any = {
        name: data.name,
        description: data.description,
        url: data.url,
        headers: parseHeaders(data.headers),
        category_id: data.category_id,
        status: data.status !== false,
      };
      form.setFieldsValue(formData);
      setOriginalData(formData);
    } catch (error: any) {
      message.error({ content: `获取API服务失败: ${error.message}`, key: 'fetchServer' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const tree = await apiService.getCategoryTree();
      setCategories(tree);
    } catch (error: any) {
      // 忽略分类加载失败
    }
  };

  const fetchInterfaces = async () => {
    if (!id) return;
    setInterfacesLoading(true);
    try {
      const result = await apiService.getInterfaces(currentPage, pageSize, id, searchName || undefined, searchStatus, searchPath || undefined, searchMethod);
      setInterfaces(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error({ content: `获取接口列表失败: ${error.message}`, key: 'fetchInterfaces' });
    } finally {
      setInterfacesLoading(false);
    }
  };

  const handleValuesChange = () => {
    const currentValues = form.getFieldsValue();
    const changed = JSON.stringify(currentValues) !== JSON.stringify(originalData);
    setHasChanges(changed);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const submitData = { ...values, headers: stringifyHeaders(values.headers) };
      await apiService.updateServer(id, submitData);
      setOriginalData(values);
      setHasChanges(false);
      message.success({ content: '保存成功', key: 'save' });
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `保存失败: ${error.message}`, key: 'save' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(originalData);
    setHasChanges(false);
  };

  // 接口CRUD
  const handleAddInterface = () => {
    setEditingInterface(null);
    interfaceForm.resetFields();
    interfaceForm.setFieldsValue({ server_id: id });
    setIsInterfaceModalVisible(true);
  };

  const handleEditInterface = (record: ApiInterface) => {
    setEditingInterface(record);
    const cfg = parseConfigs(record.configs);
    interfaceForm.setFieldsValue({
      name: record.name,
      title: record.title,
      description: record.description,
      method: cfg.method,
      path: cfg.path,
      parameters: cfg.parameters,
      headers: cfg.headers,
      status: record.status,
    });
    setIsInterfaceModalVisible(true);
  };

  const handleSaveInterface = async () => {
    try {
      const values = await interfaceForm.validateFields();
      const configs = stringifyConfigs({
        method: values.method,
        path: values.path,
        parameters: values.parameters,
        headers: values.headers,
      });
      const submitData = { ...values, configs };
      delete submitData.method;
      delete submitData.path;
      delete submitData.parameters;
      delete submitData.headers;
      if (editingInterface) {
        await apiService.updateInterface(editingInterface.id, submitData);
        message.success({ content: '接口更新成功', key: 'updateInterface' });
      } else {
        await apiService.createInterface({ ...submitData, server_id: id });
        message.success({ content: '接口创建成功', key: 'createInterface' });
      }
      setIsInterfaceModalVisible(false);
      fetchInterfaces();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error({ content: `保存失败: ${error.message}`, key: 'saveInterface' });
    }
  };

  const handleDeleteInterface = async (interfaceId: string) => {
    try {
      await apiService.deleteInterface(interfaceId);
      message.success({ content: '接口删除成功', key: 'deleteInterface' });
      fetchInterfaces();
    } catch (error: any) {
      message.error({ content: `删除失败: ${error.message}`, key: 'deleteInterface' });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await apiService.batchDeleteInterfaces(selectedIds);
      message.success({ content: `成功删除 ${result.deleted_count} 个接口`, key: 'batchDelete' });
      setSelectedIds([]);
      fetchInterfaces();
    } catch (error: any) {
      message.error({ content: `批量删除失败: ${error.message}`, key: 'batchDelete' });
    }
  };

  const handleClearFilters = () => {
    setSearchName('');
    setSearchPath('');
    setSearchStatus(undefined);
    setSearchMethod(undefined);
    setCurrentPage(1);
    fetchInterfaces();
  };

  // 状态切换
  const handleInterfaceStatusChange = async (record: ApiInterface, status: boolean) => {
    try {
      await apiService.updateInterface(record.id, { status } as any);
      message.success({ content: status ? '已启用' : '已禁用', key: 'statusChange' });
      fetchInterfaces();
    } catch (error: any) {
      message.error({ content: `状态更新失败: ${error.message}`, key: 'statusChange' });
    }
  };

  // 测试接口
  const handleTestInterface = (record: ApiInterface) => {
    setTestingInterface(record);
    setTestResult(null);
    // 从configs解析参数定义，初始化测试参数值（优先使用默认值）
    const cfg = parseConfigs(record.configs);
    setTestParams((cfg.parameters || []).map((p: any) => {
      const defaultValue = p.default !== undefined && p.default !== '' ? p.default : '';
      let initValue: any = defaultValue;
      if (defaultValue === '') {
        initValue = p.type === 'boolean' ? false : (p.type === 'array' || p.type === 'object' ? '' : '');
      }
      return {
        name: p.name || '',
        value: initValue,
        type: p.type || 'string',
        in: p.in || 'query',
      };
    }));
    // 初始化测试请求头（接口级请求头作为默认值）
    setTestHeaders((cfg.headers || []).map((h: any) => ({
      key: h.key || '',
      value: h.value !== undefined ? String(h.value) : '',
      type: h.type || 'string',
    })));
    setIsTestModalVisible(true);
  };

  const executeTest = async () => {
    if (!testingInterface) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      // 转换测试参数，根据类型解析值
      const parameters = testParams
        .filter(p => p.name && p.value !== '' && p.value !== undefined && p.value !== null)
        .map(p => {
          let parsedValue: any = p.value;
          try {
            if (p.type === 'integer' || p.type === 'number') {
              parsedValue = Number(p.value);
            } else if (p.type === 'boolean') {
              parsedValue = p.value === true || p.value === 'true';
            } else if (p.type === 'array' || p.type === 'object') {
              parsedValue = typeof p.value === 'string' ? JSON.parse(p.value) : p.value;
            }
          } catch {
            parsedValue = p.value;
          }
          return { name: p.name, value: parsedValue, in: p.in };
        });
      // 转换测试请求头，根据类型解析值
      const headersList = testHeaders
        .filter(h => h.key && h.value !== '' && h.value !== undefined && h.value !== null)
        .map(h => {
          let parsedValue: any = h.value;
          try {
            if (h.type === 'integer' || h.type === 'number') {
              parsedValue = Number(h.value);
            } else if (h.type === 'boolean') {
              parsedValue = h.value === true || h.value === 'true';
            } else if (h.type === 'array' || h.type === 'object') {
              parsedValue = typeof h.value === 'string' ? JSON.parse(h.value) : h.value;
            }
          } catch {
            parsedValue = h.value;
          }
          return { key: h.key, value: parsedValue };
        });
      // 构造请求体：headers用对象格式，parameters用数组格式
      const testData: any = { parameters, headers: {} };
      headersList.forEach(h => { testData.headers[h.key] = h.value; });
      const result = await apiService.testInterface(testingInterface.id, testData);
      setTestResult(result);
    } catch (error: any) {
      setTestResult({ error: error.message });
    } finally {
      setTestLoading(false);
    }
  };

  // 更新测试参数值
  const updateTestParamValue = (index: number, value: any) => {
    setTestParams(prev => prev.map((p, i) => (i === index ? { ...p, value } : p)));
  };

  // 更新测试请求头值
  const updateTestHeaderValue = (index: number, value: any) => {
    setTestHeaders(prev => prev.map((h, i) => (i === index ? { ...h, value } : h)));
  };

  // 更新测试请求头键名
  const updateTestHeaderKey = (index: number, key: string) => {
    setTestHeaders(prev => prev.map((h, i) => (i === index ? { ...h, key } : h)));
  };

  // 更新测试请求头类型
  const updateTestHeaderType = (index: number, type: string) => {
    setTestHeaders(prev => prev.map((h, i) => (i === index ? { ...h, type } : h)));
  };

  // 新增测试请求头
  const addTestHeader = () => {
    setTestHeaders(prev => [...prev, { key: '', value: '', type: 'string' }]);
  };

  // 删除测试请求头
  const removeTestHeader = (index: number) => {
    setTestHeaders(prev => prev.filter((_, i) => i !== index));
  };

  // 根据参数类型渲染对应的值输入组件
  const renderValueInput = (value: any, type: string, onChange: (v: any) => void) => {
    if (type === 'boolean') {
      return <Switch checked={!!value} onChange={(checked) => onChange(checked)} />;
    }
    if (type === 'integer' || type === 'number') {
      return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} placeholder="请输入数值" />;
    }
    if (type === 'array' || type === 'object') {
      return (
        <TextArea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={type === 'array' ? '请输入JSON数组，如 [1, 2]' : '请输入JSON对象，如 {"key":"value"}'}
        />
      );
    }
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="请输入值" />;
  };

  // Swagger导入
  const handleImportClick = () => {
    setSwaggerInputType('url');
    setSwaggerUrl('');
    setSwaggerJson('');
    setSwaggerHeaders([]);
    setParsedInterfaces([]);
    setSelectedParsedKeys([]);
    setParsedPage(1);
    setParsedSearchTitle('');
    setParsedSearchDesc('');
    setParsedSearchPath('');
    setIsImportModalVisible(true);
  };

  const handleParseSwagger = async () => {
    if (!id) return;
    // 失焦/回车时内容为空则不触发解析
    if (swaggerInputType === 'url' && !swaggerUrl) return;
    if (swaggerInputType === 'json' && !swaggerJson) return;
    setParsedLoading(true);
    try {
      // 过滤空行headers
      const validHeaders = swaggerHeaders.filter(h => h.key);
      const params = {
        ...(swaggerInputType === 'url' ? { swagger_url: swaggerUrl } : { swagger_json: swaggerJson }),
        headers: validHeaders.length > 0 ? JSON.stringify(validHeaders) : undefined,
      };
      const result = await apiService.parseSwagger(id, params);
      setParsedInterfaces(result.data);
      setSelectedParsedKeys(result.data.map((_, idx) => String(idx)));
      message.success({ content: `解析成功，共 ${result.total} 个接口`, key: 'parseSwagger' });
    } catch (error: any) {
      message.error({ content: `解析失败: ${error.message}`, key: 'parseSwagger' });
    } finally {
      setParsedLoading(false);
    }
  };

  const handleImportInterfaces = async () => {
    if (!id || selectedParsedKeys.length === 0) {
      message.warning({ content: '请选择要导入的接口', key: 'importInterfaces' });
      return;
    }
    setImporting(true);
    try {
      const toImport = selectedParsedKeys
        .map(k => parsedInterfaces[Number(k)])
        .filter(Boolean);
      const result = await apiService.importInterfaces(id, toImport);
      message.success({ content: `成功导入 ${result.length} 个接口`, key: 'importInterfaces' });
      setIsImportModalVisible(false);
      fetchInterfaces();
    } catch (error: any) {
      message.error({ content: `导入失败: ${error.message}`, key: 'importInterfaces' });
    } finally {
      setImporting(false);
    }
  };

  // 公共方法：从configs解析字段
  const getConfigField = (configs: any, field: string) => {
    let c: any = configs;
    if (typeof c === 'string') {
      try { c = JSON.parse(c); } catch { c = {}; }
    }
    return c?.[field];
  };

  // 表格列定义
  const interfaceColumns: ColumnsType<ApiInterface> = [
    {
      title: '接口名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}><Text copyable={{ text: text || '', tooltips: ['复制', '已复制'] }} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{text || '-'}</Text></Tooltip>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 160,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}><Text style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{text || '-'}</Text></Tooltip>
      ),
    },
    {
      title: '请求方式',
      key: 'method',
      width: 80,
      render: (_: any, record: ApiInterface) => {
        const method = getConfigField(record.configs, 'method') || '-';
        const colorMap: Record<string, string> = { GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'purple' };
        return <Tag color={colorMap[method] || 'default'}>{method}</Tag>;
      },
    },
    {
      title: '路径',
      key: 'path',
      width: 200,
      ellipsis: true,
      render: (_: any, record: ApiInterface) => {
        const path = getConfigField(record.configs, 'path') || '-';
        return <Tooltip title={path}><Text copyable={{ text: path, tooltips: ['复制', '已复制'] }} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{path}</Text></Tooltip>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}><Text style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{text || '-'}</Text></Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: boolean, record: ApiInterface) => (
        <Switch
          checked={status !== false}
          onChange={(checked) => handleInterfaceStatusChange(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_: any, record: ApiInterface) => (
        <Space size="small">
          <Tooltip title="测试">
            <Button type="text" icon={<ThunderboltOutlined />} onClick={() => handleTestInterface(record)} size="small" />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEditInterface(record)} size="small" />
          </Tooltip>
          <Popconfirm title="确认删除" description="确定要删除这个接口吗？" onConfirm={() => handleDeleteInterface(record.id)} okText="确认" cancelText="取消">
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} danger size="small" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const parsedInterfaceColumns: ColumnsType<ApiInterface> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft"><span>{text || '-'}</span></Tooltip>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft"><span>{text || '-'}</span></Tooltip>
      ),
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text} placement="topLeft"><span>{text}</span></Tooltip>
      ),
    },
    {
      title: '接口路径',
      key: 'path',
      width: 200,
      ellipsis: true,
      render: (_: any, record: ApiInterface) => {
        const path = getConfigField(record.configs, 'path') || '-';
        return <Tooltip title={path} placement="topLeft"><span>{path}</span></Tooltip>;
      },
    },
    {
      title: '请求方式',
      key: 'method',
      width: 100,
      render: (_: any, record: ApiInterface) => {
        const method = getConfigField(record.configs, 'method') || '-';
        return <Tag color="blue">{method}</Tag>;
      },
    },
  ];

  const flattenCategories = (cats: ApiServerCategory[]): { label: string; value: string }[] => {
    let result: { label: string; value: string }[] = [];
    cats.forEach(c => {
      result.push({ label: c.name, value: c.id });
      if (c.children && c.children.length > 0) {
        result = result.concat(flattenCategories(c.children));
      }
    });
    return result;
  };

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="api-setting-container" style={{ display: 'flex', gap: '8px', height: '100%', overflow: 'hidden' }}>
        {/* 左侧：服务基本信息 */}
        <div style={{ width: '30%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          <div
            className={`setting-section ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{
              padding: '16px',
              borderRadius: '8px',
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>
                <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/toolkit')} size="small" style={{ marginRight: 8 }} />
                API服务信息
              </h3>
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>加载中...</div>
            ) : (
              <>
              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
                style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="hide-scrollbar"
              >
                <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                  <Input placeholder="请输入服务名称" />
                </Form.Item>
                <Form.Item name="description" label="服务描述">
                  <TextArea rows={2} placeholder="请输入服务描述" />
                </Form.Item>
                <Form.Item name="url" label="基础URL">
                  <Input placeholder="例如：https://api.example.com" />
                </Form.Item>
                <Form.Item name="category_id" label="所属分类">
                  <Select placeholder="请选择分类" allowClear>
                    {flattenCategories(categories).map(c => (
                      <Option key={c.value} value={c.value}>{c.label}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item label="请求头">
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
                        <Button type="dashed" onClick={() => add({ key: '', value: '', type: 'string' })} icon={<PlusOutlined />} style={{ width: '100%' }}>
                          添加
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
                <Form.Item name="status" label="状态" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="停用" />
                </Form.Item>
              </Form>
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                {hasChanges && (
                  <span style={{ color: '#faad14', fontSize: 12, marginRight: 'auto' }}>
                    • 有未保存的变动
                  </span>
                )}
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleReset}
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
                  style={{ background: 'linear-gradient(135deg, var(--primary-color) 0%, #6b7fe6 100%)', border: 'none', color: '#fff' }}
                >
                  保存
                </Button>
              </div>
              </>
            )}
          </div>
        </div>

        {/* 右侧：接口列表 */}
        <div style={{ width: '70%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            className={`setting-section tools-section ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '16px',
              borderRadius: '8px',
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff',
            }}
          >
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Dropdown
                menu={{
                  items: [
                    { key: 'add', icon: <PlusOutlined />, label: '新增接口' },
                    { key: 'import', icon: <ImportOutlined />, label: 'Swagger导入' },
                  ],
                  onClick: ({ key }) => {
                    if (key === 'add') handleAddInterface();
                    else if (key === 'import') handleImportClick();
                  },
                }}
              >
                <Button type="primary">
                  新增接口 <DownOutlined />
                </Button>
              </Dropdown>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleBatchDelete}
                className="batch-delete-button"
                disabled={selectedIds.length === 0}
              >
                批量删除 ({selectedIds.length})
              </Button>
              <Input
                placeholder="搜索接口名称"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onPressEnter={triggerSearch}
                onBlur={triggerSearch}
                style={{ width: 180 }}
                allowClear
                onClear={() => { setSearchName(''); triggerSearch(); }}
              />
              <Input
                placeholder="搜索请求路径"
                value={searchPath}
                onChange={(e) => setSearchPath(e.target.value)}
                onPressEnter={triggerSearch}
                onBlur={triggerSearch}
                style={{ width: 180 }}
                allowClear
                onClear={() => { setSearchPath(''); triggerSearch(); }}
              />
              <Select
                placeholder="请选择状态"
                value={searchStatus}
                onChange={(value) => { setSearchStatus(value); setCurrentPage(1); }}
                style={{ width: 120 }}
                allowClear
              >
                <Option value="true">启用</Option>
                <Option value="false">禁用</Option>
              </Select>
              <Select
                placeholder="请选择请求方法"
                value={searchMethod}
                onChange={(value) => { setSearchMethod(value); setCurrentPage(1); }}
                style={{ width: 140 }}
                allowClear
              >
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
                <Option value="PATCH">PATCH</Option>
              </Select>
              <Button icon={<ClearOutlined />} onClick={handleClearFilters}>清空</Button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table
                columns={interfaceColumns}
                dataSource={interfaces}
                rowKey="id"
                loading={interfacesLoading}
                size="small"
                pagination={false}
                style={{ flex: 1, minHeight: 0 }}
                rowSelection={{
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys as string[]),
                }}
              />
              <div style={{
                paddingTop: '16px',
                borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                display: 'flex',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={total}
                  onChange={(page, size) => { setCurrentPage(page); setPageSize(size); }}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(t) => `共 ${t} 条记录`}
                  pageSizeOptions={['10', '20', '50', '100']}
                  className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 接口新增/编辑弹窗 */}
      <Modal
        title={editingInterface ? '编辑接口' : '新增接口'}
        open={isInterfaceModalVisible}
        onOk={handleSaveInterface}
        onCancel={() => setIsInterfaceModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={900}
      >
        <Form form={interfaceForm} layout="vertical" initialValues={{ method: 'GET', status: true, parameters: [], headers: [] }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="接口名称" rules={[{ required: true, message: '请输入接口名称' }]}>
                <Input placeholder="请输入接口名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="title" label="接口标题">
                <Input placeholder="请输入接口标题" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="接口描述">
            <TextArea rows={2} placeholder="请输入接口描述" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="method" label="请求方法" rules={[{ required: true, message: '请选择请求方法' }]}>
                <Select options={HTTP_METHOD_OPTIONS} placeholder="请选择" />
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item name="path" label="请求路径" rules={[{ required: true, message: '请输入请求路径' }]}>
                <Input placeholder="例如：/users/{id}" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="请求参数">
            <Form.List name="parameters">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'name']} noStyle>
                          <Input placeholder="参数名" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...restField} name={[name, 'in']} noStyle>
                          <Select placeholder="位置" options={PARAM_IN_OPTIONS} allowClear />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...restField} name={[name, 'type']} noStyle>
                          <Select placeholder="参数类型" options={PARAM_TYPE_OPTIONS} allowClear />
                        </Form.Item>
                      </Col>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'default']} noStyle>
                          <Input placeholder="默认值" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item {...restField} name={[name, 'description']} noStyle>
                          <Input placeholder="参数描述" />
                        </Form.Item>
                      </Col>
                      <Col span={2} style={{ textAlign: 'center' }}>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add({ name: '', in: 'query', type: 'string', default: '' })} icon={<PlusOutlined />} style={{ width: '100%' }}>
                    添加参数
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item label="请求头">
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
                          <Select placeholder="参数类型" options={PARAM_TYPE_OPTIONS} allowClear />
                        </Form.Item>
                      </Col>
                      <Col span={2} style={{ textAlign: 'center' }}>
                        <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                      </Col>
                    </Row>
                  ))}
                  <Button type="dashed" onClick={() => add({ key: '', value: '', type: 'string' })} icon={<PlusOutlined />} style={{ width: '100%' }}>
                    添加
                  </Button>
                </>
              )}
            </Form.List>
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Swagger导入弹窗 */}
      <Modal
        title="swagger导入"
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        width={1000}
        style={{ maxHeight: '90vh' }}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
        okText="导入"
        cancelText="取消"
        okButtonProps={{ disabled: selectedParsedKeys.length === 0 }}
        onOk={handleImportInterfaces}
        confirmLoading={importing}
      >
        <Form layout="horizontal" labelAlign="right" labelCol={{ span: 4 }} wrapperCol={{ span: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <Radio.Group
              value={swaggerInputType}
              onChange={(e) => setSwaggerInputType(e.target.value)}
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="url">URL</Radio.Button>
              <Radio.Button value="json">JSON</Radio.Button>
            </Radio.Group>
          </div>
          {swaggerInputType === 'url' && (
            <Form.Item label="Swagger URL">
              <Input
                placeholder="请输入Swagger文档URL"
                value={swaggerUrl}
                onChange={(e) => setSwaggerUrl(e.target.value)}
                onPressEnter={handleParseSwagger}
                onBlur={handleParseSwagger}
              />
            </Form.Item>
          )}
          {swaggerInputType === 'json' && (
            <Form.Item label="Swagger JSON">
              <TextArea
                rows={8}
                placeholder="请粘贴Swagger JSON内容"
                value={swaggerJson}
                onChange={(e) => setSwaggerJson(e.target.value)}
                onBlur={handleParseSwagger}
              />
            </Form.Item>
          )}
          <Form.Item label="请求头">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {swaggerHeaders.map((h, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    placeholder="参数名"
                    value={h.key}
                    onChange={(e) => {
                      const next = [...swaggerHeaders];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setSwaggerHeaders(next);
                    }}
                    style={{ width: '30%' }}
                  />
                  <Input
                    placeholder="参数值"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...swaggerHeaders];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setSwaggerHeaders(next);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Select
                    placeholder="参数类型"
                    value={h.type}
                    onChange={(value) => {
                      const next = [...swaggerHeaders];
                      next[idx] = { ...next[idx], type: value };
                      setSwaggerHeaders(next);
                    }}
                    style={{ width: 120 }}
                    options={HEADER_TYPE_OPTIONS}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => {
                      const next = swaggerHeaders.filter((_, i) => i !== idx);
                      setSwaggerHeaders(next);
                    }}
                  />
                </div>
              ))}
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setSwaggerHeaders([...swaggerHeaders, { key: '', value: '', type: 'string' }])}
                style={{ width: '100%' }}
              >
                添加
              </Button>
            </div>
          </Form.Item>
        </Form>
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Input
            placeholder="搜索标题"
            value={parsedSearchTitle}
            onChange={(e) => setParsedSearchTitle(e.target.value)}
            onPressEnter={() => setParsedPage(1)}
            onBlur={() => setParsedPage(1)}
            style={{ width: 160 }}
            allowClear
            onClear={() => { setParsedSearchTitle(''); setParsedPage(1); }}
          />
          <Input
            placeholder="搜索描述"
            value={parsedSearchDesc}
            onChange={(e) => setParsedSearchDesc(e.target.value)}
            onPressEnter={() => setParsedPage(1)}
            onBlur={() => setParsedPage(1)}
            style={{ width: 160 }}
            allowClear
            onClear={() => { setParsedSearchDesc(''); setParsedPage(1); }}
          />
          <Input
            placeholder="搜索路径"
            value={parsedSearchPath}
            onChange={(e) => setParsedSearchPath(e.target.value)}
            onPressEnter={() => setParsedPage(1)}
            onBlur={() => setParsedPage(1)}
            style={{ width: 160 }}
            allowClear
            onClear={() => { setParsedSearchPath(''); setParsedPage(1); }}
          />
          <Button
            type="default"
            onClick={() => {
              const filteredData = parsedInterfaces.filter((_, idx) => {
                const item = parsedInterfaces[idx];
                const path = getConfigField(item.configs, 'path') || '';
                const titleMatch = !parsedSearchTitle || (item.title || '').toLowerCase().includes(parsedSearchTitle.toLowerCase());
                const descMatch = !parsedSearchDesc || (item.description || '').toLowerCase().includes(parsedSearchDesc.toLowerCase());
                const pathMatch = !parsedSearchPath || path.toLowerCase().includes(parsedSearchPath.toLowerCase());
                return titleMatch && descMatch && pathMatch;
              });
              if (selectedParsedKeys.length === filteredData.length) {
                setSelectedParsedKeys([]);
              } else {
                const allKeys = parsedInterfaces.map((_, idx) => String(idx)).filter(idx => {
                  const item = parsedInterfaces[Number(idx)];
                  const path = getConfigField(item.configs, 'path') || '';
                  const titleMatch = !parsedSearchTitle || (item.title || '').toLowerCase().includes(parsedSearchTitle.toLowerCase());
                  const descMatch = !parsedSearchDesc || (item.description || '').toLowerCase().includes(parsedSearchDesc.toLowerCase());
                  const pathMatch = !parsedSearchPath || path.toLowerCase().includes(parsedSearchPath.toLowerCase());
                  return titleMatch && descMatch && pathMatch;
                });
                setSelectedParsedKeys(allKeys);
              }
            }}
          >
            {selectedParsedKeys.length === parsedInterfaces.length ? '取消全选' : '全选'}
          </Button>
          <span style={{ marginLeft: 'auto' }}>共 {parsedInterfaces.length} 个接口，已选择 {selectedParsedKeys.length} 个</span>
        </div>
        <Table
          className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
          columns={parsedInterfaceColumns}
          dataSource={parsedInterfaces.map((item, idx) => ({ ...item, key: String(idx) })).filter(item => {
            const idx = Number(item.key);
            const origin = parsedInterfaces[idx];
            if (!origin) return false;
            const path = getConfigField(origin.configs, 'path') || '';
            const titleMatch = !parsedSearchTitle || (origin.title || '').toLowerCase().includes(parsedSearchTitle.toLowerCase());
            const descMatch = !parsedSearchDesc || (origin.description || '').toLowerCase().includes(parsedSearchDesc.toLowerCase());
            const pathMatch = !parsedSearchPath || path.toLowerCase().includes(parsedSearchPath.toLowerCase());
            return titleMatch && descMatch && pathMatch;
          })}
          rowKey="key"
          size="small"
          loading={parsedLoading}
          pagination={{
            current: parsedPage,
            pageSize: parsedPageSize,
            onChange: (page) => setParsedPage(page),
            showTotal: (t) => `共 ${t} 条`,
            size: 'default',
            style: { textAlign: 'center' },
          }}
          scroll={{ y: 400 }}
          locale={{ emptyText: parsedInterfaces.length === 0 ? '请输入URL或JSON后自动解析' : '暂无数据' }}
          rowSelection={{
            selectedRowKeys: selectedParsedKeys,
            onChange: (keys) => setSelectedParsedKeys(keys as string[]),
          }}
        />
      </Modal>

      {/* 接口测试弹窗 */}
      <Modal
        title={`测试接口${testingInterface ? ` - ${testingInterface.name}` : ''}`}
        open={isTestModalVisible}
        onCancel={() => setIsTestModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsTestModalVisible(false)}>关闭</Button>,
          <Button key="test" type="primary" loading={testLoading} onClick={executeTest}>
            {testLoading ? '测试中...' : '测试'}
          </Button>,
        ]}
      >
        {testingInterface && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text strong>请求URL：</Text>
              <Text code>{server?.url || ''}</Text>
              <Text code style={{ color: '#1677ff', marginLeft: 4 }}>
                {(() => {
                  const cfg = parseConfigs(testingInterface.configs);
                  return `${cfg.method} ${cfg.path}`;
                })()}
              </Text>
            </div>
            <Form layout="vertical">
              <Form.Item label="请求参数">
                {testParams.length > 0 ? (
                  testParams.map((p, idx) => (
                    <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={6}>
                        <Text>{p.name}</Text>
                      </Col>
                      <Col span={4}>
                        <Tag>{p.in}</Tag>
                      </Col>
                      <Col span={4}>
                        <Tag color="blue">{p.type}</Tag>
                      </Col>
                      <Col span={10}>
                        {renderValueInput(p.value, p.type, (v) => updateTestParamValue(idx, v))}
                      </Col>
                    </Row>
                  ))
                ) : (
                  <Text type="secondary">无请求参数</Text>
                )}
              </Form.Item>
              <Form.Item label="请求头">
                {testHeaders.length > 0 ? (
                  testHeaders.map((h, idx) => (
                    <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={7}>
                        <Input
                          value={h.key}
                          onChange={(e) => updateTestHeaderKey(idx, e.target.value)}
                          placeholder="请求头名"
                        />
                      </Col>
                      <Col span={4}>
                        <Select
                          value={h.type}
                          onChange={(v) => updateTestHeaderType(idx, v)}
                          options={PARAM_TYPE_OPTIONS}
                          placeholder="类型"
                        />
                      </Col>
                      <Col span={11}>
                        {renderValueInput(h.value, h.type, (v) => updateTestHeaderValue(idx, v))}
                      </Col>
                      <Col span={2} style={{ textAlign: 'center' }}>
                        <MinusCircleOutlined onClick={() => removeTestHeader(idx)} style={{ color: '#ff4d4f' }} />
                      </Col>
                    </Row>
                  ))
                ) : (
                  <Text type="secondary">无请求头</Text>
                )}
                <Button type="dashed" onClick={addTestHeader} icon={<PlusOutlined />} style={{ width: '100%' }}>
                  添加请求头
                </Button>
              </Form.Item>
            </Form>
            <div style={{ marginTop: 24 }}>
              <h4 style={{ marginBottom: 12 }}>测试结果</h4>
              {testResult?.error ? (
                <div style={{
                  padding: 12, borderRadius: 4,
                  background: theme === 'dark' ? '#3a1a1a' : '#fff2f0',
                  border: theme === 'dark' ? '1px solid #ff4d4f' : '1px solid #ffccc7',
                  color: theme === 'dark' ? '#ff8a80' : '#cf1322'
                }}>
                  <Text type="danger">{testResult.error}</Text>
                </div>
              ) : testResult ? (
                <Collapse defaultActiveKey={['result']}>
                  <Panel
                    header={
                      <Space>
                        <Tag color={testResult.status_code >= 200 && testResult.status_code < 300 ? 'green' : 'red'}>
                          HTTP {testResult.status_code}
                        </Tag>
                        <Text type="secondary">耗时 {testResult.elapsed?.toFixed?.(2) || '-'}s</Text>
                      </Space>
                    }
                    key="result"
                  >
                    <pre style={{
                      whiteSpace: 'pre-wrap',
                      background: theme === 'dark' ? '#2c2c2c' : '#f5f5f5',
                      color: theme === 'dark' ? '#ffffff' : '#333',
                      padding: '12px', borderRadius: '4px', margin: 0, fontFamily: 'monospace'
                    }}>
                      <code>{JSON.stringify(testResult.body ?? testResult, null, 2)}</code>
                    </pre>
                  </Panel>
                </Collapse>
              ) : (
                <div style={{
                  padding: 12, borderRadius: 4,
                  background: theme === 'dark' ? '#1a3a1a' : '#f6ffed',
                  border: theme === 'dark' ? '1px solid #52c41a' : '1px solid #b7eb8f',
                  color: theme === 'dark' ? '#95de64' : '#389e0d'
                }}>
                  <Text type="success">点击测试按钮开始测试</Text>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default ApiSetting;
