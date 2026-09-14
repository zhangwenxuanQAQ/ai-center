import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select,
  message, Popconfirm, Table, Tag, Tooltip, Segmented, Space, Pagination, Upload,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  AppstoreOutlined, BarsOutlined, LockOutlined, CheckCircleOutlined,
  ClockCircleOutlined, RobotOutlined, ThunderboltOutlined,
  AppstoreAddOutlined, FolderOpenOutlined, UploadOutlined, PictureOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { hermesAgentService, HermesAgent } from '../../services/hermes_agent';
import { getProviderAvatar } from '../../utils/avatar';

const { Option } = Select;
const { TextArea } = Input;

/**
 * Hermes 智能体列表页
 * 支持表格/卡片两种展示形式（默认卡片，样式对齐模型管理页），
 * 新增（克隆自已有智能体，默认 default）、编辑、删除（default 不可删除），
 * 支持名称+描述搜索（回车/失焦触发），主题随全局 light/dark 切换
 */
const HermesAgentList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<HermesAgent[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchDesc, setSearchDesc] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState<HermesAgent | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  // 记录上次搜索条件，失焦时仅在内容变化才触发查询
  const lastSearchRef = useRef({ name: '', desc: '' });

  // 主题监听（与模型管理页一致）
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

  /** 加载智能体列表 */
  const loadAgents = async (name?: string, desc?: string) => {
    setLoading(true);
    try {
      const data = await hermesAgentService.getAgents(
        name ?? (searchName || undefined),
        desc ?? (searchDesc || undefined)
      );
      setAgents(data);
    } catch (e) {
      // request 工具已统一提示错误
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 触发搜索（记录条件，避免重复请求） */
  const handleSearch = () => {
    const changed =
      lastSearchRef.current.name !== searchName ||
      lastSearchRef.current.desc !== searchDesc;
    if (!changed) return;
    lastSearchRef.current = { name: searchName, desc: searchDesc };
    setCurrentPage(1);
    loadAgents(searchName || undefined, searchDesc || undefined);
  };

  /** 失焦搜索 */
  const handleSearchBlur = () => {
    handleSearch();
  };

  /** 新增智能体 */
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await hermesAgentService.createAgent(values);
      message.success('智能体创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadAgents();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '智能体创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 打开编辑弹窗 */
  const openEdit = (agent: HermesAgent) => {
    setEditingAgent(agent);
    editForm.setFieldsValue({
      new_name: agent.name,
      description: agent.description || '',
    });
    setEditAvatarPreview(agent.avatar ? hermesAgentService.getAvatarUrl(agent.name) : '');
    setEditModalVisible(true);
  };

  /** 编辑弹窗头像上传配置（选择后立即上传） */
  const editAvatarUploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    customRequest: async ({ file, onSuccess, onError }) => {
      if (!editingAgent) return;
      try {
        await hermesAgentService.uploadAvatar(editingAgent.name, file as File);
        // 时间戳破除浏览器图片缓存
        setEditAvatarPreview(hermesAgentService.getAvatarUrl(editingAgent.name) + `?t=${Date.now()}`);
        message.success('头像上传成功');
        onSuccess?.({}, file as any);
      } catch (e: any) {
        message.error(e?.message || '头像上传失败');
        onError?.(e as any);
      }
    },
  };

  /** 删除头像 */
  const handleDeleteAvatar = async () => {
    if (!editingAgent) return;
    try {
      await hermesAgentService.deleteAvatar(editingAgent.name);
      setEditAvatarPreview('');
      message.success('头像已删除');
    } catch (e: any) {
      message.error(e?.message || '头像删除失败');
    }
  };

  /** 保存编辑 */
  const handleEdit = async () => {
    if (!editingAgent) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await hermesAgentService.updateAgent(editingAgent.name, values);
      message.success('智能体更新成功');
      setEditModalVisible(false);
      setEditingAgent(null);
      loadAgents();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || '智能体更新失败');
    } finally {
      setSubmitting(false);
    }
  };

  /** 删除智能体 */
  const handleDelete = async (agent: HermesAgent) => {
    try {
      await hermesAgentService.deleteAgent(agent.name);
      message.success('智能体删除成功');
      loadAgents();
    } catch (e: any) {
      message.error(e?.message || '智能体删除失败');
    }
  };

  /** 进入详情页 */
  const goDetail = (name: string) => {
    navigate(`/hermes/agent/${encodeURIComponent(name)}`);
  };

  const isDark = theme === 'dark';
  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.55)' : '#8f959e';
  const faintText = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

  /** 名称列（可点击进入详情） */
  const nameColumn = {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    render: (text: string, record: HermesAgent) => (
      <Space>
        <a onClick={() => goDetail(record.name)} style={{ fontWeight: 500 }}>{text}</a>
        {record.is_default && (
          <Tooltip title="默认智能体，不可删除">
            <Tag color="blue" icon={<LockOutlined />}>默认</Tag>
          </Tooltip>
        )}
        {record.is_active && !record.is_default && <Tag color="green">活跃</Tag>}
      </Space>
    ),
  };

  /** 表格列定义 */
  const columns = useMemo(() => [
    nameColumn,
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || <span style={{ color: secondaryText }}>-</span>,
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 140,
      render: (text: string) => text ? <Tag>{text}</Tag> : <span style={{ color: secondaryText }}>—</span>,
    },
    {
      title: '技能数',
      dataIndex: 'skill_count',
      key: 'skill_count',
      width: 90,
      render: (v: number) => <span style={{ color: secondaryText }}>{v ?? 0}</span>,
    },
    {
      title: '工具数',
      dataIndex: 'tool_count',
      key: 'tool_count',
      width: 90,
      render: (v: number) => <span style={{ color: secondaryText }}>{v ?? 0}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <span style={{ color: secondaryText, fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (v: string) => <span style={{ color: secondaryText, fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: '路径',
      dataIndex: 'path',
      key: 'path',
      width: 260,
      ellipsis: true,
      render: (text: string) => <Tooltip title={text}><span style={{ color: secondaryText, fontSize: 12 }}>{text}</span></Tooltip>,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: HermesAgent) => (
        <Space>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          {!record.is_default && (
            <Popconfirm
              title="确定删除该智能体吗？"
              description="删除后目录将被移除，不可恢复"
              onConfirm={() => handleDelete(record)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="删除">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [agents, theme]);

  /** 分页数据 */
  const pagedAgents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return agents.slice(start, start + pageSize);
  }, [agents, currentPage, pageSize]);

  /** 卡片渲染（样式对齐模型管理页） */
  const renderCards = () => (
    <Row gutter={[16, 16]}>
      {pagedAgents.map((agent, index) => (
        <Col xs={24} sm={12} md={8} lg={6} key={agent.name} style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'both' }}>
          <Card
            className={`llm-model-card ${isDark ? 'dark' : 'light'}`}
            data-card-type="model"
            style={{
              background: isDark ? '#1a1a2e' : '#fff',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #f0f0f0',
              borderRadius: '16px',
              boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
            }}
            bodyStyle={{ padding: '24px', display: 'flex', flexDirection: 'column', height: 300 }}
            onClick={() => goDetail(agent.name)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 顶部：头像 + 名称/描述 | 状态标签 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <img
                    src={agent.avatar
                      ? hermesAgentService.getAvatarUrl(agent.name)
                      : getProviderAvatar(agent.model || 'hermes')}
                    alt={agent.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = getProviderAvatar(agent.model || 'hermes'); }}
                    style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontWeight: '600', fontSize: '17px', color: isDark ? '#ffffff' : '#1f2329' }}>
                      {agent.name}
                    </div>
                    <div
                      style={{ fontSize: '13px', color: secondaryText, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      title={agent.description || '暂无描述'}
                    >
                      {agent.description || '暂无描述'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  {agent.is_default && <Tag icon={<LockOutlined />} color="blue" style={{ marginBottom: 0, borderRadius: '4px' }}>默认</Tag>}
                  {!agent.is_default && agent.is_active && <Tag icon={<CheckCircleOutlined />} color="success" style={{ marginBottom: 0, borderRadius: '4px' }}>活跃</Tag>}
                  {!agent.is_default && !agent.is_active && (
                    <Tag style={{ marginBottom: 0, borderRadius: '4px', background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: secondaryText }}>空闲</Tag>
                  )}
                </div>
              </div>

              {/* 中部：模型/技能/工具标签 */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                <Tag style={{ marginBottom: 0, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', fontWeight: '500', background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)' }}>
                  <RobotOutlined style={{ marginRight: 4 }} />{agent.model || '未配置模型'}
                </Tag>
                <Tag style={{ marginBottom: 0, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', fontWeight: '500', background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)' }}>
                  <AppstoreAddOutlined style={{ marginRight: 4 }} />{agent.skill_count ?? 0} 技能
                </Tag>
                <Tag style={{ marginBottom: 0, fontSize: '12px', padding: '5px 12px', borderRadius: '6px', fontWeight: '500', background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5', color: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.65)' }}>
                  <ThunderboltOutlined style={{ marginRight: 4 }} />{agent.tool_count ?? 0} 工具
                </Tag>
              </div>

              {/* 目录路径 */}
              <Tooltip title={agent.path}>
                <div style={{ fontSize: '12px', color: faintText, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  <FolderOpenOutlined />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.path}</span>
                </div>
              </Tooltip>

              {/* 底部：时间 + 操作按钮 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                marginTop: 'auto',
                borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #f0f0f0',
                paddingTop: '16px',
              }}>
                <div style={{ fontSize: '12px', color: faintText, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ClockCircleOutlined />
                  更新于: {agent.updated_at || '—'}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEdit(agent); }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '500',
                      background: 'rgba(90, 111, 214, 0.08)',
                      color: '#5a6fd6',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <EditOutlined />
                    编辑
                  </button>
                  {agent.is_default ? (
                    <Tooltip title="默认智能体不可删除">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                          color: faintText,
                          cursor: 'not-allowed',
                        }}
                      >
                        <LockOutlined />
                        删除
                      </button>
                    </Tooltip>
                  ) : (
                    <Popconfirm
                      title="确定删除该智能体吗？"
                      description="删除后目录将被移除，不可恢复"
                      onConfirm={(e) => { e?.stopPropagation(); handleDelete(agent); }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <button
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '10px 16px',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '500',
                          background: 'rgba(255, 102, 102, 0.08)',
                          color: '#ff6666',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <DeleteOutlined />
                        删除
                      </button>
                    </Popconfirm>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );

  return (
    <div className={`page-container ${isDark ? 'dark' : 'light'}`} style={{ padding: 24, minHeight: '100%' }}>
      {/* 顶部操作栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space wrap>
          <Input
            placeholder="搜索智能体名称"
            prefix={<SearchOutlined />}
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            onPressEnter={handleSearch}
            onBlur={handleSearchBlur}
            style={{
              width: 220,
              height: '36px',
              borderRadius: '8px',
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
            }}
            allowClear
          />
          <Input
            placeholder="搜索智能体描述"
            prefix={<SearchOutlined />}
            value={searchDesc}
            onChange={(e) => setSearchDesc(e.target.value)}
            onPressEnter={handleSearch}
            onBlur={handleSearchBlur}
            style={{
              width: 220,
              height: '36px',
              borderRadius: '8px',
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d9d9d9',
            }}
            allowClear
          />
        </Space>
        <Space>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v as 'table' | 'card')}
            options={[
              { value: 'table', icon: <BarsOutlined />, label: '表格' },
              { value: 'card', icon: <AppstoreOutlined />, label: '卡片' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            createForm.resetFields();
            createForm.setFieldsValue({ clone_from: 'default' });
            setCreateModalVisible(true);
          }}>
            新增智能体
          </Button>
        </Space>
      </div>

      {/* 列表内容（卡片/表格容器，padding 24px） */}
      <Spin spinning={loading} wrapperClassName="list-spin">
        <div className="agent-list-body">
          {agents.length === 0 && !loading ? (
            <Empty description="暂无智能体" style={{ marginTop: 80 }} />
          ) : viewMode === 'table' ? (
            <Table
              rowKey="name"
              columns={columns}
              dataSource={pagedAgents}
              pagination={false}
            />
          ) : (
            renderCards()
          )}
        </div>
      </Spin>

      {/* 分页栏（居中且固定到底部） */}
      {agents.length > 0 && (
        <div
          className={`agent-list-pagination ${isDark ? 'dark' : 'light'}`}
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={agents.length}
            onChange={(page) => setCurrentPage(page)}
            onShowSizeChange={(_, size) => { setPageSize(size); setCurrentPage(1); }}
            showSizeChanger
            showTotal={(total) => `共 ${total} 个智能体`}
            pageSizeOptions={['8', '12', '24', '48']}
            showQuickJumper
          />
        </div>
      )}

      {/* 新增弹窗 */}
      <Modal
        title="新增智能体"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="智能体名称"
            rules={[
              { required: true, message: '请输入智能体名称' },
              {
                pattern: /^[a-z0-9][a-z0-9_-]*$/,
                message: '仅允许小写字母、数字、连字符，且以字母或数字开头',
              },
            ]}
            extra="将作为 hermes profile 名称，用于目录与 CLI 调用"
          >
            <Input placeholder="如：code-reviewer" maxLength={64} />
          </Form.Item>
          <Form.Item
            name="clone_from"
            label="克隆自"
            rules={[{ required: true, message: '请选择克隆来源' }]}
            extra="新智能体将复制来源智能体的配置、SOUL 与技能"
          >
            <Select placeholder="选择克隆来源">
              {agents.map((a) => (
                <Option key={a.name} value={a.name}>
                  {a.name}{a.is_default ? '（基础智能体）' : ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="智能体描述（可选）" maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title={`编辑智能体：${editingAgent?.name || ''}`}
        open={editModalVisible}
        onOk={handleEdit}
        onCancel={() => { setEditModalVisible(false); setEditingAgent(null); }}
        confirmLoading={submitting}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          {editingAgent && !editingAgent.is_default && (
            <Form.Item
              name="new_name"
              label="名称"
              rules={[
                { required: true, message: '请输入智能体名称' },
                {
                  pattern: /^[a-z0-9][a-z0-9_-]*$/,
                  message: '仅允许小写字母、数字、连字符，且以字母或数字开头',
                },
              ]}
            >
              <Input maxLength={64} />
            </Form.Item>
          )}
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="智能体描述（可选）" maxLength={500} showCount />
          </Form.Item>
          <Form.Item label="头像">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {editAvatarPreview ? (
                <img
                  src={editAvatarPreview}
                  alt="头像预览"
                  style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #d9d9d9' }}
                />
              ) : (
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f5f5f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: faintText,
                }}>
                  <PictureOutlined style={{ fontSize: 22 }} />
                </div>
              )}
              <Upload {...editAvatarUploadProps} maxCount={1}>
                <Button icon={<UploadOutlined />}>上传头像</Button>
              </Upload>
              {editAvatarPreview && (
                <Button danger size="small" icon={<DeleteOutlined />} onClick={handleDeleteAvatar}>
                  清空
                </Button>
              )}
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default HermesAgentList;
