import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Empty, Input, message, Spin,
  Table, Tabs, Tag, Tooltip, Modal, Form, Space, Upload,
  Popconfirm, Switch, Select,
} from 'antd';
import {
  SaveOutlined, HeartOutlined, ToolOutlined,
  BookOutlined, DatabaseOutlined, UserOutlined, SettingOutlined,
  LockOutlined, CheckCircleOutlined, RobotOutlined, AppstoreAddOutlined,
  ThunderboltOutlined, ClockCircleOutlined, FolderOpenOutlined,
  SearchOutlined, CloudDownloadOutlined, UploadOutlined, EyeOutlined,
  CaretRightOutlined, DownOutlined, PlusOutlined, DeleteOutlined, StopOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { hermesAgentService, HermesAgent, HermesSkill, HermesTool } from '../../services/hermes_agent';
import { llmModelService, LLMModel } from '../../services/llm_model';
import { getProviderAvatar } from '../../utils/avatar';
import SkillDetailModal from './skill_detail_modal';
import '../../styles/common.css';

/** 文件类型标签页配置（标签不显示文档名，文档名在描述中提示） */
const FILE_TABS = [
  { key: 'soul', label: '灵魂', icon: <HeartOutlined />, file_type: 'soul', desc: '智能体的身份与人设（SOUL.md，作为 system prompt 的稳定部分）' },
  { key: 'memory', label: '记忆', icon: <DatabaseOutlined />, file_type: 'memory', desc: '智能体自己的持久笔记（MEMORY.md，跨会话记忆）' },
  { key: 'user', label: '用户信息与偏好', icon: <UserOutlined />, file_type: 'user', desc: '用户画像（USER.md，智能体对用户的认知与偏好）' },
] as const;

/**
 * Hermes 智能体详情页
 * 展示：基本信息可视化卡片、灵魂、记忆、用户信息与偏好、技能、工具、模型配置
 * 主题随全局 light/dark 切换，卡片无 hover 浮起效果
 */
const HermesAgentDetail: React.FC = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const agentName = name ? decodeURIComponent(name) : '';

  const [loading, setLoading] = useState(false);
  const [agent, setAgent] = useState<HermesAgent | null>(null);
  const [skills, setSkills] = useState<HermesSkill[]>([]);
  const [tools, setTools] = useState<HermesTool[]>([]);
  const [activeTab, setActiveTab] = useState('soul');
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileDirty, setFileDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  /** 头像预览地址（含时间戳破缓存），空表示未设置 */
  const [avatarPreview, setAvatarPreview] = useState('');
  /** 技能详情弹窗 */
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState<HermesSkill | null>(null);
  /** 工具详情弹窗 */
  const [toolDetail, setToolDetail] = useState<HermesTool | null>(null);
  /** 停用/启用切换中的项（技能 name 或工具 name），防止重复提交 */
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  /** 新增技能弹窗 */
  const [skillCreateOpen, setSkillCreateOpen] = useState(false);
  const [creatingSkill, setCreatingSkill] = useState(false);
  const [skillForm] = Form.useForm();

  const isDark = theme === 'dark';
  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.55)' : '#8f959e';
  const faintText = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';

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

  // 模型配置
  const [modelForm] = Form.useForm();
  const [modelSelectOpen, setModelSelectOpen] = useState(false);
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmSearch, setLlmSearch] = useState('');
  const [savingModel, setSavingModel] = useState(false);

  /** 加载智能体详情（含三个文件内容） */
  const loadAgent = useCallback(async () => {
    if (!agentName) return;
    setLoading(true);
    try {
      const detail = await hermesAgentService.getAgent(agentName);
      setAgent(detail);
      setAvatarPreview(detail.avatar ? hermesAgentService.getAvatarUrl(agentName) : '');
      setFileContents({
        soul: detail.soul || '',
        memory: detail.memory || '',
        user: detail.user_profile || '',
      });
    } catch (e) {
      // request 工具已统一提示错误
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  /** 加载技能与工具 */
  const loadCapabilities = useCallback(async () => {
    if (!agentName) return;
    try {
      const [skillList, toolList] = await Promise.all([
        hermesAgentService.getSkills(agentName),
        hermesAgentService.getTools(agentName),
      ]);
      setSkills(skillList);
      setTools(toolList);
    } catch (e) {
      // 忽略能力加载失败，不阻塞页面
    }
  }, [agentName]);

  /** 加载模型配置 */
  const loadModelConfig = useCallback(async () => {
    if (!agentName) return;
    try {
      const cfg = await hermesAgentService.getModelConfig(agentName);
      modelForm.setFieldsValue({
        model: cfg.model || '',
        api_key: cfg.api_key || '',
        url: cfg.url || '',
      });
    } catch (e) {
      // 忽略模型配置加载失败，不阻塞页面
    }
  }, [agentName, modelForm]);

  useEffect(() => {
    loadAgent();
    loadCapabilities();
    loadModelConfig();
  }, [loadAgent, loadCapabilities, loadModelConfig]);

  /** 编辑文件内容 */
  const handleContentChange = (fileType: string, content: string) => {
    setFileContents((prev) => ({ ...prev, [fileType]: content }));
    setFileDirty((prev) => ({ ...prev, [fileType]: true }));
  };

  /** 保存文件内容 */
  const handleSave = async (fileType: string) => {
    if (!agentName) return;
    setSaving(true);
    try {
      await hermesAgentService.writeFile(agentName, fileType, fileContents[fileType] || '');
      message.success('保存成功');
      setFileDirty((prev) => ({ ...prev, [fileType]: false }));
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 打开模型库选择弹窗 */
  const openModelSelect = async () => {
    setModelSelectOpen(true);
    setLlmLoading(true);
    try {
      const res = await llmModelService.getLLMModels(1, 100);
      setLlmModels(res.data || []);
    } catch (e) {
      // request 工具已统一提示错误
    } finally {
      setLlmLoading(false);
    }
  };

  /** 模型库搜索 */
  const handleLlmSearch = async () => {
    setLlmLoading(true);
    try {
      const res = await llmModelService.getLLMModels(1, 100, undefined, llmSearch || undefined);
      setLlmModels(res.data || []);
    } catch (e) {
      // request 工具已统一提示错误
    } finally {
      setLlmLoading(false);
    }
  };

  /** 引用模型库中的模型（填充表单，保存后生效） */
  const handleSelectModel = (m: LLMModel) => {
    // 统一走 OpenAI 兼容模式，填充模型名称、密钥与接口地址
    modelForm.setFieldsValue({
      model: m.name,
      api_key: m.api_key || '',
      url: m.endpoint || '',
    });
    message.success(`已引用「${m.name}」，保存后生效`);
    setModelSelectOpen(false);
  };

  /** 保存模型配置 */
  const handleSaveModel = async () => {
    if (!agentName) return;
    try {
      const values = await modelForm.validateFields();
      setSavingModel(true);
      await hermesAgentService.updateModelConfig(agentName, values);
      message.success('模型配置已保存');
      loadAgent(); // 刷新基本信息中的模型显示
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '保存失败');
    } finally {
      setSavingModel(false);
    }
  };

  /** 头像上传配置（选择后立即上传，悬停可点击更换） */
  const avatarUploadProps: UploadProps = {
    name: 'file',
    showUploadList: false,
    accept: 'image/png,image/jpeg,image/webp,image/gif',
    customRequest: async ({ file, onSuccess, onError }) => {
      if (!agentName) return;
      try {
        await hermesAgentService.uploadAvatar(agentName, file as File);
        // 时间戳破除浏览器图片缓存
        setAvatarPreview(hermesAgentService.getAvatarUrl(agentName) + `?t=${Date.now()}`);
        message.success('头像上传成功');
        onSuccess?.({}, file as any);
      } catch (e: any) {
        message.error(e?.message || '头像上传失败');
        onError?.(e as any);
      }
    },
  };

  /** 技能/工具搜索关键字与状态过滤（空串表示不过滤） */
  const [skillSearch, setSkillSearch] = useState('');
  const [skillStatusFilter, setSkillStatusFilter] = useState<string>('all');
  const [toolSearch, setToolSearch] = useState('');
  const [toolStatusFilter, setToolStatusFilter] = useState<string>('all');

  /** 名称/描述关键字匹配（不区分大小写，空关键字全匹配） */
  const matchesKeyword = (keyword: string, name?: string, description?: string) => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return true;
    return (
      (name || '').toLowerCase().includes(kw)
      || (description || '').toLowerCase().includes(kw)
    );
  };

  /** 技能列表：按名称/描述关键字 + 启用停用状态过滤 */
  const filteredSkills = useMemo(() => skills.filter((s) => {
    if (!matchesKeyword(skillSearch, s.name, s.description)) return false;
    if (skillStatusFilter !== 'all' && (s.status === 'disabled') !== (skillStatusFilter === 'disabled')) return false;
    return true;
  }), [skills, skillSearch, skillStatusFilter]);

  /** 工具列表：按名称/描述关键字 + 启用停用状态过滤 */
  const filteredTools = useMemo(() => tools.filter((t) => {
    if (!matchesKeyword(toolSearch, t.name, t.description)) return false;
    if (toolStatusFilter !== 'all' && t.enabled !== (toolStatusFilter === 'enabled')) return false;
    return true;
  }), [tools, toolSearch, toolStatusFilter]);

  /** 技能按分类分组（保持技能列表原始顺序，先按关键字与状态过滤） */
  const skillGroups = useMemo(() => {
    const groups: { category: string; skills: HermesSkill[] }[] = [];
    const indexMap = new Map<string, number>();
    filteredSkills.forEach((s) => {
      const category = s.category || '未分类';
      let idx = indexMap.get(category);
      if (idx === undefined) {
        idx = groups.length;
        indexMap.set(category, idx);
        groups.push({ category, skills: [] });
      }
      groups[idx].skills.push(s);
    });
    return groups;
  }, [filteredSkills]);

  /** 技能分组展开状态（默认全部展开） */
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /** 点击技能卡片打开详情弹窗 */
  const openSkillDetail = (skill: HermesSkill) => {
    setActiveSkill(skill);
    setSkillModalOpen(true);
  };

  /** 停用/启用技能（阻止冒泡，避免触发卡片点击打开详情） */
  const handleToggleSkill = async (skill: HermesSkill, enabled: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!agentName || !skill.category || !skill.dir_name) return;
    const key = `skill:${skill.category}/${skill.dir_name}`;
    setTogglingKey(key);
    try {
      await hermesAgentService.toggleSkill(agentName, skill.category, skill.dir_name, enabled);
      message.success(`技能「${skill.name}」已${enabled ? '启用' : '停用'}`);
      setSkills((prev) => prev.map((s) => (
        s.category === skill.category && s.dir_name === skill.dir_name
          ? { ...s, status: enabled ? 'enabled' : 'disabled' }
          : s
      )));
    } catch (err: any) {
      message.error(err?.message || '技能状态更新失败');
    } finally {
      setTogglingKey(null);
    }
  };

  /** 删除技能（移除整个技能目录） */
  const handleDeleteSkill = async (skill: HermesSkill, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!agentName || !skill.category || !skill.dir_name) return;
    try {
      await hermesAgentService.deleteSkill(agentName, skill.category, skill.dir_name);
      message.success(`技能「${skill.name}」已删除`);
      setSkills((prev) => prev.filter((s) => !(s.category === skill.category && s.dir_name === skill.dir_name)));
    } catch (err: any) {
      message.error(err?.message || '技能删除失败');
    }
  };

  /** 停用/启用工具集 */
  const handleToggleTool = async (tool: HermesTool, enabled: boolean, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!agentName) return;
    const key = `tool:${tool.name}`;
    setTogglingKey(key);
    try {
      await hermesAgentService.toggleTool(agentName, tool.name, enabled);
      message.success(`工具「${tool.name}」已${enabled ? '启用' : '停用'}`);
      setTools((prev) => prev.map((t) => (t.name === tool.name ? { ...t, enabled } : t)));
    } catch (err: any) {
      message.error(err?.message || '工具状态更新失败');
    } finally {
      setTogglingKey(null);
    }
  };

  /** 新增技能 */
  const handleCreateSkill = async () => {
    if (!agentName) return;
    try {
      const values = await skillForm.validateFields();
      setCreatingSkill(true);
      // 分类为 tags 模式 Select，取第一个值
      const category = Array.isArray(values.category) ? values.category[0] : values.category;
      await hermesAgentService.createSkill(agentName, {
        name: values.name,
        category,
        description: values.description,
      });
      message.success('技能创建成功');
      setSkillCreateOpen(false);
      skillForm.resetFields();
      loadCapabilities();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '技能创建失败');
    } finally {
      setCreatingSkill(false);
    }
  };

  /** 搜索过滤工具栏（技能/工具 tab 共用：关键字搜索 + 启用停用过滤） */
  const renderFilterBar = (
    search: string,
    onSearch: (v: string) => void,
    statusFilter: string,
    onStatusFilter: (v: string) => void,
  ) => (
    <>
      <Input
        allowClear
        prefix={<SearchOutlined style={{ color: secondaryText }} />}
        placeholder="搜索名称或描述"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        style={{ width: 240 }}
      />
      <Select
        value={statusFilter}
        onChange={onStatusFilter}
        style={{ width: 100 }}
        options={[
          { value: 'all', label: '全部' },
          { value: 'enabled', label: '已启用' },
          { value: 'disabled', label: '已停用' },
        ]}
      />
    </>
  );

  /** 渲染技能分组列表（按分类分组，可收起展开，卡片点击打开详情弹窗） */
  const renderSkillGroups = () => {
    return (
      <div>
        {/* 工具栏：新增技能 + 搜索过滤 */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setSkillCreateOpen(true)}>
            新增技能
          </Button>
          {renderFilterBar(skillSearch, setSkillSearch, skillStatusFilter, setSkillStatusFilter)}
        </div>
        {!skills.length ? (
          <Empty description="暂无技能" style={{ marginTop: 40 }} />
        ) : null}
        {!!skills.length && !skillGroups.length ? (
          <Empty description="没有符合条件的技能" style={{ marginTop: 40 }} />
        ) : null}
        {skillGroups.map((group) => {
          const collapsed = collapsedGroups.has(group.category);
          return (
            <div key={group.category} style={{ marginBottom: 16 }}>
              {/* 分组头（可收起展开） */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '8px 4px', userSelect: 'none',
                  color: isDark ? '#e0e0e0' : '#1f2329',
                }}
                onClick={() => setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.category)) next.delete(group.category);
                  else next.add(group.category);
                  return next;
                })}
              >
                {collapsed
                  ? <CaretRightOutlined style={{ fontSize: 12, color: secondaryText }} />
                  : <DownOutlined style={{ fontSize: 12, color: secondaryText }} />}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{group.category}</span>
                <Tag style={{ borderRadius: 10, marginBottom: 0 }}>{group.skills.length}</Tag>
              </div>
              {/* 技能卡片网格 */}
              {!collapsed && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: 12, marginTop: 4,
                }}>
                  {group.skills.map((skill) => {
                    const skillEnabled = skill.status !== 'disabled';
                    const toggleKey = `skill:${group.category}/${skill.dir_name}`;
                    return (
                    <div
                      key={`${group.category}/${skill.dir_name || skill.name}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => openSkillDetail(skill)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openSkillDetail(skill);
                        }
                      }}
                      title={`${skill.name}：${skill.description || '暂无描述'}`}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        /* 停用技能：降透明度 + 虚线灰边框，与启用卡片区分 */
                        background: skillEnabled
                          ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)')
                          : (isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.008)'),
                        border: skillEnabled
                          ? (isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)')
                          : `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'}`,
                        opacity: skillEnabled ? 1 : 0.62,
                        transition: 'border-color 0.2s, background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = isDark ? 'rgba(90, 111, 214, 0.5)' : '#c0c6e8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = skillEnabled
                          ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                          : `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'}`;
                      }}
                    >
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        marginBottom: 6,
                      }}>
                        <div style={{
                          fontSize: 14, fontWeight: 600,
                          color: isDark ? '#ffffff' : '#1f2329',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                        }}>
                          <BookOutlined style={{ color: skillEnabled ? '#5a6fd6' : secondaryText, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{skill.name}</span>
                        </div>
                        {!skillEnabled && (
                          <Tag icon={<StopOutlined />} style={{ borderRadius: 10, marginBottom: 0, flexShrink: 0 }}>已停用</Tag>
                        )}
                      </div>
                      <Tooltip title={skill.description || '暂无描述'}>
                        <div style={{
                          fontSize: 12, color: secondaryText, lineHeight: 1.6, minHeight: 38,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {skill.description || '暂无描述'}
                        </div>
                      </Tooltip>
                      {/* 卡片操作：停用/启用开关 + 删除 */}
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginTop: 10, paddingTop: 8,
                          borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Space size={4}>
                          <Switch
                            size="small"
                            checked={skillEnabled}
                            loading={togglingKey === toggleKey}
                            onChange={(checked, e) => handleToggleSkill(skill, checked, e as any)}
                          />
                          <span style={{ fontSize: 12, color: secondaryText }}>{skillEnabled ? '启用' : '停用'}</span>
                        </Space>
                        <Popconfirm
                          title="确定删除该技能吗？"
                          description="删除后技能目录将被移除，不可恢复"
                          onConfirm={(e) => { e?.stopPropagation(); handleDeleteSkill(skill); }}
                          onCancel={(e) => e?.stopPropagation()}
                          okText="删除"
                          cancelText="取消"
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /** 工具标签页：卡片网格（点击查看详情） */
  const renderToolsTab = () => {
    if (!tools.length) {
      return <Empty description="暂无工具" style={{ marginTop: 60 }} />;
    }
    return (
      <div>
        {/* 工具栏：搜索过滤 + 统计信息 */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {renderFilterBar(toolSearch, setToolSearch, toolStatusFilter, setToolStatusFilter)}
          <span style={{ color: secondaryText, fontSize: 13, flexShrink: 0 }}>
            共 {tools.length} 个工具，点击卡片查看详情
          </span>
        </div>
        {!filteredTools.length ? (
          <Empty description="没有符合条件的工具" style={{ marginTop: 40 }} />
        ) : null}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {filteredTools.map((tool) => {
            const toggleKey = `tool:${tool.name}`;
            return (
            <div
              key={tool.name}
              role="button"
              tabIndex={0}
              onClick={() => setToolDetail(tool)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setToolDetail(tool);
                }
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                cursor: 'pointer',
                /* 停用工具：降透明度 + 虚线灰边框，与启用卡片区分 */
                background: tool.enabled
                  ? (isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)')
                  : (isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.008)'),
                border: tool.enabled
                  ? (isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)')
                  : `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'}`,
                opacity: tool.enabled ? 1 : 0.62,
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = isDark ? 'rgba(90, 111, 214, 0.5)' : '#c0c6e8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = tool.enabled
                  ? (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)')
                  : `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)'}`;
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: isDark ? '#ffffff' : '#1f2329',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
                }}>
                  <ToolOutlined style={{ color: tool.enabled ? '#fa8c16' : secondaryText, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.name}</span>
                </div>
                {!tool.enabled && (
                  <Tag icon={<StopOutlined />} style={{ borderRadius: 10, marginBottom: 0, flexShrink: 0 }}>已停用</Tag>
                )}
              </div>
              <Tooltip title={tool.description || '暂无描述'}>
                <div style={{
                  fontSize: 12, color: secondaryText, lineHeight: 1.6, minHeight: 38,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {tool.description || '暂无描述'}
                </div>
              </Tooltip>
              {/* 卡片操作：停用/启用开关 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 10, paddingTop: 8,
                  borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Space size={4}>
                  <Switch
                    size="small"
                    checked={tool.enabled}
                    loading={togglingKey === toggleKey}
                    onChange={(checked, e) => handleToggleTool(tool, checked, e as any)}
                  />
                  <span style={{ fontSize: 12, color: secondaryText }}>{tool.enabled ? '启用' : '停用'}</span>
                </Space>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  };

  /** 模型库表格列 */
  const llmColumns = [
    { title: '名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '提供方', dataIndex: 'provider', key: 'provider', width: 90 },
    { title: '类型', dataIndex: 'model_type', key: 'model_type', width: 90, render: (t: string) => t ? <Tag>{t}</Tag> : '—' },
    { title: '接口地址', dataIndex: 'endpoint', key: 'endpoint', ellipsis: true, render: (t: string) => t || '—' },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, record: LLMModel) => (
        <Button type="link" size="small" onClick={() => handleSelectModel(record)}>引用</Button>
      ),
    },
  ];

  /** 渲染文件编辑标签页（SOUL / MEMORY / USER） */
  const renderFileTab = (tab: typeof FILE_TABS[number]) => {
    const content = fileContents[tab.file_type] ?? '';
    const dirty = !!fileDirty[tab.file_type];
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: secondaryText, fontSize: 13 }}>{tab.desc}</span>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!dirty}
            onClick={() => handleSave(tab.file_type)}
          >
            保存{dirty ? ' *' : ''}
          </Button>
        </div>
        <div data-color-mode={isDark ? 'dark' : 'light'}>
          <MDEditor
            value={content}
            height={520}
            onChange={(v) => handleContentChange(tab.file_type, v || '')}
            preview="edit"
          />
        </div>
      </div>
    );
  };

  /** 渲染技能标签页 */
  const renderSkillsTab = () => renderSkillGroups();

  /** 渲染模型配置标签页（手动填写或从模型库引用） */
  const renderModelTab = () => (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: secondaryText, fontSize: 13 }}>
          智能体调用的大模型配置（写入 config.yaml），可直接填写或从模型库引用
        </span>
        <Space>
          <Button icon={<CloudDownloadOutlined />} onClick={openModelSelect}>从模型库引用</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={savingModel} onClick={handleSaveModel}>保存</Button>
        </Space>
      </div>
      <Form form={modelForm} layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item
          name="model"
          label={<span>模型名称<Tooltip title="模型 ID，如 Qwen3.8-27B"><EyeOutlined style={{ color: secondaryText, marginLeft: 4 }} /></Tooltip></span>}
          rules={[{ required: true, message: '请输入模型名称' }]}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="如 Qwen3.8-27B" maxLength={128} />
        </Form.Item>
        <Form.Item
          name="api_key"
          label={<span>API Key<Tooltip title="调用模型的密钥；使用本地推理服务时可留空"><EyeOutlined style={{ color: secondaryText, marginLeft: 4 }} /></Tooltip></span>}
          style={{ marginBottom: 12 }}
        >
          <Input.Password placeholder="sk-..." maxLength={512} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="url"
          label={<span>URL<Tooltip title="OpenAI 兼容接口地址，如 http://localhost:8000/v1；留空使用默认地址"><EyeOutlined style={{ color: secondaryText, marginLeft: 4 }} /></Tooltip></span>}
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="http://localhost:8000/v1" maxLength={512} />
        </Form.Item>
      </Form>
    </div>
  );

  /** 渲染统计信息块（图标 + 数值 + 标签） */
  const renderStat = (
    icon: React.ReactNode, value: string, label: string,
    gradient: string, valueSize = 15,
  ) => (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      background: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
      border: isDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.04)',
      display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: gradient, color: '#fff', fontSize: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <Tooltip title={value}>
          <div style={{
            fontSize: valueSize, fontWeight: 600, lineHeight: 1.3,
            color: isDark ? '#ffffff' : '#1f2329',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {value}
          </div>
        </Tooltip>
        <div style={{ fontSize: 12, color: secondaryText, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );

  if (loading && !agent) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="智能体不存在或加载失败">
          <Button type="primary" onClick={() => navigate('/agents')}>返回列表</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={`page-container ${isDark ? 'dark' : 'light'}`} style={{ padding: 24, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', textAlign: 'left' }}>
      {/* 基本信息区（普通容器） */}
      <div style={{ flexShrink: 0, padding: '4px 8px' }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <Tooltip title="点击上传头像">
            <Upload {...avatarUploadProps} maxCount={1} className="avatar-upload">
              <div style={{ position: 'relative', width: 48, height: 48, borderRadius: 12, cursor: 'pointer' }}>
                <img
                  src={avatarPreview || getProviderAvatar(agent.model || 'hermes')}
                  alt={agent.name}
                  onError={(e) => { (e.target as HTMLImageElement).src = getProviderAvatar(agent.model || 'hermes'); }}
                  style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 12,
                  background: 'rgba(0, 0, 0, 0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                }}
                  className="avatar-hover-mask"
                >
                  <UploadOutlined style={{ color: '#fff', fontSize: 16 }} />
                </div>
              </div>
            </Upload>
          </Tooltip>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Space size={10} align="center" wrap>
              <span style={{ fontSize: 17, fontWeight: 700, color: isDark ? '#ffffff' : '#1f2329' }}>
                {agent.name}
              </span>
              {agent.is_default && <Tag icon={<LockOutlined />} color="blue" style={{ borderRadius: 6, marginBottom: 0 }}>默认</Tag>}
              {agent.is_active && <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 6, marginBottom: 0 }}>活跃</Tag>}
            </Space>
            <div style={{ fontSize: 12, color: secondaryText, marginTop: 6 }}>
              {agent.description || '暂无描述'}
            </div>
          </div>
        </div>

        {/* 统计块：模型 / 技能数 / 工具数 / 创建时间 / 更新时间 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
          {renderStat(<RobotOutlined />, agent.model || '未配置', '模型', 'linear-gradient(135deg, #7c6fe0 0%, #5a6fd6 100%)')}
          {renderStat(<AppstoreAddOutlined />, String(agent.skill_count ?? skills.length), '技能数', 'linear-gradient(135deg, #36cfc9 0%, #1890ff 100%)', 20)}
          {renderStat(<ThunderboltOutlined />, String(agent.tool_count ?? tools.length), '工具数', 'linear-gradient(135deg, #ffa940 0%, #fa8c16 100%)', 20)}
          {renderStat(<ClockCircleOutlined />, agent.created_at || '—', '创建时间', 'linear-gradient(135deg, #95de64 0%, #52c41a 100%)', 14)}
          {renderStat(<ClockCircleOutlined />, agent.updated_at || '—', '更新时间', 'linear-gradient(135deg, #ff85c0 0%, #f759ab 100%)', 14)}
        </div>

          <Tooltip title={agent.path}>
            <div style={{ fontSize: 12, color: faintText, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderOpenOutlined />
              <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.path}</code>
            </div>
          </Tooltip>
      </div>

      {/* 分割线 */}
      <div style={{ height: 1, flexShrink: 0, background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e8eaed' }} />

      {/* 内容标签页（配置区域，可竖向滚动） */}
      <div className="detail-tabs-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            ...FILE_TABS.map((tab) => ({
              key: tab.key,
              label: <span><span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}</span>,
              children: renderFileTab(tab),
            })),
            {
              key: 'skills',
              label: <span><BookOutlined style={{ marginRight: 6 }} />技能</span>,
              children: renderSkillsTab(),
            },
            {
              key: 'tools',
              label: <span><ToolOutlined style={{ marginRight: 6 }} />工具</span>,
              children: renderToolsTab(),
            },
            {
              key: 'model',
              label: <span><SettingOutlined style={{ marginRight: 6 }} />模型配置</span>,
              children: renderModelTab(),
            },
          ]}
        />
      </div>

      {/* 技能详情弹窗（左侧目录树，右侧文件内容） */}
      <SkillDetailModal
        open={skillModalOpen}
        onClose={() => setSkillModalOpen(false)}
        agentName={agentName}
        skill={activeSkill}
        isDark={isDark}
        onChanged={() => loadCapabilities()}
      />

      {/* 新增技能弹窗（创建 skills/<category>/<name>/SKILL.md） */}
      <Modal
        title={<span><BookOutlined style={{ marginRight: 8, color: '#5a6fd6' }} />新增技能</span>}
        open={skillCreateOpen}
        onCancel={() => {
          setSkillCreateOpen(false);
          skillForm.resetFields();
        }}
        onOk={handleCreateSkill}
        confirmLoading={creatingSkill}
        okText="创建"
        cancelText="取消"
        width={520}
        destroyOnClose
      >
        <Form form={skillForm} layout="vertical" preserve={false} style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="技能名称"
            rules={[
              { required: true, message: '请输入技能名称' },
              { pattern: /^[a-z0-9][a-z0-9._-]*$/, message: '仅支持小写字母、数字、点、下划线、连字符，且以字母或数字开头' },
            ]}
          >
            <Input placeholder="如 pdf-exporter" maxLength={64} allowClear />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[
              { required: true, type: 'array', message: '请输入技能分类' },
              {
                validator: async (rule, value: string[]) => {
                  const v = Array.isArray(value) ? value[0] : value;
                  if (v && !/^[a-z0-9][a-z0-9._-]*$/.test(v)) {
                    throw new Error('分类仅支持小写字母、数字、点、下划线、连字符');
                  }
                },
              },
            ]}
          >
            <Select
              mode="tags"
              maxCount={1}
              placeholder="选择已有分类或输入新分类，如 custom"
              options={[{ value: 'custom', label: 'custom' }, ...skillGroups.map((g) => ({ value: g.category, label: g.category }))]}
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ required: true, message: '请输入技能描述' }]}
          >
            <Input.TextArea
              placeholder="简要描述技能的用途，如：将对话内容导出为 PDF 文件"
              maxLength={500}
              showCount
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 工具详情弹窗（名称、描述、所需参数等） */}
      <Modal
        title={<span><ToolOutlined style={{ marginRight: 8, color: '#fa8c16' }} />工具详情</span>}
        open={!!toolDetail}
        onCancel={() => setToolDetail(null)}
        footer={null}
        width={560}
        destroyOnClose
      >
        {toolDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: secondaryText, marginBottom: 4 }}>名称</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#ffffff' : '#1f2329' }}>{toolDetail.name}</code>
                {toolDetail.enabled ? <Tag color="success" style={{ borderRadius: 10 }}>启用</Tag> : <Tag color="default" style={{ borderRadius: 10 }}>禁用</Tag>}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: secondaryText, marginBottom: 4 }}>描述</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: isDark ? '#e0e0e0' : '#333' }}>
                {toolDetail.description || '暂无描述'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: secondaryText, marginBottom: 4 }}>所需参数（子工具）</div>
              {toolDetail.sub_tools ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {toolDetail.sub_tools.split(',').map((s) => s.trim()).filter(Boolean).map((param) => (
                    <Tag key={param} style={{ borderRadius: 6 }}><code>{param}</code></Tag>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: secondaryText }}>无</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 模型库引用弹窗 */}
      <Modal
        title="从模型库引用模型"
        open={modelSelectOpen}
        onCancel={() => setModelSelectOpen(false)}
        footer={null}
        width={760}
        destroyOnClose
      >
        <Input
          placeholder="搜索模型名称"
          prefix={<SearchOutlined />}
          value={llmSearch}
          onChange={(e) => setLlmSearch(e.target.value)}
          onPressEnter={handleLlmSearch}
          style={{ marginBottom: 12 }}
          allowClear
        />
        <Table
          rowKey="id"
          size="small"
          loading={llmLoading}
          columns={llmColumns}
          dataSource={llmModels}
          pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 个模型` }}
          locale={{ emptyText: <Empty description="暂无模型" /> }}
        />
      </Modal>
    </div>
  );
};

export default HermesAgentDetail;
