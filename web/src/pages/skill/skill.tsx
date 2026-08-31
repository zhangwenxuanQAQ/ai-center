import React, { useState, useEffect } from 'react';
import {
  Layout, Tree, Card, Row, Col, Empty, Spin, Button, Modal, Form, Input, Select,
  Switch, message, Popconfirm, Pagination, Upload, Dropdown, Divider, Space, Tag,
} from 'antd';
import type { UploadProps, TreeDataNode, TreeProps } from 'antd';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  UploadOutlined, FolderOpenOutlined, FileTextOutlined, FolderOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FolderAddOutlined,
  FileOutlined, InboxOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import {
  skillService, SkillCategory, Skill,
} from '../../services/skill';
import SkillFileDrawer from './skill_file_drawer';
import '../../styles/common.css';
import './skill.less';

const { Sider: LeftSider, Content } = Layout;

/** 压缩图片为base64（参考chatbot页面） */
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

/** 头像上传组件：配合Form.Item的value/onChange注入（参考chatbot页面） */
const AvatarUpload: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
    {value && (
      <>
        <img
          src={value}
          alt="头像预览"
          style={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #d9d9d9',
          }}
        />
        <Button icon={<DeleteOutlined />} danger size="small" onClick={() => onChange?.('')}>清空</Button>
      </>
    )}
    <Upload
      accept="image/*"
      showUploadList={false}
      maxCount={1}
      beforeUpload={(file) => {
        const isImage = file.type.startsWith('image/');
        if (!isImage) {
          message.error('只能上传图片文件！');
          return Upload.LIST_IGNORE;
        }
        const isLt5M = file.size / 1024 / 1024 < 5;
        if (!isLt5M) {
          message.error('图片大小不能超过 5MB！');
          return Upload.LIST_IGNORE;
        }
        return true;
      }}
      customRequest={async ({ file, onSuccess }) => {
        try {
          const base64 = await compressImage(file as File, 200, 0.7);
          onChange?.(base64);
          message.success('头像上传成功');
          onSuccess && onSuccess(null);
        } catch {
          message.error('头像处理失败');
        }
      }}
    >
      <Button icon={<UploadOutlined />}>点击上传</Button>
    </Upload>
  </div>
);

interface SkillManagementProps {
  theme: 'light' | 'dark';
}

const SkillManagement: React.FC<SkillManagementProps> = ({ theme }) => {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(['all']);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<boolean | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalSkills, setTotalSkills] = useState(0);

  // 技能弹窗
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [skillModalMode, setSkillModalMode] = useState<'create' | 'edit'>('create');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillForm] = Form.useForm();

  // 上传弹窗
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadForm] = Form.useForm();
  const [uploadDirectory, setUploadDirectory] = useState('');
  const [uploading, setUploading] = useState(false);

  // 分类弹窗
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalMode, setCatModalMode] = useState<'create' | 'edit'>('create');
  const [editingCat, setEditingCat] = useState<SkillCategory | null>(null);
  const [catForm] = Form.useForm();

  // 文件抽屉
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false);
  const [drawerSkill, setDrawerSkill] = useState<Skill | null>(null);

  useEffect(() => { fetchCategories(); }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchSkills(1, pageSize);
  }, [selectedCategory, searchName, filterStatus]);

  useEffect(() => { fetchSkills(currentPage, pageSize); }, [currentPage, pageSize]);

  const getAllCategoryKeys = (cats: SkillCategory[]): string[] => {
    let keys: string[] = [];
    cats.forEach(c => {
      keys.push(`category-${c.id}`);
      if (c.children && c.children.length > 0) {
        keys = keys.concat(getAllCategoryKeys(c.children));
      }
    });
    return keys;
  };

  const fetchCategories = async () => {
    try {
      const data = await skillService.getCategoryTree();
      setCategories(data);
      setExpandedKeys(getAllCategoryKeys(data));
    } catch (e) { console.error(e); }
  };

  const getFlatCategoryOptions = (cats: SkillCategory[] | undefined, depth = 0): any[] => {
    let options: any[] = [];
    (cats || []).forEach(c => {
      options.push({ value: c.id, label: `${'  '.repeat(depth)}${c.name}` });
      if (c.children && c.children.length > 0) {
        options = options.concat(getFlatCategoryOptions(c.children, depth + 1));
      }
    });
    return options;
  };

  const buildTreeData = (): TreeDataNode[] => {
    const allNode: TreeDataNode = {
      title: <div className="category-tree-node" style={{ cursor: 'pointer' }}><div className="category-name">全部</div></div>,
      key: 'all',
    };
    const buildCategoryNode = (cat: SkillCategory): TreeDataNode => ({
      title: (
        <div className="category-tree-node" style={{ cursor: 'pointer' }}>
          <div className="category-name" title={cat.name}>{cat.name}</div>
          <div className="category-actions">
            <Button type="text" icon={<PlusOutlined />} size="small" title="新建子分类"
              onClick={(e) => { e.stopPropagation(); openCatModal('create', { parent_id: cat.id }); }} />
            <Button type="text" icon={<EditOutlined />} size="small" title="编辑"
              onClick={(e) => { e.stopPropagation(); openCatModal('edit', cat); }} />
            {!cat.is_default && (
              <Popconfirm title="确认删除" description="删除分类及子分类？"
                onConfirm={(e) => { e?.stopPropagation(); handleDeleteCategory(cat.id); }}
                okText="确认" cancelText="取消">
                <Button type="text" icon={<DeleteOutlined />} size="small" danger title="删除"
                  className="delete-category-btn" onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            )}
          </div>
        </div>
      ),
      key: `category-${cat.id}`,
      icon: cat.is_default ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: cat.children && cat.children.length > 0 ? cat.children.map(child => buildCategoryNode(child)) : undefined,
    });
    return [allNode, ...categories.map(c => buildCategoryNode(c))];
  };

  const handleTreeSelect: TreeProps['onSelect'] = (keys) => {
    if (keys.length === 0) return;
    const key = keys[0] as string;
    setSelectedKeys(keys as string[]);
    if (key === 'all') setSelectedCategory(null);
    else if (key.startsWith('category-')) setSelectedCategory(key.replace('category-', ''));
  };

  const handleTreeExpand: TreeProps['onExpand'] = (keys) => {
    setExpandedKeys(keys as string[]);
  };

  const openCatModal = (mode: 'create' | 'edit', data?: any) => {
    setCatModalMode(mode);
    if (mode === 'edit') {
      setEditingCat(data);
      catForm.setFieldsValue({
        name: data.name, description: data.description,
        parent_id: data.parent_id || null, sort_order: data.sort_order ?? 0,
      });
    } else {
      setEditingCat(null);
      catForm.setFieldsValue({
        name: '', description: '',
        parent_id: data && data.parent_id ? data.parent_id : null, sort_order: 0,
      });
    }
    setCatModalOpen(true);
  };

  const handleCategorySubmit = async () => {
    try {
      const values = await catForm.validateFields();
      if (catModalMode === 'create') {
        await skillService.createCategory(values);
        message.success('分类创建成功');
      } else if (editingCat) {
        await skillService.updateCategory(editingCat.id, values);
        message.success('分类更新成功');
      }
      setCatModalOpen(false);
      catForm.resetFields();
      fetchCategories();
    } catch (e: any) {
      message.error(e && e.message || '操作失败');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await skillService.deleteCategory(id);
      message.success('分类删除成功');
      fetchCategories();
    } catch (e: any) {
      message.error(e && e.message || '删除失败');
    }
  };

  const fetchSkills = async (page?: number, size?: number) => {
    setLoading(true);
    try {
      const data = await skillService.getSkills(
        page ?? currentPage, size ?? pageSize,
        {
          category_id: selectedCategory || undefined,
          keyword: searchName || undefined,
          status: filterStatus ?? undefined,
        }
      );
      setSkills(data.data);
      setTotalSkills(data.total);
    } catch (e: any) {
      console.error(e);
      message.error(e && e.message || '获取技能列表失败');
    } finally { setLoading(false); }
  };

  const triggerSearch = () => {
    setCurrentPage(1);
    fetchSkills(1, pageSize);
  };

  const openSkillModal = (mode: 'create' | 'edit', skill?: Skill) => {
    setSkillModalMode(mode);
    if (mode === 'edit' && skill) {
      setEditingSkill(skill);
      skillForm.setFieldsValue({
        name: skill.name, title: skill.title, description: skill.description,
        tags: skill.tags || [], avatar: skill.avatar,
        content: skill.content || skill.skill_md_content || '',
        metadata: Object.entries(skill.metadata || {}).map(([key, value]) => ({ key, value })),
      });
    } else {
      setEditingSkill(null);
      skillForm.setFieldsValue({
        name: '', title: '', description: '', tags: [], avatar: '', content: '', metadata: [],
      });
    }
    setSkillModalOpen(true);
  };

  /** 将Form.List的元数据数组转换为对象 */
  const convertMetadata = (metadata: any) => {
    if (!Array.isArray(metadata)) return metadata || undefined;
    const entries = metadata.filter((m: any) => m && m.key).map((m: any) => [m.key, m.value ?? '']);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const handleSkillSubmit = async () => {
    try {
      const values = await skillForm.validateFields();
      values.metadata = convertMetadata(values.metadata);
      // 名称不能有空格
      if (values.name && /\s/.test(values.name)) {
        message.error('技能名称不能包含空格');
        return;
      }
      if (skillModalMode === 'create') {
        await skillService.createSkill(values);
        message.success('技能创建成功');
      } else if (editingSkill) {
        await skillService.updateSkill(editingSkill.id, values);
        message.success('技能更新成功');
      }
      setSkillModalOpen(false);
      skillForm.resetFields();
      fetchSkills();
    } catch (e: any) {
      message.error(e && e.message || '操作失败');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await skillService.deleteSkill(id);
      message.success('技能删除成功');
      fetchSkills();
    } catch (e: any) {
      message.error(e && e.message || '删除失败');
    }
  };

  const openUploadModal = async () => {
    try {
      const result = await skillService.prepareUpload();
      setUploadDirectory(result.directory);
      uploadForm.setFieldsValue({
        name: '', title: '', description: '', tags: [], avatar: '', content: '', metadata: [],
      });
      setUploadModalOpen(true);
    } catch (e: any) {
      message.error(e && e.message || '准备上传失败');
    }
  };

  const zipUploadProps: UploadProps = {
    name: 'file', multiple: false,
    accept: '.zip,.tar,.tar.gz,.tgz,.tar.bz2',
    beforeUpload: async (file) => {
      if (!uploadDirectory) { message.error('未准备上传目录'); return Upload.LIST_IGNORE; }
      setUploading(true);
      try {
        await skillService.uploadZip(uploadDirectory, file);
        message.success('压缩包解压上传成功');
      } catch (e: any) {
        message.error(e && e.message || '上传失败');
      } finally { setUploading(false); }
      return false;
    },
    fileList: [],
  };

  const multiUploadProps: UploadProps = {
    name: 'files', multiple: true,
    beforeUpload: async () => false,
    customRequest: async (opts: any) => {
      if (!uploadDirectory) { message.error('未准备上传目录'); return; }
      setUploading(true);
      try {
        await skillService.uploadFile(uploadDirectory, opts.file as File);
        opts.onSuccess && opts.onSuccess(null);
        message.success(`${opts.file.name} 上传成功`);
      } catch (e: any) {
        opts.onError && opts.onError(e);
        message.error(e && e.message || '上传失败');
      } finally { setUploading(false); }
    },
    fileList: [],
  };

  const handleUploadConfirm = async () => {
    try {
      const values = await uploadForm.validateFields();
      if (values.name && /\s/.test(values.name)) {
        message.error('技能名称不能包含空格');
        return;
      }
      values.metadata = convertMetadata(values.metadata);
      await skillService.createAndRegister({ ...values, directory: uploadDirectory });
      message.success('技能创建成功');
      setUploadModalOpen(false);
      uploadForm.resetFields();
      setUploadDirectory('');
      fetchSkills();
    } catch (e: any) {
      message.error(e && e.message || '创建失败');
    }
  };

  const openFileDrawer = (skill: Skill) => {
    setDrawerSkill(skill);
    setFileDrawerOpen(true);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  /** 技能配置项表单（公共渲染，供新建/编辑弹窗和上传弹窗复用） */
  const renderSkillFields = (mdHeight: number) => (
    <>
      <Form.Item label="名称" name="name"
        rules={[
          { required: true, message: '请输入名称' },
          { pattern: /^\S+$/, message: '名称不能包含空格' },
        ]}>
        <Input placeholder="为技能填写名称，将作为技能所属目录名称" />
      </Form.Item>
      <Form.Item label="描述" name="description" rules={[{ required: true, message: '请输入描述' }]}>
        <TextArea rows={2} placeholder="技能是什么，应该在何时使用。" />
      </Form.Item>
      <Form.Item label="标题" name="title">
        <Input placeholder="请输入技能标题" />
      </Form.Item>
      <Form.Item label="内容" name="content">
        <MDEditor height={mdHeight} preview="edit" textareaProps={{ placeholder: '请详细填写技能指令' }} />
      </Form.Item>
      <Form.Item label="标签" name="tags">
        <Select mode="tags" placeholder="输入标签后按回车" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item label="头像" name="avatar">
        <AvatarUpload />
      </Form.Item>
      <Form.Item label="元数据">
        <Form.List name="metadata">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                  <Col span={10}>
                    <Form.Item {...restField} name={[name, 'key']} noStyle>
                      <Input placeholder="参数名" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item {...restField} name={[name, 'value']} noStyle>
                      <Input placeholder="参数值" />
                    </Form.Item>
                  </Col>
                  <Col span={2} style={{ textAlign: 'center' }}>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Col>
                </Row>
              ))}
              <Form.Item noStyle>
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} style={{ width: '100%' }}>
                  添加
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form.Item>
      <Form.Item label="所属分类" name="category_id">
        <Select placeholder="请选择分类" allowClear>
          {getFlatCategoryOptions(categories).map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
        </Select>
      </Form.Item>
      <Form.Item label="状态" name="status" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="停用" />
      </Form.Item>
    </>
  );

  return (
    <>
      <LeftSider width={260} className={`category-sider ${theme === 'dark' ? 'dark' : 'light'}`}>
        <div className={`sider-header ${theme === 'dark' ? 'dark' : 'light'}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>技能分类</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCatModal('create')} size="small"
            style={{ background: 'linear-gradient(135deg, #5a6fd6 0%, #8a9eef 100%)', border: 'none', borderRadius: '12px', padding: '0 12px', height: '28px', fontSize: '12px' }}>
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

      <Content className={`toolkit-content ${theme === 'dark' ? 'dark' : 'light'}`}
        style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '16px 24px', boxSizing: 'border-box' }}>
        {/* 工具栏 */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center', padding: 16 }}>
          <Dropdown menu={{
            items: [
              { key: 'manual', icon: <PlusOutlined />, label: '手动新建技能', onClick: () => openSkillModal('create') },
              { key: 'upload', icon: <UploadOutlined />, label: '上传文件/文件夹新建', onClick: openUploadModal },
            ]
          }}>
            <Button type="primary" icon={<PlusOutlined />}
              style={{ background: 'linear-gradient(135deg, #5a6fd6 0%, #8a9eef 100%)', border: 'none', borderRadius: '18px', padding: '0 20px', height: '36px' }}>
              新建技能
            </Button>
          </Dropdown>
          <Input
            placeholder="搜索技能名称"
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
          <Select
            placeholder="请选择状态"
            value={filterStatus === null ? undefined : filterStatus}
            onChange={(v) => setFilterStatus(v === undefined ? null : v)}
            allowClear
            style={{ width: 120, height: '36px' }}
          >
            <Option value={true}>启用</Option>
            <Option value={false}>停用</Option>
          </Select>
        </div>

        {/* 技能列表 */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '0', scrollbarWidth: 'none', msOverflowStyle: 'none', padding: '0 16px' }} className="hide-scrollbar">
          <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
          {loading ? (
            <div className="loading-container"><Spin size="large" /></div>
          ) : skills.length === 0 ? (
            <Empty description="暂无技能" className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
          ) : (
            <Row gutter={[16, 16]}>
              {skills.map((s, index) => (
                <Col key={s.id} xs={24} sm={12} md={8} lg={6}
                  style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'both' }}>
                  <Card hoverable className={`mcp-card ${theme === 'dark' ? 'dark' : 'light'}`}
                    bodyStyle={{ padding: '16px' }}>
                    {/* 头部：图标 + 名称 + 状态 */}
                    <div className="card-header">
                      <div className="card-icon" style={{ background: 'linear-gradient(135deg, #5a6fd6 0%, #8a9eef 100%)' }}>
                        {s.avatar ? (
                          <img src={s.avatar} alt={s.name} style={{ width: '52px', height: '52px', borderRadius: '14px', objectFit: 'cover' }} />
                        ) : (
                          <FileTextOutlined style={{ fontSize: '24px', color: '#fff' }} />
                        )}
                      </div>
                      <div className="card-info">
                        <div className="card-title">{s.title || s.name}</div>
                        <div className="card-subtitle">{s.name}</div>
                      </div>
                      <Switch size="small" checked={!!s.status} checkedChildren="启用" unCheckedChildren="停用"
                        onChange={checked => {
                          skillService.updateSkill(s.id, { status: checked })
                            .then(() => { message.success('状态更新成功'); fetchSkills(); })
                            .catch(e => message.error(e && e.message || '更新失败'));
                        }} />
                    </div>
                    {/* 标签 */}
                    <div className="card-tags">
                      <span className="card-tag">{s.category_name || '未分类'}</span>
                      <span className="card-tag"
                        style={{
                          background: s.status ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)',
                          color: s.status ? '#52c41a' : '#ff4d4f',
                          borderColor: s.status ? 'rgba(82, 196, 26, 0.3)' : 'rgba(255, 77, 79, 0.3)',
                        }}>
                        {s.status ? '启用' : '停用'}
                      </span>
                      {s.tags && s.tags.map((t, i) => (
                        <Tag key={i} style={{ fontSize: 11 }}>{t}</Tag>
                      ))}
                    </div>
                    {/* 描述 */}
                    {s.description && <div className="card-desc">{s.description}</div>}
                    {/* 底部：创建时间 + 操作按钮 */}
                    <div className="card-footer">
                      <div className="card-time">
                        <CheckCircleOutlined /> 创建: {formatDate(s.created_at)}
                      </div>
                      <div className="card-actions-bottom">
                        <Button icon={<EditOutlined />} onClick={() => openSkillModal('edit', s)}
                          className="action-btn edit" title="编辑"><span>编辑</span></Button>
                        <Button icon={<FolderOpenOutlined />} onClick={() => openFileDrawer(s)}
                          className="action-btn" title="查看文件目录"><span>文件目录</span></Button>
                        <Popconfirm title="确认删除" description="删除技能记录及对应文件目录？"
                          onConfirm={() => handleDeleteSkill(s.id)} okText="删除" cancelText="取消" okType="danger">
                          <Button icon={<DeleteOutlined />} danger className="action-btn delete" title="删除"><span>删除</span></Button>
                        </Popconfirm>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>

        {/* 分页 */}
        {totalSkills > 0 && (
          <div style={{ paddingTop: '24px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={totalSkills}
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

      {/* 手动新建/编辑技能弹窗 */}
      <Modal title={skillModalMode === 'create' ? '手动新建技能' : '编辑技能'}
        open={skillModalOpen} onCancel={() => { setSkillModalOpen(false); skillForm.resetFields(); }}
        onOk={handleSkillSubmit} okText="确定" cancelText="取消" destroyOnClose maskClosable={false}
        width={720} style={{ top: 20 }}>
        <Form form={skillForm} layout="vertical" style={{ marginTop: 8 }}>
          {renderSkillFields(300)}
        </Form>
      </Modal>

      {/* 上传新建技能弹窗 */}
      <Modal title="上传文件/文件夹新建技能" open={uploadModalOpen}
        onCancel={() => { setUploadModalOpen(false); uploadForm.resetFields(); setUploadDirectory(''); }}
        onOk={handleUploadConfirm} okText="创建技能" cancelText="取消"
        destroyOnClose maskClosable={false} width={720} style={{ top: 20 }} confirmLoading={uploading}>
        <Form form={uploadForm} layout="vertical">
          {renderSkillFields(200)}
        </Form>
        <Divider orientation="left">上传内容</Divider>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Dragger {...zipUploadProps} style={{ padding: '16px' }}>
            <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: '#5a6fd6' }} /></p>
            <p className="ant-upload-text">点击或拖拽 压缩包 到此处上传</p>
            <p className="ant-upload-hint" style={{ fontSize: 12 }}>支持 zip/tar/tar.gz/tar.bz2，自动解压到技能目录</p>
          </Dragger>
          <Upload {...multiUploadProps}><Button icon={<UploadOutlined />} loading={uploading}>或选择多文件单独上传</Button></Upload>
          <div style={{ fontSize: 12, opacity: 0.7 }}>目录ID: <code>{uploadDirectory}</code>。若缺少SKILL.md将自动生成模板。</div>
        </Space>
      </Modal>

      {/* 分类弹窗 */}
      <Modal title={catModalMode === 'create' ? '新建分类' : '编辑分类'}
        open={catModalOpen} onCancel={() => { setCatModalOpen(false); catForm.resetFields(); }}
        onOk={handleCategorySubmit} okText="确定" cancelText="取消" destroyOnClose maskClosable={false}>
        <Form form={catForm} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="分类名称" name="name" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item>
          <Form.Item label="上级分类" name="parent_id">
            <Select placeholder="顶级分类" allowClear>
              {getFlatCategoryOptions(categories).filter(o => !editingCat || o.value !== editingCat.id)
                .map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="排序序号" name="sort_order"><Input type="number" /></Form.Item>
          <Form.Item label="描述" name="description"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 文件目录抽屉（独立组件） */}
      <SkillFileDrawer
        skill={drawerSkill}
        open={fileDrawerOpen}
        onClose={() => { setFileDrawerOpen(false); setDrawerSkill(null); }}
        onEditSkill={(s) => { setFileDrawerOpen(false); setDrawerSkill(null); openSkillModal('edit', s); }}
        theme={theme}
      />
    </>
  );
};

export default SkillManagement;
