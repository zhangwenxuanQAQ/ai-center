import React, { useCallback, useEffect, useState } from 'react';
import {
  Button, Dropdown, Empty, Input, message, Modal, Spin, Tooltip, Tree,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  ClockCircleOutlined, DeleteOutlined, EditOutlined, FileOutlined, FileTextOutlined,
  FolderAddOutlined, FolderOpenOutlined, FolderOutlined, SaveOutlined, UploadOutlined,
} from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import MDEditor from '@uiw/react-md-editor';
import {
  hermesAgentService,
  HermesSkill,
  HermesSkillTreeNode,
} from '../../services/hermes_agent';

/** 目录树节点（扩展 path/isDir 用于右键操作） */
interface SkillTreeNode extends DataNode {
  key: string;
  title: React.ReactNode;
  path: string;
  isDir: boolean;
  isSkillMd?: boolean;
  children?: SkillTreeNode[];
}

/** 后端目录树 -> antd Tree DataNode */
const toTreeNode = (node: HermesSkillTreeNode): SkillTreeNode => ({
  key: node.path,
  title: node.name,
  path: node.path,
  isDir: node.is_dir,
  isSkillMd: !node.is_dir && node.path === 'SKILL.md',
  children: node.is_dir ? node.children.map(toTreeNode) : undefined,
});

/** 文件是否为 Markdown（使用 MDEditor，其余文本用 CodeMirror） */
const isMarkdown = (path: string) => /\.md$/i.test(path);

interface SkillDetailModalProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  skill: HermesSkill | null;
  isDark: boolean;
  /** 删除/上传等操作导致技能内容变化后的回调 */
  onChanged?: () => void;
}

/**
 * 技能详情弹窗
 * 左侧技能目录树（右键上传/新建/删除），右侧文件内容编辑（默认 SKILL.md）
 */
const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  open, onClose, agentName, skill, isDark, onChanged,
}) => {
  const [treeData, setTreeData] = useState<SkillTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [fileContent, setFileContent] = useState('');
  const [fileUpdatedAt, setFileUpdatedAt] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  /** 新建文件夹弹窗 */
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirParent, setMkdirParent] = useState('');
  const [mkdirName, setMkdirName] = useState('');
  /** 重命名弹窗 */
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameNode, setRenameNode] = useState<SkillTreeNode | null>(null);
  const [renameName, setRenameName] = useState('');

  const secondaryText = isDark ? 'rgba(255, 255, 255, 0.55)' : '#8f959e';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#f0f0f0';
  const panelBg = isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';

  const category = skill?.category || '';
  const skillDir = skill?.dir_name || skill?.name || '';

  /** 加载目录树并默认展示 SKILL.md */
  const loadTree = useCallback(async (autoSelect = true) => {
    if (!agentName || !category || !skillDir) return;
    setTreeLoading(true);
    try {
      const res = await hermesAgentService.getSkillTree(agentName, category, skillDir);
      const root = toTreeNode(res.tree);
      setTreeData([root]);
      if (autoSelect) {
        // 默认展开全部目录并展示 SKILL.md
        const keys: React.Key[] = [root.key];
        const collect = (nodes?: SkillTreeNode[]) => {
          nodes?.forEach((n) => {
            if (n.isDir) {
              keys.push(n.key);
              collect(n.children);
            }
          });
        };
        collect(root.children);
        setExpandedKeys(keys);
        if (res.skill_md) {
          setSelectedKey(res.skill_md);
        }
      }
    } catch (e) {
      // request 工具已统一提示错误
    } finally {
      setTreeLoading(false);
    }
  }, [agentName, category, skillDir]);

  /** 读取文件内容 */
  const loadFile = useCallback(async (path: string) => {
    if (!agentName || !category || !skillDir || !path) return;
    setFileLoading(true);
    try {
      const res = await hermesAgentService.readSkillFile(agentName, category, skillDir, path);
      setFileContent(res.content);
      setFileUpdatedAt(res.updated_at || '');
      setDirty(false);
    } catch (e) {
      setFileContent('');
      setFileUpdatedAt('');
    } finally {
      setFileLoading(false);
    }
  }, [agentName, category, skillDir]);

  useEffect(() => {
    if (open && skill) {
      setFileContent('');
      setFileUpdatedAt('');
      setDirty(false);
      setSelectedKey('');
      loadTree(true);
    }
  }, [open, skill, loadTree]);

  useEffect(() => {
    if (open && selectedKey) {
      loadFile(selectedKey);
    }
  }, [selectedKey, loadFile, open]);

  /** 保存文件 */
  const handleSave = async () => {
    if (!selectedKey) return;
    setSaving(true);
    try {
      await hermesAgentService.writeSkillFile(agentName, category, skillDir, selectedKey, fileContent);
      message.success('保存成功');
      setDirty(false);
      // 重新读取以刷新最近更新时间
      loadFile(selectedKey);
    } catch (e: any) {
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  /** 上传多个文件到指定目录 */
  const uploadFiles = async (dirPath: string, files: File[]) => {
    if (!files.length) return;
    try {
      const res = await hermesAgentService.uploadSkillFiles(agentName, category, skillDir, dirPath, files);
      message.success(`上传成功（${res.count} 个文件）`);
      loadTree(false);
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || '上传失败');
    }
  };

  /** 触发文件/文件夹选择（webkitdirectory 控制是否选文件夹） */
  const triggerFilePick = (dirPath: string, directory: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (directory) {
      (input as any).webkitdirectory = true;
    }
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      await uploadFiles(dirPath, files);
    };
    input.click();
  };

  /** 删除节点（根目录与 SKILL.md 除外） */
  const handleDelete = async (node: SkillTreeNode) => {
    Modal.confirm({
      title: `确认删除${node.isDir ? '目录' : '文件'}`,
      content: `删除后不可恢复：${node.path}`,
      onOk: async () => {
        try {
          await hermesAgentService.deleteSkillNode(agentName, category, skillDir, node.path);
          message.success('删除成功');
          if (selectedKey === node.path || (node.isDir && selectedKey.startsWith(node.path + '/'))) {
            setSelectedKey('');
            setFileContent('');
            setFileUpdatedAt('');
          }
          loadTree(false);
          onChanged?.();
        } catch (e: any) {
          message.error(e?.message || '删除失败');
        }
      },
    });
  };

  /** 提交重命名 */
  const handleRename = async () => {
    if (!renameNode) return;
    const newName = renameName.trim();
    if (!newName) {
      message.warning('请输入新名称');
      return;
    }
    try {
      await hermesAgentService.renameSkillNode(agentName, category, skillDir, renameNode.path, newName);
      message.success('重命名成功');
      // 当前打开的文件被重命名时切换到新路径
      if (!renameNode.isDir && selectedKey === renameNode.path) {
        const parent = renameNode.path.includes('/') ? renameNode.path.slice(0, renameNode.path.lastIndexOf('/') + 1) : '';
        setSelectedKey(parent + newName);
      }
      setRenameOpen(false);
      setRenameNode(null);
      setRenameName('');
      loadTree(false);
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || '重命名失败');
    }
  };

  /** 新建文件夹 */
  const handleMkdir = async () => {
    const name = mkdirName.trim();
    if (!name) {
      message.warning('请输入文件夹名称');
      return;
    }
    const path = mkdirParent ? `${mkdirParent}/${name}` : name;
    try {
      await hermesAgentService.createSkillDir(agentName, category, skillDir, path);
      message.success('文件夹创建成功');
      setMkdirOpen(false);
      setMkdirName('');
      // 展开父目录以显示新建的文件夹
      setExpandedKeys((prev) => (mkdirParent && !prev.includes(mkdirParent) ? [...prev, mkdirParent] : prev));
      loadTree(false);
      onChanged?.();
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    }
  };

  /** 树节点图标渲染（目录/文件/SKILL.md 区分） */
  const renderTitle = (node: SkillTreeNode) => {
    if (node.isSkillMd) {
      return <span><FileTextOutlined style={{ marginRight: 6, color: '#5a6fd6' }} />{node.title}</span>;
    }
    return <span>{node.isDir
      ? <FolderOutlined style={{ marginRight: 6, color: '#e8b339' }} />
      : <FileOutlined style={{ marginRight: 6 }} />}{node.title}</span>;
  };

  /** 右键菜单（根目录与 SKILL.md 不支持删除/重命名；删除项不放在首位） */
  const contextMenu = (node: SkillTreeNode) => {
    const isRoot = node.path === '.';
    // 可删除/重命名：非根目录且非 SKILL.md
    const canMutate = !isRoot && !node.isSkillMd;
    // 菜单项点击时阻止事件冒泡到树节点，避免触发 onSelect 导致目录收起
    const withStop = (handler: () => void) => (e: any) => {
      e?.domEvent?.stopPropagation?.();
      handler();
    };
    const items: any[] = [];
    if (node.isDir) {
      items.push(
        {
          key: 'upload-file',
          icon: <UploadOutlined />,
          label: '上传文件',
          onClick: withStop(() => triggerFilePick(node.path, false)),
        },
        {
          key: 'upload-dir',
          icon: <FolderOpenOutlined />,
          label: '上传文件夹',
          onClick: withStop(() => triggerFilePick(node.path, true)),
        },
        {
          key: 'mkdir',
          icon: <FolderAddOutlined />,
          label: '新建文件夹',
          onClick: withStop(() => {
            setMkdirParent(node.path);
            setMkdirName('');
            setMkdirOpen(true);
          }),
        },
      );
    }
    if (canMutate) {
      if (items.length) items.push({ type: 'divider' as const });
      items.push(
        {
          key: 'rename',
          icon: <EditOutlined />,
          label: '重命名',
          onClick: withStop(() => {
            setRenameNode(node);
            setRenameName(node.path.split('/').pop() || '');
            setRenameOpen(true);
          }),
        },
        {
          key: 'delete',
          icon: <DeleteOutlined />,
          danger: true,
          label: node.isDir ? '删除目录' : '删除文件',
          onClick: withStop(() => handleDelete(node)),
        },
      );
    }
    return { items };
  };

  if (!skill) return null;

  return (
    <Modal
      title={`${category} / ${skillDir}`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      destroyOnClose
      styles={{ body: { padding: '12px 24px 24px' } }}
    >
      {/* 描述 */}
      {skill.description && (
        <div style={{ color: secondaryText, fontSize: 13, marginBottom: 12 }}>{skill.description}</div>
      )}

      <div style={{ display: 'flex', gap: 12, height: '68vh' }}>
        {/* 左侧目录树（右键菜单：上传/新建/删除） */}
        <div style={{
          width: 280, flexShrink: 0, overflow: 'auto', padding: '8px 4px',
          background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 10,
        }}>
          <Spin spinning={treeLoading} size="small">
            {treeData.length > 0 ? (
              <Tree
                blockNode
                selectedKeys={selectedKey ? [selectedKey] : []}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys)}
                onSelect={(_keys, info) => {
                  const node = info.node as unknown as SkillTreeNode;
                  // 目录节点点击切换展开；文件节点选中展示内容
                  if (node.isDir) {
                    setExpandedKeys((prev) => (
                      prev.includes(node.key)
                        ? prev.filter((k) => k !== node.key)
                        : [...prev, node.key]
                    ));
                  } else if (node.key !== selectedKey) {
                    setSelectedKey(String(node.key));
                  }
                }}
                treeData={treeData}
                titleRender={(node: any) => (
                  <Dropdown menu={contextMenu(node as SkillTreeNode)} trigger={['contextMenu']}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', width: '100%' }}>
                      {renderTitle(node as SkillTreeNode)}
                    </span>
                  </Dropdown>
                )}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文件" />
            )}
          </Spin>
        </div>

        {/* 右侧文件内容编辑 */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          background: panelBg, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '8px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, minHeight: 24, gap: 12 }}>
            <span style={{ color: secondaryText, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {selectedKey ? (
                <>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <FileTextOutlined style={{ marginRight: 6 }} />{selectedKey}
                  </span>
                  {fileUpdatedAt && (
                    <Tooltip title={`最近更新：${fileUpdatedAt}`}>
                      <span style={{ flexShrink: 0 }}>
                        <ClockCircleOutlined style={{ marginRight: 4 }} />{fileUpdatedAt}
                      </span>
                    </Tooltip>
                  )}
                </>
              ) : '请在左侧选择文件'}
            </span>
            <Button
              type="primary" size="small" icon={<SaveOutlined />}
              loading={saving} disabled={!selectedKey || !dirty}
              onClick={handleSave}
            >
              保存{dirty ? ' *' : ''}
            </Button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {fileLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin />
              </div>
            ) : selectedKey ? (
              isMarkdown(selectedKey) ? (
                <div data-color-mode={isDark ? 'dark' : 'light'} style={{ height: '100%' }}>
                  <MDEditor
                    value={fileContent}
                    height="100%"
                    style={{ height: '100%' }}
                    onChange={(v) => { setFileContent(v || ''); setDirty(true); }}
                    preview="edit"
                  />
                </div>
              ) : (
                <CodeMirror
                  value={fileContent}
                  height="100%"
                  style={{ height: '100%', fontSize: 13 }}
                  theme={isDark ? 'dark' : 'light'}
                  extensions={[EditorView.lineWrapping]}
                  onChange={(v) => { setFileContent(v); setDirty(true); }}
                />
              )
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未选择文件" style={{ marginTop: 80 }} />
            )}
          </div>
        </div>
      </div>

      {/* 新建文件夹弹窗 */}
      <Modal
        title={mkdirParent && mkdirParent !== '.' ? `在 ${mkdirParent} 下新建文件夹` : '新建文件夹'}
        open={mkdirOpen}
        onCancel={() => setMkdirOpen(false)}
        onOk={handleMkdir}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          placeholder="文件夹名称"
          value={mkdirName}
          onChange={(e) => setMkdirName(e.target.value)}
          onPressEnter={handleMkdir}
          maxLength={128}
          autoFocus
        />
      </Modal>

      {/* 重命名弹窗（根目录与 SKILL.md 不支持） */}
      <Modal
        title={`重命名${renameNode?.isDir ? '目录' : '文件'}`}
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={handleRename}
        okText="重命名"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          placeholder="新名称"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onPressEnter={handleRename}
          maxLength={255}
          autoFocus
        />
      </Modal>
    </Modal>
  );
};

export default SkillDetailModal;
