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
  ArrowLeftOutlined, SaveOutlined, DeleteOutlined, EditOutlined,
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
}

const SkillFileDrawer: React.FC<SkillFileDrawerProps> = ({
  skill, open, onClose, onEditSkill, theme,
}) => {
  const [fileList, setFileList] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [pathHistory, setPathHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [editingFile, setEditingFile] = useState<FileContent | null>(null);
  const [fileEditSaving, setFileEditSaving] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);

  useEffect(() => {
    if (open && skill) {
      setCurrentPath('');
      setPathHistory(['']);
      setHistoryIndex(0);
      setEditingFile(null);
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

  return (
    <Drawer
      title={skill ? `${skill.name} - 文件目录` : '技能文件目录'}
      width={720}
      open={open}
      onClose={() => { onClose(); setEditingFile(null); }}
      destroyOnClose
      extra={skill && onEditSkill && (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => onEditSkill(skill)}>编辑技能信息</Button>
        </Space>
      )}
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
          <Spin spinning={fileLoading}>
            {fileList.length === 0 ? (
              <div className="empty-dir">
                <FolderOutlined style={{ fontSize: 40, opacity: 0.4 }} />
                <div>此目录为空</div>
              </div>
            ) : (
              fileList.map(item => (
                <div className="file-item" key={item.path}>
                  {item.is_dir
                    ? <FolderOpenOutlined style={{ color: '#faad14' }} />
                    : <FileOutlined style={{ color: '#5a6fd6' }} />}
                  <span className="file-name" onClick={() => handleFileItemClick(item)}>{item.name}</span>
                  {!item.is_dir && item.size !== undefined && item.size !== null && (
                    <span className="file-size">
                      {item.size < 1024 ? item.size + ' B'
                        : item.size < 1048576 ? (item.size / 1024).toFixed(1) + ' KB'
                        : (item.size / 1048576).toFixed(2) + ' MB'}
                    </span>
                  )}
                  <div className="file-actions">
                    <Popconfirm
                      title={`确认删除 ${item.name}?`}
                      onConfirm={() => handleDeleteFileItem(item)}
                      okText="删除" cancelText="取消" okType="danger"
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))
            )}
          </Spin>
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
