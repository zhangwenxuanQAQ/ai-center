import React, { useState, useEffect } from 'react';
import {
  Drawer, Button, Input, Space, Tooltip, Upload, Spin, Empty,
  Modal, Form, message, Popconfirm,
} from 'antd';
import type { UploadProps } from 'antd';
const { TextArea } = Input;
import {
  FolderOpenOutlined, FileOutlined, FolderOutlined,
  UploadOutlined, FolderAddOutlined, ReloadOutlined,
  ArrowLeftOutlined, SaveOutlined, DeleteOutlined,
  FileMarkdownOutlined, FileTextOutlined, FileImageOutlined,
  FilePdfOutlined, FileZipOutlined, FileExclamationOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  skillService, Skill, FileNode, FileContent,
} from '../../services/skill';
import './skill.less';

interface SkillFileDrawerProps {
  skill: Skill | null;
  open: boolean;
  onClose: () => void;
  onEditSkill?: (skill: Skill) => void;
  theme: 'light' | 'dark';
  getContainer?: HTMLElement | null;
}

const SkillFileDrawer: React.FC<SkillFileDrawerProps> = ({
  skill, open, onClose, onEditSkill, theme, getContainer,
}) => {
  const [fileList, setFileList] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingFile, setEditingFile] = useState<FileContent | null>(null);
  const [fileEditSaving, setFileEditSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSearchKeyword, setFileSearchKeyword] = useState('');
  const [filePage, setFilePage] = useState(1);
  const FILE_PAGE_SIZE = 10;

  useEffect(() => {
    if (open && skill) {
      setCurrentPath('');
      setPathHistory(['']);
      setHistoryIndex(0);
      setEditingFile(null);
      setFileSearchKeyword('');
      setFilePage(1);
      loadFileList(skill.id, '');
    }
  }, [open, skill]);

  const loadFileList = async (skillId: string, subPath: string) => {
    setFileLoading(true);
    try {
      const data = await skillService.listFiles(skillId, subPath || undefined);
      setFileList(data || []);
    } catch (e: any) {
      message.error(e && e.message || '加载文件列表失败');
    } finally { setFileLoading(false); }
  };

  const navigatePath = (targetPath: string) => {
    if (!skill) return;
    const newHistory = pathHistory.slice(0, historyIndex + 1);
    newHistory.push(targetPath);
    setPathHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPath(targetPath);
    setEditingFile(null);
    loadFileList(skill.id, targetPath);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const target = pathHistory[newIndex];
      setCurrentPath(target);
      setEditingFile(null);
      if (skill) loadFileList(skill.id, target);
    }
  };

  const handleFileItemClick = async (item: FileNode) => {
    if (!skill) return;
    if (item.is_dir) {
      navigatePath(item.path);
    } else {
      try {
        const content = await skillService.getFileContent(skill.id, item.path);
        setEditingFile(content);
      } catch (e: any) { message.error(e && e.message || '读取文件失败'); }
    }
  };

  const handleDeleteFileItem = (item: FileNode) => {
    if (!skill) return;
    Modal.confirm({
      title: `确认删除 ${item.is_dir ? '文件夹' : '文件'}?`,
      content: `将删除 ${item.name}，此操作不可恢复`,
      okType: 'danger',
      onOk: async () => {
        try {
          await skillService.deleteFileOrDir(skill.id, item.path);
          message.success('删除成功');
          loadFileList(skill.id, currentPath);
          if (editingFile && editingFile.path === item.path) setEditingFile(null);
        } catch (e: any) { message.error(e && e.message || '删除失败'); return Promise.reject(); }
      }
    });
  };

  const handleSaveFile = async () => {
    if (!skill || !editingFile) return;
    setFileEditSaving(true);
    try {
      await skillService.writeFileContent(skill.id, editingFile.path, editingFile.content);
      message.success('文件保存成功');
    } catch (e: any) { message.error(e && e.message || '保存失败'); }
    finally { setFileEditSaving(false); }
  };

  const handleCreateFolder = () => {
    if (!skill) return;
    Modal.confirm({
      title: '新建文件夹',
      content: (
        <Form layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item label="文件夹名称" name="dir_name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input id="new-dir-name" placeholder="请输入文件夹名称" autoFocus />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const input = document.getElementById('new-dir-name') as HTMLInputElement;
        const name = input && input.value ? input.value.trim() : '';
        if (!name) { message.error('请输入文件夹名称'); return Promise.reject(); }
        try {
          await skillService.createDirectory(skill.id, currentPath, name);
          message.success('文件夹创建成功');
          loadFileList(skill.id, currentPath);
        } catch (e: any) { message.error(e && e.message || '创建失败'); return Promise.reject(); }
      }
    });
  };

  const fileDrawerUpload: UploadProps = {
    name: 'files', multiple: true,
    beforeUpload: () => false,
    customRequest: async (opts: any) => {
      if (!skill) return;
      try {
        const { directory } = await skillService.prepareUpload(skill.id);
        await skillService.uploadFile(directory, opts.file as File, currentPath || undefined);
        opts.onSuccess && opts.onSuccess(null);
        message.success(`${opts.file.name} 上传成功`);
        loadFileList(skill.id, currentPath);
      } catch (e: any) {
        opts.onError && opts.onError(e);
        message.error(e && e.message || '上传失败');
      }
    },
    fileList: [],
  };

  const renderBreadcrumb = () => {
    const parts = currentPath ? currentPath.split('/').filter(Boolean) : [];
    const items: JSX.Element[] = [
      <span key="root" className="breadcrumb-item" onClick={() => navigatePath('')}>根目录</span>
    ];
    let acc = '';
    parts.forEach(p => {
      acc = acc ? `${acc}/${p}` : p;
      const idx = acc;
      items.push(<span key={'sep' + idx} className="breadcrumb-sep">/</span>);
      items.push(<span key={'it' + idx} className="breadcrumb-item" onClick={() => navigatePath(idx)}>{p}</span>);
    });
    return items;
  };

  const renderFileIcon = (item: FileNode): { icon: JSX.Element; bg: string } => {
    if (item.is_dir) {
      return { icon: <FolderOpenOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #faad14 0%, #ffc53d 100%)' };
    }
    const ext = (item.name.split('.').pop() || '').toLowerCase();
    const map: Record<string, { icon: JSX.Element; bg: string }> = {
      md: { icon: <FileMarkdownOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #5a6fd6 0%, #8a9eef 100%)' },
      markdown: { icon: <FileMarkdownOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #5a6fd6 0%, #8a9eef 100%)' },
      txt: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)' },
      json: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #fa8c16 0%, #ffc069 100%)' },
      yaml: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)' },
      yml: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #eb2f96 0%, #ff85c0 100%)' },
      py: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)' },
      js: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #fadb14 0%, #fff566 100%)' },
      ts: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #2f54eb 0%, #85a5ff 100%)' },
      html: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)' },
      css: { icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #722ed1 0%, #b37feb 100%)' },
      pdf: { icon: <FilePdfOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)' },
      zip: { icon: <FileZipOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #faad14 0%, #ffd666 100%)' },
      tar: { icon: <FileZipOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #faad14 0%, #ffd666 100%)' },
      gz: { icon: <FileZipOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #faad14 0%, #ffd666 100%)' },
      png: { icon: <FileImageOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' },
      jpg: { icon: <FileImageOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' },
      jpeg: { icon: <FileImageOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' },
      gif: { icon: <FileImageOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' },
      webp: { icon: <FileImageOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)' },
    };
    return map[ext] || { icon: <FileExclamationOutlined style={{ fontSize: 22, color: '#fff' }} />, bg: 'linear-gradient(135deg, #8c8c8c 0%, #bfbfbf 100%)' };
  };

  const formatFileSize = (size?: number | null): string => {
    if (size === undefined || size === null) return '';
    if (size < 1024) return size + ' B';
    if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
    return (size / 1048576).toFixed(2) + ' MB';
  };

  // 过滤 + 分页后的可见文件（目录在前、按名称升序由后端保证）
  const visibleFiles = (() => {
    if (!fileSearchKeyword) return fileList;
    const kw = fileSearchKeyword.toLowerCase();
    return fileList.filter(f => f.name.toLowerCase().includes(kw));
  })();
  const fileTotalPage = Math.max(1, Math.ceil(visibleFiles.length / FILE_PAGE_SIZE));
  const safePage = Math.min(filePage, fileTotalPage);
  const pagedFiles = visibleFiles.slice((safePage - 1) * FILE_PAGE_SIZE, safePage * FILE_PAGE_SIZE);

  const renderFileList = () => {
    if (fileLoading) {
      return <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin size="large" /></div>;
    }
    if (fileList.length === 0) {
      return <Empty description={fileSearchKeyword ? '未找到匹配的文件或目录' : '暂无文件'} />;
    }
    return (
      <div>
        {/* 文件列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {pagedFiles.map(item => {
            const isDir = !!item.is_dir;
            return (
              <div
                key={item.path}
                onClick={() => handleFileItemClick(item)}
                style={{
                  padding: 12,
                  borderRadius: 4,
                  background: isDir
                    ? (theme === 'dark' ? 'rgba(102,126,234,0.1)' : 'rgba(102,126,234,0.05)')
                    : (theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff'),
                  border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'none';
                }}
              >
                {isDir
                  ? <FolderOutlined style={{ color: 'var(--primary-color)', fontSize: 18 }} />
                  : <FileOutlined style={{ color: theme === 'dark' ? '#8a9eef' : '#5a6fd6', fontSize: 18 }} />}
                <span style={{
                  flex: 1,
                  color: theme === 'dark' ? '#e0e0e0' : '#333',
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }} title={item.name}>
                  {item.name}
                </span>
                <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                  {isDir ? '文件夹' : formatFileSize(item.size)}
                </span>
                <Popconfirm
                  title={`确认删除 ${item.name}?`}
                  onConfirm={(e) => { e?.stopPropagation(); handleDeleteFileItem(item); }}
                  onCancel={(e) => e?.stopPropagation()}
                  okText="删除" cancelText="取消" okType="danger"
                >
                  <Button type="text" size="small" danger icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              </div>
            );
          })}
          {/* 分页 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px dashed ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#d9d9d9'}`,
          }}>
            <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>共 {visibleFiles.length} 项</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="small" disabled={safePage === 1}
                onClick={() => setFilePage(safePage - 1)}>上一页</Button>
              <span style={{ color: theme === 'dark' ? '#ccc' : '#666', fontSize: 12 }}>
                第 {safePage} / {fileTotalPage} 页
              </span>
              <Button size="small" disabled={safePage >= fileTotalPage}
                onClick={() => setFilePage(safePage + 1)}>下一页</Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Drawer
      className="skill-file-drawer"
      getContainer={getContainer || null}
      title={skill ? `${skill.name} - 文件目录` : '技能文件目录'}
      width={720}
      open={open}
      onClose={() => { onClose(); setEditingFile(null); }}
      destroyOnClose
    >
      <div className="file-drawer-content" style={{ height: 'calc(100vh - 140px)' }}>
        <div className="file-toolbar">
          <div className="breadcrumb-path">
            <Tooltip title="返回上一层">
              <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={goBack} disabled={historyIndex <= 0} />
            </Tooltip>
            {renderBreadcrumb()}
          </div>
          <div className="toolbar-actions">
            <Upload {...fileDrawerUpload} showUploadList={false}>
              <Button type="primary" size="small" icon={<UploadOutlined />}>上传文件</Button>
            </Upload>
            <Button size="small" icon={<FolderAddOutlined />} onClick={handleCreateFolder}>新建文件夹</Button>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => skill && loadFileList(skill.id, currentPath)}>刷新</Button>
          </div>
        </div>

        <div className="file-list-area">
          {/* 搜索框 */}
          <div style={{ marginBottom: 8 }}>
            <Input
              placeholder="搜索文件或目录名称"
              value={fileSearchKeyword}
              onChange={(e) => {
                setFileSearchKeyword(e.target.value);
                setFilePage(1);
              }}
              prefix={<SearchOutlined />}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
          {/* 文件列表容器 */}
          <div style={{
            width: '100%',
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            borderRadius: 8,
            background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fafafa',
            border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
          }}>
            {renderFileList()}
          </div>
        </div>

        {editingFile && (
          <div className="file-editor-area">
            <div className="editor-header">
              <span>
                <FileOutlined /> {editingFile.name}
                {!editingFile.is_text && <span style={{ opacity: 0.5, marginLeft: 8 }}>(二进制文件不可编辑)</span>}
              </span>
              <div className="editor-actions">
                <Button size="small" onClick={() => setEditingFile(null)}>关闭</Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} loading={fileEditSaving}
                  disabled={!editingFile.is_text} onClick={handleSaveFile}>保存</Button>
              </div>
            </div>
            <div className="editor-body">
              <TextArea
                value={editingFile.content}
                disabled={!editingFile.is_text}
                onChange={e => setEditingFile({ ...editingFile, content: e.target.value })}
                style={{ minHeight: 220, fontFamily: 'Consolas, Monaco, monospace', fontSize: 13 }}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default SkillFileDrawer;
