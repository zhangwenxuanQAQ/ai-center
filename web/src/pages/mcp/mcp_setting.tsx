import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Input, Select, TreeSelect, Button, Table, Switch, Modal, message, Popconfirm, Space, Card, Row, Col, Upload, Spin } from 'antd';
const { TextArea } = Input;
import { ArrowLeftOutlined, SaveOutlined, UndoOutlined, ApiOutlined, ApiTwoTone, UploadOutlined, ImportOutlined, DeleteOutlined, EditOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';
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
  const [searchStatus, setSearchStatus] = useState<string>('');
  
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);
  const [importType, setImportType] = useState<'swagger' | 'tools'>('tools');
  const [swaggerUrl, setSwaggerUrl] = useState('');
  const [swaggerJson, setSwaggerJson] = useState('');
  const [importing, setImporting] = useState(false);
  
  const [isToolModalVisible, setIsToolModalVisible] = useState(false);
  const [toolForm] = Form.useForm();
  const [editingTool, setEditingTool] = useState<MCPTool | null>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
    
    if (id) {
      fetchServer(id);
      fetchCategories();
    }
  }, [id]);

  useEffect(() => {
    if (server) {
      fetchTools();
    }
  }, [server, searchName, searchDescription, searchStatus]);

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

  const fetchTools = async () => {
    if (!server) return;
    setToolsLoading(true);
    try {
      const data = await mcpService.getTools(0, 1000, server.id);
      let filtered = data;
      if (searchName) {
        filtered = filtered.filter(t => t.name.toLowerCase().includes(searchName.toLowerCase()));
      }
      if (searchDescription) {
        filtered = filtered.filter(t => t.description?.toLowerCase().includes(searchDescription.toLowerCase()));
      }
      if (searchStatus !== '') {
        filtered = filtered.filter(t => t.status === (searchStatus === 'true'));
      }
      setTools(filtered);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    } finally {
      setToolsLoading(false);
    }
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

  const handleImportClick = () => {
    setIsImportModalVisible(true);
    setImportType('tools');
    setSwaggerUrl('');
    setSwaggerJson('');
  };

  const handleImport = async () => {
    if (!server) return;
    setImporting(true);
    try {
      if (importType === 'swagger') {
        if (!swaggerUrl && !swaggerJson) {
          message.error('请输入Swagger URL或Swagger JSON');
          return;
        }
        const result = await mcpService.importSwaggerTools(
          server.id,
          swaggerUrl || undefined,
          swaggerJson || undefined
        );
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

  const handleEditTool = (tool: MCPTool) => {
    setEditingTool(tool);
    toolForm.setFieldsValue({
      name: tool.name,
      description: tool.description,
      config: tool.config
    });
    setIsToolModalVisible(true);
  };

  const handleToolSubmit = async () => {
    if (!editingTool) return;
    try {
      const values = await toolForm.validateFields();
      await mcpService.updateTool(editingTool.id, values);
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
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'tool_type',
      key: 'tool_type',
      width: 100,
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
      width: 120,
      render: (_, record: MCPTool) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditTool(record)} size="small">
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个工具吗？"
            onConfirm={() => handleDeleteTool(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" icon={<DeleteOutlined />} danger size="small">
              删除
            </Button>
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
          { title: 'MCP管理', icon: <ApiOutlined />, onClick: () => navigate('/mcps') },
          { title: '服务配置' },
          { title: server?.name || '' }
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/mcps')}>
            返回列表
          </Button>
        }
      />

      <div className="mcp-setting-container" style={{ display: 'flex', gap: '16px', height: 'calc(100% - 60px)', overflow: 'hidden' }}>
        <div style={{ width: '400px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'auto' }}>
          <Card 
            title="基本信息" 
            className={`setting-card ${theme === 'dark' ? 'dark' : 'light'}`}
            size="small"
            extra={
              <Space size="small">
                <Button 
                  size="small"
                  icon={testingConnection ? <LoadingOutlined /> : <ApiTwoTone />}
                  onClick={handleTestConnection}
                  loading={testingConnection}
                  disabled={selectedSourceType === 'local'}
                >
                  测试
                </Button>
                <Button 
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={handleRestore}
                  disabled={!hasChanges}
                >
                  恢复
                </Button>
                <Button 
                  size="small"
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasChanges}
                >
                  保存
                </Button>
              </Space>
            }
          >
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
              size="small"
            >
              <Form.Item name="name" label="服务名称" rules={[{ required: true, message: '请输入服务名称' }]}>
                <Input placeholder="请输入服务名称" />
              </Form.Item>
              <Form.Item name="code" label="服务编码" rules={[{ required: true, message: '请输入服务编码' }, { pattern: /^[a-zA-Z0-9_]+$/, message: '编码只能包含字母、数字和下划线' }]}>
                <Input placeholder="请输入服务编码" disabled />
              </Form.Item>
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item name="source_type" label="来源类型" rules={[{ required: true, message: '请选择来源类型' }]}>
                    <Select placeholder="请选择来源类型" onChange={handleSourceTypeChange} disabled>
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
                  <TextArea rows={6} placeholder={`以高德地图为例：
{
  "mcpServers": {
    "amap-maps": {
      "args": ["-y", "@amap/amap-maps-mcp-server"],
      "command": "npx",
      "env": {"AMAP_MAPS_API_KEY": ""}
    }
  }
}`} />
                </Form.Item>
              )}
              {(selectedTransportType === 'sse' || selectedTransportType === 'streamable_http') && (
                <>
                  <Form.Item name="url" label="URL">
                    <Input placeholder="请输入MCP服务URL" disabled={selectedSourceType === 'local'} />
                  </Form.Item>
                  {selectedSourceType === 'thirdparty' && (
                    <Form.Item name="config" label="自定义参数">
                      <TextArea rows={3} placeholder='JSON格式，如：{"headers": {"Authorization": "Bearer xxx"}}' />
                    </Form.Item>
                  )}
                </>
              )}
              <Form.Item name="category_id" label="分类">
                <TreeSelect placeholder="请选择分类" treeData={buildCategoryTreeSelectData()} treeDefaultExpandAll allowClear />
              </Form.Item>
              <Form.Item name="avatar" label="服务头像">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {avatarPreview && (
                    <img src={avatarPreview} alt="头像" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                  <Upload {...uploadProps}>
                    <Button size="small" icon={<UploadOutlined />}>上传</Button>
                  </Upload>
                </div>
              </Form.Item>
              <Form.Item name="description" label="服务描述">
                <TextArea rows={2} placeholder="请输入服务描述" />
              </Form.Item>
            </Form>
          </Card>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Card 
            title="工具列表" 
            className={`setting-card tools-card ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '12px' }}
            extra={
              <Button type="primary" size="small" icon={<ImportOutlined />} onClick={handleImportClick}>
                导入
              </Button>
            }
          >
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <Input
                placeholder="搜索名称"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                style={{ width: 120 }}
                size="small"
              />
              <Input
                placeholder="搜索描述"
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                style={{ width: 120 }}
                size="small"
              />
              <Select
                placeholder="状态"
                value={searchStatus}
                onChange={setSearchStatus}
                style={{ width: 80 }}
                size="small"
                allowClear
              >
                <Option value="true">启用</Option>
                <Option value="false">禁用</Option>
              </Select>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Table
                columns={toolColumns}
                dataSource={tools}
                rowKey="id"
                loading={toolsLoading}
                size="small"
                pagination={{
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条`,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  size: 'small',
                }}
                scroll={{ y: 'calc(100vh - 320px)' }}
              />
            </div>
          </Card>
        </div>
      </div>

      <Modal
        title="导入工具"
        open={isImportModalVisible}
        onCancel={() => setIsImportModalVisible(false)}
        onOk={handleImport}
        confirmLoading={importing}
        width={600}
        okText="导入"
        cancelText="取消"
      >
        {server?.source_type === 'local' && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ marginRight: 16 }}>导入方式：</span>
            <Select value={importType} onChange={setImportType} style={{ width: 200 }}>
              <Option value="swagger">从Swagger导入</Option>
              <Option value="tools">从工具列表导入</Option>
            </Select>
          </div>
        )}
        
        {importType === 'swagger' && (
          <>
            <Form.Item label="Swagger URL">
              <Input
                placeholder="请输入Swagger文档URL"
                value={swaggerUrl}
                onChange={(e) => setSwaggerUrl(e.target.value)}
              />
            </Form.Item>
            <Form.Item label="或 Swagger JSON">
              <TextArea
                rows={8}
                placeholder="请粘贴Swagger JSON内容"
                value={swaggerJson}
                onChange={(e) => setSwaggerJson(e.target.value)}
              />
            </Form.Item>
          </>
        )}
        
        {importType === 'tools' && (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#999' }}>
            工具列表导入功能开发中...
          </div>
        )}
      </Modal>

      <Modal
        title="编辑工具"
        open={isToolModalVisible}
        onCancel={() => setIsToolModalVisible(false)}
        onOk={handleToolSubmit}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form form={toolForm} layout="vertical">
          <Form.Item name="name" label="工具名称" rules={[{ required: true, message: '请输入工具名称' }]}>
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item name="description" label="工具描述">
            <TextArea rows={3} placeholder="请输入工具描述" />
          </Form.Item>
          <Form.Item name="config" label="工具配置">
            <TextArea rows={6} placeholder="请输入工具配置（JSON格式）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MCPSetting;
