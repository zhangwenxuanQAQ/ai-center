import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, Table, Switch, Modal, message, Popconfirm, Space, Card, Row, Col, Upload, Spin, Pagination, Dropdown, Tooltip, Radio } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, ApiOutlined, ApiTwoTone, UploadOutlined, ImportOutlined, DeleteOutlined, EditOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ClearOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { UploadProps } from 'antd';
import { mcpService, MCPServer, MCPCategory, MCPTool } from '../../services/mcp';
import PageHeader from '../../components/page-header';
import '../../styles/common.css';
import './mcp_setting.less';

const { Option } = Select;

const sourceTypes: Record<string, string> = {
  'local': '本地',
  'thirdparty': '第三方'
};

const transportTypes: Record<string, string> = {
  'sse': 'SSE',
  'streamable_http': 'Streamable HTTP',
  'stdio': 'Stdio'
};

const toolTypes: Record<string, string> = {
  'restful_api': 'api接口',
  'mcp': 'mcp工具'
};

const MCPSetting: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [server, setServer] = useState<MCPServer | null>(null);
  const [originalData, setOriginalData] = useState<Partial<MCPServer>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [categories, setCategories] = useState<MCPCategory[]>([]);
  const [selectedSourceType, setSelectedSourceType] = useState<string>('');
  const [selectedTransportType, setSelectedTransportType] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);
  const [toolsPage, setToolsPage] = useState(1);
  const [toolsPageSize, setToolsPageSize] = useState(20);
  const [toolsTotal, setToolsTotal] = useState(0);
  
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importType, setImportType] = useState<'swagger' | 'tools'>('tools');
  const [swaggerInputType, setSwaggerInputType] = useState<'url' | 'json'>('url');
  const [swaggerUrl, setSwaggerUrl] = useState('');
  const [swaggerJson, setSwaggerJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [swaggerTools, setSwaggerTools] = useState<MCPTool[]>([]);
  const [swaggerToolsLoading, setSwaggerToolsLoading] = useState(false);
  const [selectedSwaggerTools, setSelectedSwaggerTools] = useState<string[]>([]);
  const [swaggerParseResult, setSwaggerParseResult] = useState<{ success: boolean; message: string } | null>(null);
  const [swaggerToolsPage, setSwaggerToolsPage] = useState(1);
  const [swaggerToolsPageSize, setSwaggerToolsPageSize] = useState(20);
  const [swaggerToolsTotal, setSwaggerToolsTotal] = useState(0);
  const [swaggerToolsSearchTitle, setSwaggerToolsSearchTitle] = useState('');
  const [swaggerToolsSearchDesc, setSwaggerToolsSearchDesc] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [globalExtraConfig, setGlobalExtraConfig] = useState('{}');
  
  const [remoteTools, setRemoteTools] = useState<MCPTool[]>([]);
  const [remoteToolsLoading, setRemoteToolsLoading] = useState(false);
  const [remoteToolsPage, setRemoteToolsPage] = useState(1);
  const [remoteToolsPageSize, setRemoteToolsPageSize] = useState(20);
  const [remoteToolsTotal, setRemoteToolsTotal] = useState(0);
  const [remoteToolsSearchName, setRemoteToolsSearchName] = useState('');
  const [remoteToolsSearchDesc, setRemoteToolsSearchDesc] = useState('');
  const [selectedRemoteTools, setSelectedRemoteTools] = useState<string[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [selectAllRemote, setSelectAllRemote] = useState(false);
  
  const [isToolModalVisible, setIsToolModalVisible] = useState(false);
  const [toolForm] = Form.useForm();
  const [editingTool, setEditingTool] = useState<MCPTool | null>(null);
  const [localMcpConfig, setLocalMcpConfig] = useState<{ host: string; port: number; transport_type: string }>({ host: '127.0.0.1', port: 8082, transport_type: 'streamable_http' });

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
      fetchServer(id);
      fetchCategories();
      fetchLocalMcpConfig();
    }
  }, [id]);

  useEffect(() => {
    if (server) {
      fetchTools();
    }
  }, [server, searchName, searchDescription, searchStatus, toolsPage, toolsPageSize]);

  useEffect(() => {
    const currentValues = form.getFieldsValue();
    const changed = Object.keys(currentValues).some(key => {
      return JSON.stringify(currentValues[key]) !== JSON.stringify(originalData[key as keyof typeof originalData]);
    });
    setHasChanges(changed);
  }, [form.getFieldsValue(), originalData]);

  const fetchServer = async (serverId: string) => {
    setLoading(true);
    try {
      const data = await mcpService.getServer(serverId);
      setServer(data);
      setOriginalData({
        name: data.name,
        code: data.code,
        description: data.description,
        source_type: data.source_type,
        transport_type: data.transport_type,
        url: data.url,
        config: data.config,
        category_id: data.category_id,
        avatar: data.avatar
      });
      form.setFieldsValue({
        name: data.name,
        code: data.code,
        description: data.description,
        source_type: data.source_type,
        transport_type: data.transport_type,
        url: data.url,
        config: data.config,
        category_id: data.category_id,
        avatar: data.avatar
      });
      setSelectedSourceType(data.source_type);
      setSelectedTransportType(data.transport_type);
      setAvatarPreview(data.avatar || '');
    } catch (error) {
      console.error('Failed to fetch server:', error);
      message.error('获取MCP服务失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await mcpService.getCategoryTree();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
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

  const fetchTools = async () => {
    if (!server) return;
    setToolsLoading(true);
    try {
      const data = await mcpService.getTools(toolsPage - 1, toolsPageSize, server.id, searchName, searchDescription, searchStatus);
      setTools(data.data || data);
      setToolsTotal(data.total || (Array.isArray(data) ? data.length : 0));
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setToolsLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchName('');
    setSearchDescription('');
    setSearchStatus(undefined);
    setToolsPage(1);
  };

  const handleValuesChange = () => {
    const currentValues = form.getFieldsValue();
    const changed = Object.keys(currentValues).some(key => {
      return JSON.stringify(currentValues[key]) !== JSON.stringify(originalData[key as keyof typeof originalData]);
    });
    setHasChanges(changed);
  };

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value);
    if (value === 'local') {
      setSelectedTransportType('streamable_http');
      const defaultUrl = `http://${localMcpConfig.host}:${localMcpConfig.port}/mcp`;
      form.setFieldsValue({ 
        transport_type: 'streamable_http',
        url: defaultUrl
      });
    } else {
      form.setFieldsValue({ url: '' });
    }
    handleValuesChange();
  };

  const handleTransportTypeChange = (value: string) => {
    setSelectedTransportType(value);
    handleValuesChange();
  };

  const handleTestConnection = async () => {
    if (!server) return;
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      const values = await form.validateFields(['transport_type', 'url', 'config']);
      const result = await mcpService.testConnection({
        transport_type: values.transport_type,
        url: values.url,
        config: values.config
      });
      
      setConnectionTestResult({
        success: result.success,
        message: result.message
      });
      
      if (result.success) {
        message.success('连接测试成功！');
      } else {
        message.error(result.message || '连接测试失败');
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || '连接测试失败'
      });
      message.error('连接测试失败');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRestore = () => {
    form.setFieldsValue(originalData);
    setSelectedSourceType(originalData.source_type || '');
    setSelectedTransportType(originalData.transport_type || '');
    setAvatarPreview(originalData.avatar || '');
    setConnectionTestResult(null);
    setHasChanges(false);
    message.info('已恢复原始数据');
  };

  const handleSave = async () => {
    if (!server) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      await mcpService.updateServer(server.id, {
        ...values,
        avatar: avatarPreview
      });
      message.success('保存成功');
      fetchServer(server.id);
    } catch (error) {
      console.error('Failed to save:', error);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    navigate('/mcp');
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

  const handleImportClick = (type?: 'swagger' | 'tools') => {
    if (type) {
      setImportType(type);
    } else {
      setImportType('swagger');
    }
    setIsImportModalVisible(true);
    setSwaggerUrl('');
    setSwaggerJson('');
    setSwaggerInputType('url');
    setSwaggerTools([]);
    setSelectedSwaggerTools([]);
    setSwaggerParseResult(null);
    setSelectAll(false);
    setGlobalExtraConfig('{}');
    setSelectedRemoteTools([]);
    setRemoteToolsSearchName('');
    setRemoteToolsSearchDesc('');
    setRemoteToolsPage(1);
    setSelectAllRemote(false);
    if (type === 'tools' && server) {
      fetchRemoteTools(1, 20, '', '');
    }
  };

  const fetchRemoteTools = async (page: number = remoteToolsPage, pageSize: number = remoteToolsPageSize, name: string = remoteToolsSearchName, description: string = remoteToolsSearchDesc) => {
    if (!server) return;
    setRemoteToolsLoading(true);
    try {
      const data = await mcpService.getRemoteTools(server.id, page - 1, pageSize, name, description);
      setRemoteTools(data.data || []);
      setRemoteToolsTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch remote tools:', error);
      message.error('获取远程工具列表失败');
      setRemoteTools([]);
      setRemoteToolsTotal(0);
    } finally {
      setRemoteToolsLoading(false);
    }
  };

  const parseSwagger = async () => {
    if (!server) return;
    if (!swaggerUrl && !swaggerJson) {
      return;
    }
    setSwaggerToolsLoading(true);
    setSwaggerParseResult(null);
    try {
      let baseUrl = server.url;
      let headers = {};
      
      // 解析全局配置
      if (globalExtraConfig) {
        try {
          const config = JSON.parse(globalExtraConfig);
          if (config.base_url) {
            baseUrl = config.base_url;
          }
          if (config.headers) {
            headers = config.headers;
          }
        } catch (e) {
          console.error('Failed to parse global extra config:', e);
        }
      }
      
      const result = await mcpService.parseSwagger(
        server.id,
        swaggerUrl || undefined,
        swaggerJson || undefined,
        baseUrl,
        headers
      );
      setSwaggerTools(result.data || []);
      setSwaggerToolsTotal(result.total || 0);
      setSwaggerToolsPage(1);
      setSelectedSwaggerTools([]);
      
      // 从第一个工具的extra_config中提取base_url和headers作为默认值
      if (result.data && result.data.length > 0) {
        try {
          const firstTool = result.data[0];
          const extraConfig = JSON.parse(firstTool.extra_config || '{}');
          const defaultConfig = {
            base_url: extraConfig.base_url || '',
            headers: extraConfig.headers || {}
          };
          setGlobalExtraConfig(JSON.stringify(defaultConfig, null, 2));
        } catch (e) {
          console.error('Failed to parse extra config:', e);
        }
      }
      
      setSwaggerParseResult({
        success: true,
        message: `成功解析Swagger，发现 ${result.data?.length || 0} 个工具`
      });
    } catch (error: any) {
      console.error('Failed to parse swagger:', error);
      setSwaggerTools([]);
      setSwaggerToolsTotal(0);
      setSelectedSwaggerTools([]);
      setSwaggerParseResult({
        success: false,
        message: error.message || '解析Swagger失败'
      });
    } finally {
      setSwaggerToolsLoading(false);
    }
  };

  const handleSwaggerInputBlur = () => {
    parseSwagger();
  };

  const handleSwaggerSearch = () => {
    setSwaggerToolsPage(1);
  };

  const handleSwaggerPageChange = (page: number, pageSize: number) => {
    setSwaggerToolsPage(page);
    setSwaggerToolsPageSize(pageSize);
  };

  const importMenuItems = [
    {
      key: 'swagger',
      label: '来自API接口',
      onClick: () => handleImportClick('swagger'),
    },
    {
      key: 'tools',
      label: '来自能力列表',
      onClick: () => handleImportClick('tools'),
    },
  ];

  const handleImport = async () => {
    if (!server) return;
    setImporting(true);
    try {
      if (importType === 'swagger') {
        if (selectedSwaggerTools.length === 0) {
          message.error('请选择要导入的工具');
          return;
        }
        const toolsToImport = swaggerTools.filter(t => selectedSwaggerTools.includes(t.name));
        
        // 解析全局配置
        let baseUrl = server.url;
        let headers = {};
        if (globalExtraConfig) {
          try {
            const config = JSON.parse(globalExtraConfig);
            if (config.base_url) {
              baseUrl = config.base_url;
            }
            if (config.headers) {
              headers = config.headers;
            }
          } catch (e) {
            console.error('Failed to parse global extra config:', e);
          }
        }
        
        // 更新工具的extra_config，使用全局配置中的base_url和headers
        const updatedToolsToImport = toolsToImport.map(tool => {
          let extraConfig = {};
          try {
            extraConfig = JSON.parse(tool.extra_config || '{}');
          } catch (e) {
            console.error('Failed to parse extra config:', e);
          }
          
          // 更新base_url和headers
          extraConfig.base_url = baseUrl;
          extraConfig.headers = headers;
          
          return {
            ...tool,
            extra_config: JSON.stringify(extraConfig)
          };
        });
        
        const result = await mcpService.importTools(server.id, updatedToolsToImport);
        message.success(`成功导入 ${result.length} 个工具`);
      } else if (importType === 'tools') {
        if (selectedRemoteTools.length === 0) {
          message.error('请选择要导入的工具');
          return;
        }
        const toolsToImport = remoteTools.filter(t => selectedRemoteTools.includes(t.name));
        const result = await mcpService.importTools(server.id, toolsToImport);
        message.success(`成功导入 ${result.length} 个工具`);
      }
      setIsImportModalVisible(false);
      fetchTools();
    } catch (error) {
      console.error('Failed to import:', error);
      message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleToolStatusChange = async (tool: MCPTool, status: boolean) => {
    try {
      await mcpService.updateTool(tool.id, { status });
      message.success('状态更新成功');
      fetchTools();
    } catch (error) {
      console.error('Failed to update tool status:', error);
      message.error('状态更新失败');
    }
  };

  const handleDeleteTool = async (toolId: string) => {
    try {
      await mcpService.deleteTool(toolId);
      message.success('删除成功');
      fetchTools();
    } catch (error) {
      console.error('Failed to delete tool:', error);
      message.error('删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedToolIds.length === 0) {
      message.warning('请选择要删除的工具');
      return;
    }
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedToolIds.length} 个工具吗？`,
      onOk: async () => {
        try {
          const result = await mcpService.batchDeleteTools(selectedToolIds);
          message.success(`成功删除 ${result.deleted_count} 个工具`);
          setSelectedToolIds([]);
          fetchTools();
        } catch (error) {
          console.error('Failed to batch delete tools:', error);
          message.error('批量删除失败');
        }
      },
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      okButtonProps: {
        style: {
          color: theme === 'dark' ? '#fff' : '#333'
        }
      },
      cancelButtonProps: {
        style: {
          color: theme === 'dark' ? '#fff' : '#333'
        }
      }
    });
  };

  const handleEditTool = (tool: MCPTool) => {
    setEditingTool(tool);
    let configStr = '';
    let extraConfigStr = '';
    try {
      if (tool.config) {
        let configObj;
        if (typeof tool.config === 'string') {
          try {
            configObj = JSON.parse(tool.config);
          } catch (parseError) {
            configStr = tool.config;
          }
        } else if (typeof tool.config === 'object') {
          configObj = tool.config;
        }
        if (configObj) {
          configStr = JSON.stringify(configObj, null, 2);
        }
      }
      if (tool.extra_config) {
        let extraConfigObj;
        if (typeof tool.extra_config === 'string') {
          try {
            extraConfigObj = JSON.parse(tool.extra_config);
          } catch (parseError) {
            extraConfigStr = tool.extra_config;
          }
        } else if (typeof tool.extra_config === 'object') {
          extraConfigObj = tool.extra_config;
        }
        if (extraConfigObj) {
          extraConfigStr = JSON.stringify(extraConfigObj, null, 2);
        }
      }
    } catch (error) {
      console.error('Failed to parse config:', error);
      configStr = tool.config || '';
      extraConfigStr = tool.extra_config || '';
    }
    toolForm.setFieldsValue({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      status: tool.status,
      config: configStr,
      extra_config: extraConfigStr
    });
    setIsToolModalVisible(true);
  };

  const handleToolSubmit = async () => {
    if (!editingTool) return;
    try {
      const values = await toolForm.validateFields();
      let updatedConfig = values.config;
      try {
        const configObj = JSON.parse(values.config);
        configObj.name = values.name;
        configObj.description = values.description || '';
        updatedConfig = JSON.stringify(configObj);
      } catch {
        // 如果不是有效JSON，保持原样
      }
      await mcpService.updateTool(editingTool.id, {
        name: values.name,
        title: values.title,
        description: values.description,
        status: values.status,
        config: updatedConfig,
        extra_config: values.extra_config
      });
      message.success('更新成功');
      setIsToolModalVisible(false);
      fetchTools();
    } catch (error) {
      console.error('Failed to update tool:', error);
      message.error('更新失败');
    }
  };

  const toolColumns: ColumnsType<MCPTool> = [
    {
      title: '工具标题',
      dataIndex: 'title',
      key: 'title',
      width: 150,
      ellipsis: true,
      render: (title: string) => (
        <Tooltip title={title} placement="topLeft">
          <span>{title || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '工具描述',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      ellipsis: true,
      render: (description: string) => (
        <Tooltip title={description} placement="topLeft">
          <span>{description || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: '工具类型',
      dataIndex: 'tool_type',
      key: 'tool_type',
      width: 80,
      render: (toolType: string) => (
        <span>{toolTypes[toolType] || toolType}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: boolean, record: MCPTool) => (
        <Switch
          checked={status}
          onChange={(checked) => handleToolStatusChange(record, checked)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      fixed: 'right',
      render: (_, record: MCPTool) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEditTool(record)} size="small" />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个工具吗？"
            onConfirm={() => handleDeleteTool(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" icon={<DeleteOutlined />} danger size="small" className="delete-button" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

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
          { title: 'MCP管理', icon: <ApiOutlined />, onClick: () => navigate('/mcp') },
          { title: '服务配置' },
          { title: server?.name || '' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mcp')}>
            返回列表
          </Button>
        }
      />

      <div className="mcp-setting-container" style={{ display: 'flex', gap: '8px', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
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
              height: '100%'
            }}
          >
            <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '500', color: theme === 'dark' ? '#fff' : '#000', textAlign: 'left' }}>基本信息</h3>
            </div>
            {connectionTestResult && (
              <div style={{ 
                marginBottom: 12,
                padding: '8px 12px',
                borderRadius: 4,
                background: connectionTestResult.success ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                color: connectionTestResult.success ? '#52c41a' : '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 12
              }}>
                {connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                {connectionTestResult.message}
              </div>
            )}
            <Form 
              form={form} 
              layout="vertical"
              onValuesChange={handleValuesChange}
              style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              className="hide-scrollbar"
            >
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                    <Input placeholder="请输入服务名称" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                    <Input placeholder="请输入服务编码" />
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
                    <Select placeholder="请选择传输类型" onChange={handleTransportTypeChange} disabled={selectedSourceType === 'local'}>
                      {Object.entries(transportTypes).map(([key, value]) => (
                        <Option key={key} value={key}>{value}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              {selectedTransportType === 'stdio' && (
                <Form.Item name="config" label="NPX命令">
                  <TextArea 
                    rows={8} 
                    placeholder={`以高德地图为例：
{
  "mcpServers": {
    "amap-maps": {
      "args": ["-y", "@amap/amap-maps-mcp-server"],
      "command": "npx",
      "env": {"AMAP_MAPS_API_KEY": ""}
    }
  }
}`}
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    className="hide-scrollbar"
                  />
                </Form.Item>
              )}
              {(selectedTransportType === 'sse' || selectedTransportType === 'streamable_http') && (
                <>
                  <Form.Item name="url" label="URL">
                    <Input placeholder="请输入MCP服务URL" />
                  </Form.Item>
                  {selectedSourceType === 'thirdparty' && (
                    <Form.Item name="config" label="自定义参数（JSON格式）">
                      <TextArea 
                        rows={8} 
                        placeholder='请输入JSON格式的自定义参数，例如：{"headers": {"Authorization": "Bearer xxx"}}'
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        className="hide-scrollbar"
                      />
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
                        <img src={avatarPreview} alt="头像预览" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                      )}
                      <Upload {...uploadProps}>
                        <Button icon={<UploadOutlined />}>上传头像</Button>
                      </Upload>
                    </div>
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="服务描述">
                <TextArea rows={3} placeholder="请输入服务描述" />
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
                icon={testingConnection ? <LoadingOutlined /> : <ApiTwoTone />}
                onClick={handleTestConnection}
                loading={testingConnection}
              >
                测试连接
              </Button>
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
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', border: 'none', color: '#fff' }}
              >
                保存
              </Button>
            </div>
          </div>
        </div>

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
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#fff' 
            }}
          >
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              {server?.source_type === 'local' ? (
                <Dropdown menu={{ items: importMenuItems }} trigger={['hover']}>
                  <Button type="primary" icon={<ImportOutlined />}>
                    导入
                  </Button>
                </Dropdown>
              ) : (
                <Button type="primary" icon={<ImportOutlined />} onClick={() => handleImportClick('tools')}>
                  导入
                </Button>
              )}
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={handleBatchDelete} 
                className="batch-delete-button"
                disabled={selectedToolIds.length === 0}
              >
                批量删除 ({selectedToolIds.length})
              </Button>
              <Input
                placeholder="搜索名称"
                value={searchName}
                onChange={(e) => { setSearchName(e.target.value); setToolsPage(1); }}
                style={{ width: 200 }}
                allowClear
              />
              <Input
                placeholder="搜索描述"
                value={searchDescription}
                onChange={(e) => { setSearchDescription(e.target.value); setToolsPage(1); }}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                placeholder="请选择状态"
                value={searchStatus}
                onChange={(value) => { setSearchStatus(value); setToolsPage(1); }}
                style={{ width: 140 }}
                allowClear
              >
                <Option value="true">启用</Option>
                <Option value="false">禁用</Option>
              </Select>
              <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
                清空
              </Button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table
                columns={toolColumns}
                dataSource={tools}
                rowKey="id"
                loading={toolsLoading}
                size="small"
                pagination={false}
                scroll={{ y: 'calc(100vh - 400px)' }}
                style={{ flex: 1, minHeight: 0 }}
                rowSelection={{
                  selectedRowKeys: selectedToolIds,
                  onChange: (keys) => setSelectedToolIds(keys as string[]),
                }}
              />
              <div style={{ 
                paddingTop: '16px', 
                borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e8e8e8',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
                background: theme === 'dark' ? 'rgba(30, 30, 30, 0.95)' : '#fff'
              }}>
                <Pagination
                  current={toolsPage}
                  pageSize={toolsPageSize}
                  total={toolsTotal}
                  showSizeChanger
                  showQuickJumper
                  showTotal={(total) => `共 ${total} 条`}
                  pageSizeOptions={['10', '20', '50', '100']}
                  size="small"
                  onChange={(page, pageSize) => {
                    setToolsPage(page);
                    setToolsPageSize(pageSize);
                    // 切换页号时不清空选择
                  }}
                  locale={{
                    items_per_page: '条/页',
                    jump_to: '跳转到',
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title={importType === 'swagger' ? '导入工具 - API接口' : '导入工具 - 能力列表'}
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        onOk={handleImport}
        confirmLoading={importing}
        width={1000}
        style={{ maxHeight: '90vh' }}
        bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
        okText="导入"
        cancelText="取消"
      >
        <Form layout="horizontal" labelAlign="right" labelCol={{ span: 4 }} wrapperCol={{ span: 20 }}>
        {importType === 'swagger' && (
          <>
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
                  onBlur={handleSwaggerInputBlur}
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
                  onBlur={handleSwaggerInputBlur}
                />
              </Form.Item>
            )}
            <Form.Item label="其他参数">
              <TextArea
                rows={4}
                placeholder='请输入全局配置（JSON格式），例如：{"base_url": "http://localhost:8080", "headers": {"Authorization": "Bearer token"}}'
                value={globalExtraConfig}
                onChange={(e) => setGlobalExtraConfig(e.target.value)}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input
                placeholder="搜索标题"
                value={swaggerToolsSearchTitle}
                onChange={(e) => { setSwaggerToolsSearchTitle(e.target.value); setSwaggerToolsPage(1); }}
                onPressEnter={handleSwaggerSearch}
                style={{ width: 160 }}
                allowClear
              />
              <Input
                placeholder="搜索描述"
                value={swaggerToolsSearchDesc}
                onChange={(e) => { setSwaggerToolsSearchDesc(e.target.value); setSwaggerToolsPage(1); }}
                onPressEnter={handleSwaggerSearch}
                style={{ width: 160 }}
                allowClear
              />
              <Button type="primary" onClick={handleSwaggerSearch}>
                搜索
              </Button>
              <Button 
                type="default" 
                onClick={() => {
                  setSelectAll(!selectAll);
                  if (!selectAll) {
                    // 全选当前页的所有工具
                    const currentPageTools = swaggerTools.filter(tool => {
                      const titleMatch = !swaggerToolsSearchTitle || tool.title?.toLowerCase().includes(swaggerToolsSearchTitle.toLowerCase());
                      const descMatch = !swaggerToolsSearchDesc || (tool.description && tool.description.toLowerCase().includes(swaggerToolsSearchDesc.toLowerCase()));
                      return titleMatch && descMatch;
                    });
                    setSelectedSwaggerTools(currentPageTools.map(tool => tool.name));
                  } else {
                    // 取消全选
                    setSelectedSwaggerTools([]);
                  }
                }}
              >
                {selectAll ? '取消全选' : '全选'}
              </Button>
            </div>
            {swaggerParseResult && (
              <div style={{ 
                marginBottom: 16,
                padding: '8px 12px',
                borderRadius: 4,
                background: swaggerParseResult.success ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                color: swaggerParseResult.success ? '#52c41a' : '#ff4d4f',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 12
              }}>
                {swaggerParseResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                {swaggerParseResult.message}
              </div>
            )}
            <div>
              <Table
                className="import-modal-pagination"
                rowKey="name"
                columns={[
                  {
                    title: '标题',
                    dataIndex: 'title',
                    key: 'title',
                    width: 200,
                    ellipsis: true,
                    render: (text: string) => (
                      <Tooltip title={text} placement="topLeft">
                        <span>{text || '-'}</span>
                      </Tooltip>
                    ),
                  },
                  {
                    title: '描述',
                    dataIndex: 'description',
                    key: 'description',
                    width: 150,
                    ellipsis: true,
                    render: (text: string) => (
                      <Tooltip title={text} placement="topLeft">
                        <span>{text || '-'}</span>
                      </Tooltip>
                    ),
                  },
                  {
                    title: '名称',
                    dataIndex: 'name',
                    key: 'name',
                    width: 150,
                    ellipsis: true,
                    render: (text: string) => (
                      <Tooltip title={text} placement="topLeft">
                        <span>{text}</span>
                      </Tooltip>
                    ),
                  },
                  {
                    title: '接口路径',
                    key: 'path',
                    width: 200,
                    ellipsis: true,
                    render: (_, record: any) => {
                      try {
                        const extraConfig = JSON.parse(record.extra_config || '{}');
                        return (
                          <Tooltip title={extraConfig.path || '-'} placement="topLeft">
                            <span>{extraConfig.path || '-'}</span>
                          </Tooltip>
                        );
                      } catch {
                        return '-';
                      }
                    },
                  },
                  {
                    title: '请求方式',
                    key: 'method',
                    width: 100,
                    render: (_, record: any) => {
                      try {
                        const extraConfig = JSON.parse(record.extra_config || '{}');
                        return extraConfig.method || '-';
                      } catch {
                        return '-';
                      }
                    },
                  },
                ]}
                dataSource={swaggerTools.filter(tool => {
                  const titleMatch = !swaggerToolsSearchTitle || tool.title?.toLowerCase().includes(swaggerToolsSearchTitle.toLowerCase());
                  const descMatch = !swaggerToolsSearchDesc || (tool.description && tool.description.toLowerCase().includes(swaggerToolsSearchDesc.toLowerCase()));
                  return titleMatch && descMatch;
                })}
                loading={swaggerToolsLoading}
                size="small"
                pagination={{
                  current: swaggerToolsPage,
                  pageSize: swaggerToolsPageSize,
                  total: swaggerTools.length,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  size: 'small',
                  simple: false,
                  locale: {
                    items_per_page: '条/页',
                    jump_to: '跳转到',
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
                  },
                  onChange: handleSwaggerPageChange,
                }}
                rowSelection={{
                  selectedRowKeys: selectedSwaggerTools,
                  onChange: (keys) => setSelectedSwaggerTools(keys as string[]),
                }}
                scroll={{ y: 300 }}
              />
              {selectedSwaggerTools.length > 0 && (
                <div style={{ marginTop: 8, color: theme === 'dark' ? '#aaa' : '#666' }}>
                  已选择 {selectedSwaggerTools.length} 个工具
                </div>
              )}
            </div>
          </>
        )}
        
        {importType === 'tools' && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input
                placeholder="搜索名称"
                value={remoteToolsSearchName}
                onChange={(e) => { setRemoteToolsSearchName(e.target.value); setRemoteToolsPage(1); }}
                onPressEnter={() => fetchRemoteTools(1, remoteToolsPageSize, remoteToolsSearchName, remoteToolsSearchDesc)}
                style={{ width: 160 }}
                allowClear
              />
              <Input
                placeholder="搜索描述"
                value={remoteToolsSearchDesc}
                onChange={(e) => { setRemoteToolsSearchDesc(e.target.value); setRemoteToolsPage(1); }}
                onPressEnter={() => fetchRemoteTools(1, remoteToolsPageSize, remoteToolsSearchName, remoteToolsSearchDesc)}
                style={{ width: 160 }}
                allowClear
              />
              <Button type="primary" onClick={() => fetchRemoteTools(1, remoteToolsPageSize, remoteToolsSearchName, remoteToolsSearchDesc)}>
                搜索
              </Button>
              <Button 
                type="default" 
                onClick={() => {
                  setSelectAllRemote(!selectAllRemote);
                  if (!selectAllRemote) {
                    // 全选当前页的所有工具
                    const currentPageTools = remoteTools;
                    setSelectedRemoteTools(currentPageTools.map(tool => tool.name));
                  } else {
                    // 取消全选
                    setSelectedRemoteTools([]);
                  }
                }}
              >
                {selectAllRemote ? '取消全选' : '全选'}
              </Button>
            </div>
            <Table
              className="import-modal-pagination"
              rowKey="name"
              columns={[
                {
                  title: '工具名称',
                  dataIndex: 'name',
                  key: 'name',
                  width: 200,
                  ellipsis: true,
                  render: (text: string) => (
                    <Tooltip title={text} placement="topLeft">
                      <span>{text}</span>
                    </Tooltip>
                  ),
                },
                {
                  title: '描述',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true,
                  render: (text: string) => (
                    <Tooltip title={text} placement="topLeft">
                      <span>{text || '-'}</span>
                    </Tooltip>
                  ),
                },
              ]}
              dataSource={remoteTools}
              loading={remoteToolsLoading}
              size="small"
              pagination={{
                current: remoteToolsPage,
                pageSize: remoteToolsPageSize,
                total: remoteToolsTotal,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
                size: 'small',
                simple: false,
                locale: {
                  items_per_page: '条/页',
                  jump_to: '跳转到',
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
                },
                onChange: (page, pageSize) => {
                  setRemoteToolsPage(page);
                  setRemoteToolsPageSize(pageSize);
                  fetchRemoteTools(page, pageSize, remoteToolsSearchName, remoteToolsSearchDesc);
                },
              }}
              rowSelection={{
                selectedRowKeys: selectedRemoteTools,
                onChange: (keys) => setSelectedRemoteTools(keys as string[]),
              }}
              scroll={{ y: 300 }}
            />
            {selectedRemoteTools.length > 0 && (
              <div style={{ marginTop: 8, color: theme === 'dark' ? '#aaa' : '#666' }}>
                已选择 {selectedRemoteTools.length} 个工具
              </div>
            )}
          </div>
        )}
        </Form>
      </Modal>

      <Modal
        title="编辑工具"
        open={isToolModalVisible}
        onCancel={() => setIsToolModalVisible(false)}
        onOk={handleToolSubmit}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={toolForm} layout="vertical">
          <Form.Item name="name" label="工具名称" rules={[{ required: true, message: '请输入工具名称' }]}>
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item name="title" label="工具标题">
            <Input placeholder="请输入工具标题" />
          </Form.Item>
          <Form.Item name="description" label="工具描述">
            <TextArea rows={3} placeholder="请输入工具描述" />
          </Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item name="config" label="工具配置">
            <TextArea rows={8} placeholder="请输入工具配置（JSON格式）" style={{ fontFamily: 'monospace', whiteSpace: 'pre', overflowWrap: 'normal' }} />
          </Form.Item>
          <Form.Item name="extra_config" label="额外配置">
            <TextArea rows={6} placeholder="请输入额外配置（JSON格式）" style={{ fontFamily: 'monospace', whiteSpace: 'pre', overflowWrap: 'normal' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MCPSetting;
