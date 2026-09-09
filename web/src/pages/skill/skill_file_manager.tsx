import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Button, Input as AntInput, Empty, Modal,
  message, Spin, Tooltip, Tree, Dropdown, Popconfirm,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  FileOutlined, FolderFilled,
  UploadOutlined, FolderAddOutlined, FolderOpenOutlined, ReloadOutlined,
  SaveOutlined, DeleteOutlined, EditOutlined,
  DownloadOutlined, UndoOutlined,
  FileMarkdownOutlined, FileTextOutlined, FileImageOutlined,
  FilePdfOutlined, FileZipOutlined, SearchOutlined,
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  skillService, FileNode, FileContent,
} from '../../services/skill';
import './skill.less';

interface SkillFileManagerProps {
  skill: { id: string; name: string; title?: string };
  theme: 'light' | 'dark';
  /** 保存/删除等操作后通知父组件（可用于刷新 SKILL.md 相关字段） */
  onFileSaved?: (path: string) => void;
}

/** FileNode 目录树 -> antd Tree DataNode */
type TreeDataNode = DataNode & { key: string; path: string; isDir: boolean; fileNode?: FileNode };

/** 内联编辑状态：path 为正在编辑的节点，isNew 表示是新建文件夹（parentPath 为父目录） */
interface InlineEditState { path: string; value: string; isNew: boolean; parentPath?: string }

function renderFileIcon(name: string): JSX.Element {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const iconMap: Record<string, JSX.Element> = {
    md: <FileMarkdownOutlined style={{ color: '#722ed1' }} />,
    markdown: <FileMarkdownOutlined style={{ color: '#722ed1' }} />,
    txt: <FileTextOutlined style={{ color: '#52c41a' }} />,
    json: <FileTextOutlined style={{ color: '#fa8c16' }} />,
    yaml: <FileTextOutlined style={{ color: '#eb2f96' }} />,
    yml: <FileTextOutlined style={{ color: '#eb2f96' }} />,
    py: <FileTextOutlined style={{ color: '#1890ff' }} />,
    js: <FileTextOutlined style={{ color: '#fadb14' }} />,
    ts: <FileTextOutlined style={{ color: '#2f54eb' }} />,
    html: <FileTextOutlined style={{ color: '#ff4d4f' }} />,
    css: <FileTextOutlined style={{ color: '#722ed1' }} />,
    pdf: <FilePdfOutlined style={{ color: '#ff4d4f' }} />,
    zip: <FileZipOutlined style={{ color: '#faad14' }} />,
    tar: <FileZipOutlined style={{ color: '#faad14' }} />,
    gz: <FileZipOutlined style={{ color: '#faad14' }} />,
    png: <FileImageOutlined style={{ color: '#52c41a' }} />,
    jpg: <FileImageOutlined style={{ color: '#52c41a' }} />,
    jpeg: <FileImageOutlined style={{ color: '#52c41a' }} />,
    gif: <FileImageOutlined style={{ color: '#52c41a' }} />,
    webp: <FileImageOutlined style={{ color: '#52c41a' }} />,
  };
  return iconMap[ext] || <FileOutlined style={{ color: '#8c8c8c' }} />;
}

const isMarkdownPath = (p: string) =>
  /\.(md|markdown|mdx)$/i.test(p.split('/').pop() || '');

const isRootSkillMd = (path: string) => (path || '').replace(/\\/g, '/').trim() === 'SKILL.md';

/** 根目录节点 key */
const ROOT_KEY = '__root__';

const formatAbsTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatFileSize = (size?: number | null): string => {
  if (size === undefined || size === null) return '-';
  if (size < 1024) return size + ' B';
  if (size < 1048576) return (size / 1024).toFixed(1) + ' KB';
  return (size / 1048576).toFixed(2) + ' MB';
};

/** 收集目录下所有文件与子目录数 */
const countNodes = (nodes: FileNode[]): { files: number; dirs: number } =>
  nodes.reduce((acc, n) => {
    if (n.is_dir) {
      const sub = countNodes(n.children || []);
      return { files: acc.files + sub.files, dirs: acc.dirs + 1 + sub.dirs };
    }
    return { files: acc.files + 1, dirs: acc.dirs };
  }, { files: 0, dirs: 0 });

/**
 * 技能文件目录管理（左右布局）
 * - 左侧：文件目录树（根目录名、黄色文件夹图标、默认收起、拖拽排序、展开/收起全部文字按钮、
 *          上传弹窗、内联新建文件夹、搜索、右键重命名/删除）
 * - 右侧：当前选中文件内容（保存/恢复/下载/红色删除，SKILL.md 禁删）
 */
const SkillFileManager: React.FC<SkillFileManagerProps> = ({
  skill, theme, onFileSaved,
}) => {
  const [treeData, setTreeData] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');

  // 内联编辑（重命名 / 新建文件夹）
  const [inlineEdit, setInlineEdit] = useState<InlineEditState | null>(null);

  // 上传（右键直接打开文件选择器，选中后直接上传）
  const uploadDirRef = useRef('');
  const [uploading, setUploading] = useState(false);
  const filePickerRef = useRef<HTMLInputElement>(null);
  const folderPickerRef = useRef<HTMLInputElement>(null);

  // 左右面板拖拽调宽
  const [treePanelWidth, setTreePanelWidth] = useState(260);
  const containerRef = useRef<HTMLDivElement>(null);
  const onResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const startX = e.clientX;
    const startWidth = treePanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      // 限制宽度范围 [180, 容器宽度-300]
      const max = Math.max(180, container.clientWidth - 300);
      const w = Math.min(Math.max(startWidth + (ev.clientX - startX), 180), max);
      setTreePanelWidth(w);
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 右侧文件编辑器相关
  const [editingFile, setEditingFile] = useState<FileContent | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const inlineEditRef = useRef<AntInput>(null);
  const treeRef = useRef<any>(null);

  /** 滚动定位到指定节点（新建文件夹后定位用） */
  const scrollToNode = (path: string) => {
    try { treeRef.current?.scrollTo?.({ key: path, align: 'nearest' }); } catch { /* ignore */ }
  };

  const fileHasChanges = !!editingFile && editingFile.is_text
    && (editingFile.content ?? '') !== originalContent;

  // 切换文件时关闭 diff 视图
  useEffect(() => { setShowDiff(false); }, [editingFile?.path]);

  // 打开内联编辑时自动聚焦并全选
  useEffect(() => {
    if (inlineEdit && inlineEditRef.current) {
      const timer = setTimeout(() => {
        const el = inlineEditRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
        if (el) { el.focus(); el.select(); }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [inlineEdit?.path]);

  /** 在目录树中查找节点 */
  function findNode(nodes: FileNode[], path: string): FileNode | null {
    for (const n of nodes) {
      if (n.path === path) return n;
      if (n.children) {
        const found = findNode(n.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  const loadTree = async (keepSelection = true, expandDir?: string) => {
    setLoading(true);
    try {
      const data = await skillService.listFilesTree(skill.id);
      setTreeData(data || []);
      // 展开状态：保留根节点展开 + 过滤掉已不存在的 key，展开指定目录
      setExpandedKeys(prev => {
        const kept = (keepSelection
          ? prev.filter(k => k === ROOT_KEY || findNode(data || [], String(k)))
          : [ROOT_KEY]) as string[];
        if (expandDir && findNode(data || [], expandDir)) {
          return [...new Set([...kept, expandDir])];
        }
        return kept;
      });
      // 默认选中根目录 SKILL.md（仅在尚未选中或选中项不存在时）
      setSelectedKey(prev => {
        if (prev && findNode(data || [], prev)) return prev;
        if (findNode(data || [], 'SKILL.md')) {
          openFile('SKILL.md');
          return 'SKILL.md';
        }
        return '';
      });
    } catch (e: any) {
      message.error(e && e.message || '加载文件目录失败');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    setSearchKeyword('');
    setEditingFile(null);
    setOriginalContent('');
    setSelectedKey('');
    setInlineEdit(null);
    loadTree(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id]);

  const openFile = async (path: string) => {
    try {
      const content = await skillService.getFileContent(skill.id, path);
      setEditingFile(content);
      setOriginalContent(content.content);
    } catch (e: any) { message.error(e && e.message || '读取文件失败'); }
  };

  const handleSelect = (keys: React.Key[], info: any) => {
    const node = info?.node as TreeDataNode;
    if (!node || node.isDir) return; // 目录不选中，仅展开/收起
    setSelectedKey(node.path);
    openFile(node.path);
  };

  // ============ 搜索过滤 ============
  const filteredTreeData = useMemo(() => {
    if (!searchKeyword.trim()) return treeData;
    const kw = searchKeyword.trim().toLowerCase();

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      const result: FileNode[] = [];
      for (const n of nodes) {
        if (n.is_dir) {
          const children = n.children ? filterNodes(n.children) : [];
          if (children.length > 0 || n.name.toLowerCase().includes(kw)) {
            result.push({ ...n, children });
          }
        } else if (n.name.toLowerCase().includes(kw)) {
          result.push(n);
        }
      }
      return result;
    };
    return filterNodes(treeData);
  }, [treeData, searchKeyword]);

  // 搜索时自动展开所有目录
  const displayExpandedKeys = useMemo(() => {
    if (!searchKeyword.trim()) return expandedKeys;
    const keys: string[] = [ROOT_KEY];
    const walk = (nodes: FileNode[]) => {
      nodes.forEach(n => {
        if (n.is_dir) { keys.push(n.path); walk(n.children || []); }
      });
    };
    walk(filteredTreeData);
    return keys;
  }, [filteredTreeData, searchKeyword, expandedKeys]);

  // ============ 目录树渲染（含根目录节点 + 内联编辑） ============
  const toTreeData = (nodes: FileNode[], parentPath = ''): TreeDataNode[] =>
    nodes.map(n => {
      const isEditing = inlineEdit && inlineEdit.path === n.path;
      return {
        key: n.path,
        title: isEditing ? (
          <AntInput
            ref={inlineEditRef as any}
            size="small"
            value={inlineEdit!.value}
            onChange={(e) => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
            onBlur={() => commitInlineEdit()}
            onPressEnter={() => commitInlineEdit()}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'calc(100% - 4px)' }}
          />
        ) : n.name,
        path: n.path,
        isDir: n.is_dir,
        icon: n.is_dir
          ? <FolderFilled style={{ color: '#f5c518' }} />
          : renderFileIcon(n.name),
        children: n.children ? toTreeData(n.children, n.path) : undefined,
        fileNode: n,
      } as TreeDataNode;
    });

  /** 新建文件夹的可编辑节点（渲染在指定父目录 children 末尾或根级末尾） */
  const injectNewFolderNode = (nodes: TreeDataNode[], parentDirPath: string): TreeDataNode[] => {
    if (!inlineEdit || !inlineEdit.isNew) return nodes;
    if (parentDirPath === '' ) {
      // 根级
      return [...nodes, buildNewFolderNode('')];
    }
    return nodes.map(node => {
      if (node.path === parentDirPath) {
        return { ...node, children: [...(node.children || []), buildNewFolderNode(parentDirPath)] };
      }
      if (node.children) {
        return { ...node, children: injectNewFolderNode(node.children, parentDirPath) };
      }
      return node;
    });
  };

  const buildNewFolderNode = (parentDirPath: string): TreeDataNode => {
    const p = parentDirPath ? `${parentDirPath}/${inlineEdit!.path}` : inlineEdit!.path;
    return {
      key: p,
      title: (
        <AntInput
          ref={inlineEditRef as any}
          size="small"
          value={inlineEdit!.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit!, value: e.target.value })}
          onBlur={() => commitInlineEdit()}
          onPressEnter={() => commitInlineEdit()}
          onClick={(e) => e.stopPropagation()}
          style={{ width: 'calc(100% - 4px)' }}
        />
      ),
      path: p,
      isDir: true,
      icon: <FolderFilled style={{ color: '#f5c518' }} />,
    };
  };

  // ============ 展开全部 / 收起全部 ============
  const allDirKeys = useMemo(() => {
    const keys: string[] = [ROOT_KEY];
    const walk = (nodes: FileNode[]) => {
      nodes.forEach(n => {
        if (n.is_dir) { keys.push(n.path); walk(n.children || []); }
      });
    };
    walk(treeData);
    return keys;
  }, [treeData]);

  const allExpanded = expandedKeys.length >= allDirKeys.length && allDirKeys.length > 0;

  const toggleExpandAll = () => {
    // 收起全部时连根目录一起收起（只显示根节点一行）
    setExpandedKeys(allExpanded ? [] : allDirKeys);
  };

  // ============ 拖拽排序（仅改变同级顺序） ============
  const onDrop = (info: any) => {
    const dropKey = String(info.node.key);
    const dragKey = String(info.dragNode.key);
    const dropPos = info.node.pos.split('-');
    const dropPosition = info.dropPosition - Number(dropPos[dropPos.length - 1]);
    const dragParent = dragKey.includes('/') ? dragKey.slice(0, dragKey.lastIndexOf('/')) : '';
    const dropParent = dropKey.includes('/') ? dropKey.slice(0, dropKey.lastIndexOf('/')) : '';

    if (!info.dropToGap && dropPosition === 0) {
      message.warning('仅支持同级之间拖拽排序');
      return;
    }
    if (dragParent !== dropParent) {
      message.warning('仅支持同级之间拖拽排序');
      return;
    }

    setTreeData(prev => {
      const clone = JSON.parse(JSON.stringify(prev)) as FileNode[];
      const parentList = dragParent
        ? (findNode(clone, dragParent)?.children ?? [])
        : clone;
      const fromIndex = parentList.findIndex(n => n.path === dragKey);
      if (fromIndex < 0) return prev;
      const [moved] = parentList.splice(fromIndex, 1);
      const dropIndex = parentList.findIndex(n => n.path === dropKey);
      const insertIndex = info.dropToGap
        ? (dropPosition === -1 ? dropIndex : dropIndex + 1)
        : dropIndex + 1;
      parentList.splice(Math.max(0, insertIndex), 0, moved);
      return clone;
    });
  };

  /** 为“新建文件夹”生成不重名的默认名：新建文件夹 / 新建文件夹(2) ... */
  const nextNewFolderName = (parentPath: string): string => {
    const siblings = parentPath
      ? (findNode(treeData, parentPath)?.children || [])
      : treeData;
    const names = new Set(siblings.map(n => n.name));
    const base = '新建文件夹';
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(`${base}(${i})`)) i++;
    return `${base}(${i})`;
  };

  // ============ 新建文件夹（内联编辑，由右键菜单触发） ============
  const handleCreateFolder = (parentPath: string) => {
    if (inlineEdit) commitInlineEdit();
    const name = nextNewFolderName(parentPath);
    setInlineEdit({ path: name, value: name, isNew: true, parentPath });
    // 展开父目录（根目录时展开根节点），保证内联输入框可见
    setExpandedKeys(prev => [...new Set([...prev, parentPath || ROOT_KEY])]);
  };

  // ============ 重命名（内联编辑） ============
  const startRename = (node: FileNode | TreeDataNode) => {
    if (isRootSkillMd(node.path)) {
      message.warning('根目录下的 SKILL.md 为技能必要文件，不能重命名');
      return;
    }
    setInlineEdit({ path: node.path, value: node.path.split('/').pop() || node.path, isNew: false });
  };

  /** 提交内联编辑（重命名确认 / 新建文件夹确认），空值或 Esc 取消 */
  const commitInlineEdit = async (forcedValue?: string) => {
    if (!inlineEdit) return;
    const value = (forcedValue ?? inlineEdit.value).trim();
    const { path, isNew, parentPath } = inlineEdit;
    setInlineEdit(null); // 先关闭编辑态，避免操作失败时状态残留

    if (isNew) {
      // 新建文件夹（局部更新：直接插入新节点，不刷新整树）
      if (!value) return; // 取消
      const dirPath = parentPath ? `${parentPath}/${value}` : value;
      try {
        await skillService.createDirectory(skill.id, parentPath || '', value);
        message.success('文件夹创建成功');
        setTreeData(prev => {
          const now = new Date().toISOString();
          const newNode: FileNode = {
            name: value, path: dirPath, is_dir: true, size: undefined,
            modified_at: now, children: [],
          };
          if (!parentPath) return [...prev, newNode];
          const clone = JSON.parse(JSON.stringify(prev)) as FileNode[];
          const parent = findNode(clone, parentPath);
          if (parent) parent.children = [...(parent.children || []), newNode];
          return clone;
        });
        // 展开父目录并选中新目录（定位）
        if (parentPath) setExpandedKeys(prev => [...new Set([...prev, parentPath])]);
        setSelectedKey(dirPath);
        setTimeout(() => scrollToNode(dirPath), 100);
      } catch (e: any) {
        message.error(e && e.message || '创建失败');
      }
      return;
    }

    // 重命名（局部更新：直接修改节点 name/path 及子孙 path 前缀）
    if (!value || value === path.split('/').pop()) return; // 未变化，视为取消
    try {
      await skillService.renameFileOrDir(skill.id, path, value);
      message.success('重命名成功');
      const updatePaths = (nodes: FileNode[]): FileNode[] =>
        nodes.map(n => {
          if (n.path === path) {
            return { ...n, name: value, path: path.split('/').slice(0, -1).concat(value).join('/') };
          }
          if (n.path.startsWith(path + '/')) {
            const oldPrefix = path.split('/');
            const newSegs = n.path.split('/');
            newSegs[oldPrefix.length - 1] = value;
            return { ...n, path: newSegs.join('/') };
          }
          if (n.children) return { ...n, children: updatePaths(n.children) };
          return n;
        });
      const newPath = path.split('/').slice(0, -1).concat(value).join('/');
      setTreeData(prev => updatePaths(prev));
      // 若重命名的是当前打开文件（或其父目录），切换右侧内容到新路径
      if (editingFile && (editingFile.path === path || editingFile.path.startsWith(path + '/'))) {
        const newFullPath = editingFile.path === path
          ? newPath
          : newPath + editingFile.path.slice(path.length);
        setSelectedKey(newFullPath);
        setEditingFile({ ...editingFile, path: newFullPath, name: newFullPath.split('/').pop() || editingFile.name });
      } else if (selectedKey === path || selectedKey.startsWith(path + '/')) {
        setSelectedKey(selectedKey === path ? newPath : newPath + selectedKey.slice(path.length));
      }
    } catch (e: any) {
      message.error(e && e.message || '重命名失败');
    }
  };

  // ============ 右键菜单 ============
  const contextMenuProps = (node: TreeDataNode) => {
    const isRoot = !node.path; // 根目录节点（不可重命名/删除）
    const isDir = node.isDir;
    // 目录（含根目录）可上传/新建文件夹；文件不可
    const items: any[] = [];
    if (isDir) {
      items.push(
        { key: 'upload', label: '上传文件', icon: <UploadOutlined /> },
        { key: 'uploadFolder', label: '上传文件夹', icon: <FolderOpenOutlined /> },
        { key: 'newFolder', label: '新建文件夹', icon: <FolderAddOutlined /> },
      );
    }
    if (!isRoot) {
      items.push({ key: 'rename', label: '重命名', icon: <EditOutlined /> });
      items.push({ type: 'divider' as const });
      items.push({ key: 'delete', label: '删除', icon: <DeleteOutlined />, danger: true });
    }
    return {
      menu: {
        items,
        onClick: ({ key }: { key: string }) => {
          if (key === 'upload') {
            pickUploadFiles(node.path || '');
          } else if (key === 'uploadFolder') {
            pickUploadFolder(node.path || '');
          } else if (key === 'newFolder') {
            handleCreateFolder(node.path || '');
          } else if (key === 'rename') {
            startRename(node);
          } else if (key === 'delete') {
            handleDeleteNode(node);
          }
        },
      },
      trigger: ['contextMenu'] as const,
    };
  };

  /** 删除节点（含所有子文件，二次确认；SKILL.md 禁删） */
  const handleDeleteNode = (node: TreeDataNode | FileNode) => {
    if (isRootSkillMd(node.path)) {
      message.warning('根目录下的 SKILL.md 为技能必要文件，不能删除');
      return;
    }
    // 树节点（TreeDataNode）用 isDir，文件节点（FileNode）用 is_dir
    const isDir = 'isDir' in node ? node.isDir : (node as FileNode).is_dir;
    const children = 'children' in node && node.children ? (node.children as FileNode[]) : [];
    const { files, dirs } = countNodes(children);
    const displayName = node.path.split('/').pop() || node.path;
    // 拼接"包含内容"描述：同时显示文件数与子文件夹数
    const parts: string[] = [];
    if (files > 0) parts.push(`${files} 个文件`);
    if (dirs > 0) parts.push(`${dirs} 个子文件夹`);
    const containsText = parts.length > 0
      ? `该文件夹包含 ${parts.join('、')}`
      : '该文件夹为空';
    Modal.confirm({
      title: `确认删除${isDir ? '文件夹' : '文件'} "${displayName}"?`,
      content: isDir
        ? `${containsText}，删除后所有内容将一并删除，此操作不可恢复`
        : '此操作不可恢复',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await skillService.deleteFileOrDir(skill.id, node.path);
          message.success('删除成功');
          // 若删除的是当前打开文件（或其父目录），清空右侧
          if (editingFile && (editingFile.path === node.path || editingFile.path.startsWith(node.path + '/'))) {
            setEditingFile(null);
            setOriginalContent('');
            setSelectedKey('');
          }
          // 局部更新：从树中移除节点（不刷新整树）
          setTreeData(prev => {
            const removeNode = (nodes: FileNode[]): FileNode[] =>
              nodes
                .filter(n => n.path !== node.path)
                .map(n => (n.children ? { ...n, children: removeNode(n.children) } : n));
            return removeNode(prev);
          });
        } catch (e: any) {
          message.error(e && e.message || '删除失败');
          return Promise.reject();
        }
      },
    });
  };

  // ============ 上传（右键直接打开文件选择器） ============
  /** 打开文件选择器（普通多文件） */
  const pickUploadFiles = (dir: string) => {
    uploadDirRef.current = dir;
    filePickerRef.current?.click();
  };

  /** 打开文件选择器（整个文件夹上传） */
  const pickUploadFolder = (dir: string) => {
    uploadDirRef.current = dir;
    folderPickerRef.current?.click();
  };

  /** 上传前同名冲突校验：返回冲突的顶层名称列表 */
  const getConflicts = async (files: File[], dir: string): Promise<string[]> => {
    const names = files.map(f => {
      const rel = f.webkitRelativePath || f.name;
      return rel.replace(/\\/g, '/').split('/')[0];
    });
    return skillService.checkUploadConflicts(skill.id, dir, names);
  };

  /** 直接上传选中的文件（同名校验→逐个上传→局部刷新目录树） */
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const dir = uploadDirRef.current;
    try {
      const conflicts = await getConflicts(files, dir);
      if (conflicts.length > 0) {
        message.warning(`以下名称与目标目录冲突：${conflicts.join('、')}，请先重命名或删除同名项`);
        return;
      }
    } catch { /* 校验失败不阻塞，由后端兜底 */ }

    setUploading(true);
    try {
      const { directory } = await skillService.prepareUpload(skill.id);
      let successCount = 0;
      const failed: string[] = [];
      for (const file of files) {
        const rel = file.webkitRelativePath || file.name;
        try {
          await skillService.uploadFile(directory, file, dir || undefined, rel);
          successCount++;
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length === 0) {
        message.success(`上传成功：共 ${successCount} 个文件`);
      } else {
        message.warning(`上传完成：成功 ${successCount} 个，失败 ${failed.length} 个（${failed.slice(0, 5).join('、')}${failed.length > 5 ? '…' : ''}）`);
      }
      loadTree(false, dir);
    } catch (e: any) {
      message.error(e && e.message || '上传失败');
    } finally { setUploading(false); }
  };

  /** 系统自动生成的无用文件（文件夹上传时自动过滤） */
  const SYSTEM_FILES = ['desktop.ini', 'thumbs.db', '.ds_store'];

  /** 文件选择器 change 事件（过滤系统文件，重置 value 以便重复选择同一文件） */
  const onPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      f => !SYSTEM_FILES.includes(f.name.toLowerCase())
    );
    e.target.value = ''; // 允许再次选择同一文件
    if (files.length === 0) {
      message.info('所选内容均为系统文件，已跳过');
      return;
    }
    uploadFiles(files);
  };

  // ============ 右侧文件操作 ============
  const handleSaveFile = async () => {
    if (!editingFile || !editingFile.is_text) return;
    setSaving(true);
    try {
      await skillService.writeFileContent(skill.id, editingFile.path, editingFile.content);
      setOriginalContent(editingFile.content);
      message.success('文件保存成功');
      if (isRootSkillMd(editingFile.path)) onFileSaved?.(editingFile.path);
      // 局部更新：仅刷新当前文件的 modified_at（不刷新整树）
      setEditingFile(prev => (prev ? { ...prev, modified_at: new Date().toISOString() } : prev));
      setTreeData(prev => {
        const update = (nodes: FileNode[]): FileNode[] =>
          nodes.map(n => {
            if (n.path === editingFile.path) {
              return { ...n, modified_at: new Date().toISOString(), size: new Blob([editingFile.content || '']).size };
            }
            if (n.children) return { ...n, children: update(n.children) };
            return n;
          });
        return update(prev);
      });
    } catch (e: any) { message.error(e && e.message || '保存失败'); }
    finally { setSaving(false); }
  };

  const handleRestoreFile = () => {
    if (!editingFile) return;
    setEditingFile({ ...editingFile, content: originalContent });
  };

  const handleDownloadFile = () => {
    if (!editingFile) return;
    const fileName = editingFile.path.split('/').pop() || 'file';
    const blob = new Blob([editingFile.content ?? ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteFile = () => {
    if (!editingFile) return;
    handleDeleteNode({
      path: editingFile.path,
      name: editingFile.name,
      is_dir: false,
    } as any);
  };

  const deleteDisabled = !editingFile || isRootSkillMd(editingFile.path);

  // 编辑器高度：动态计算（内容行数），限制在 [300, 视口-320] 区间
  const editorHeight = useMemo(() => {
    const lines = (editingFile?.content || '').split('\n').length;
    return Math.min(
      Math.max(lines * 21 + 120, 300),
      Math.max(window.innerHeight - 320, 300),
    );
  }, [editingFile?.content]);

  const selectedNode = selectedKey ? findNode(treeData, selectedKey) : null;

  // 渲染目录树数据（根目录节点 + 搜索过滤 + 内联编辑 + 新建文件夹节点注入）
  const treeDataNodes = useMemo(() => {
    const children = toTreeData(filteredTreeData);
    const withNew = inlineEdit && inlineEdit.isNew
      ? injectNewFolderNode(children, inlineEdit.parentPath || '')
      : children;
    // 根目录节点（不可选中/拖拽，仅展示）
    return [{
      key: ROOT_KEY,
      title: skill.name,
      path: '',
      isDir: true,
      icon: <FolderFilled style={{ color: '#f5c518' }} />,
      selectable: false,
      children: withNew,
    } as TreeDataNode];
  }, [filteredTreeData, inlineEdit, skill.name]);

  return (
    <div className="skill-file-manager" ref={containerRef}
      style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* ============ 左侧：文件目录树 ============ */}
      <div className="file-tree-panel"
        style={{
          width: treePanelWidth, flexShrink: 0, display: 'flex', flexDirection: 'column',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
          borderRadius: 8, overflow: 'hidden',
          background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
        }}>
        {/* 工具栏 */}
        <div className="file-tree-toolbar"
          style={{
            padding: 8, display: 'flex', flexDirection: 'column', gap: 4,
            borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
          }}>
          {/* 第一行：搜索框 + 刷新 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <AntInput
              placeholder="搜索文件或目录"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              prefix={<SearchOutlined />}
              allowClear
              style={{
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                border: 'none',
                borderRadius: '8px',
                height: '32px',
                color: theme === 'dark' ? '#ffffff' : '#000000',
              }}
            />
            <Tooltip title="刷新">
              <Button size="small" type="text" icon={<ReloadOutlined />}
                onClick={() => loadTree()} />
            </Tooltip>
          </div>
          {/* 第二行：展开/收起全部 */}
          <Button size="small" type="text" onClick={toggleExpandAll}>
            {allExpanded ? '收起全部' : '展开全部'}
          </Button>
        </div>

        {/* 目录树 */}
        <div className="file-tree-body skill-file-tree" style={{ flex: 1, overflow: 'auto', padding: 4 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin size="large" />
            </div>
          ) : treeDataNodes.length === 0 ? (
            <Empty description={searchKeyword ? '未找到匹配的文件或目录' : '暂无文件'} />
          ) : (
            <Tree
              ref={treeRef}
              showIcon
              blockNode
              treeData={treeDataNodes}
              expandedKeys={displayExpandedKeys}
              onExpand={(keys) => setExpandedKeys(keys as React.Key[])}
              selectedKeys={selectedKey ? [selectedKey] : []}
              onSelect={handleSelect}
              draggable={{ icon: false }}
              onDrop={onDrop}
              titleRender={(node: any) => {
                // 根节点标题加粗；SKILL.md 禁止右键菜单（不包 Dropdown，避免空菜单报错）
                const titleSpan = (
                  <span style={{
                    display: 'block', width: '100%',
                    ...(node.key === ROOT_KEY ? { fontWeight: 600 } : {}),
                  }}>{node.title}</span>
                );
                return isRootSkillMd(node.path)
                  ? titleSpan
                  : <Dropdown {...contextMenuProps(node)}>{titleSpan}</Dropdown>;
              }}
            />
          )}
        </div>
      </div>

      {/* ============ 隐藏的文件选择器（右键上传直接唤起） ============ */}
      <input ref={filePickerRef} type="file" multiple
        style={{ display: 'none' }} onChange={onPickerChange} />
      {/* 文件夹选择器：webkitdirectory 非标准属性，用于选择整个文件夹 */}
      <input ref={folderPickerRef} type="file" multiple
        style={{ display: 'none' }} onChange={onPickerChange}
        {...({ webkitdirectory: '', directory: '' } as any)} />

      {/* ============ 左右面板拖拽把手 ============ */}
      <div className="panel-resizer" onMouseDown={onResizerMouseDown}
        title="拖动调整宽度" />

      {/* ============ 右侧：文件内容 ============ */}
      <div className="file-content-panel"
        style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}`,
          borderRadius: 8, overflow: 'hidden',
          background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
        }}>
        {!editingFile ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="请选择左侧文件查看内容" />
          </div>
        ) : (
          <div className="file-drawer-content"
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 顶部操作按钮区 */}
            <div className="file-list-actions"
              style={{
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
                borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#f0f0f0'}`,
              }}>
              <Button type="text" icon={<SaveOutlined />} loading={saving}
                disabled={!editingFile.is_text} onClick={handleSaveFile}>保存</Button>
              <Button type="text" icon={<UndoOutlined />} disabled={!fileHasChanges}
                onClick={handleRestoreFile} title="还原为打开时的内容">恢复</Button>
              <Button type="text" icon={<DownloadOutlined />} onClick={handleDownloadFile}>下载</Button>
              {fileHasChanges && (
                <>
                  <span style={{ color: '#faad14', fontSize: 12 }}>• 有未保存的变动</span>
                  <Button size="small" type="text"
                    onClick={() => setShowDiff(v => !v)}>
                    {showDiff ? '返回编辑' : '比对（查看改动）'}
                  </Button>
                </>
              )}
              <span style={{ marginLeft: 'auto', color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
                {formatFileSize(selectedNode?.size)} · 更新于 {formatAbsTime(editingFile.modified_at)}
              </span>
              {!deleteDisabled && (
                <Popconfirm
                  title={`确认删除 ${editingFile.name}?`}
                  description="此操作不可恢复"
                  onConfirm={handleDeleteFile}
                  okText="删除" cancelText="取消" okType="danger"
                >
                  <Button danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              )}
            </div>

            {/* 编辑器区域 */}
            <div className="file-editor-area"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'auto' }}>
              {!showDiff && !editingFile.is_text && (
                <div className="editor-header">
                  <span><FileOutlined /> 二进制文件，不可编辑</span>
                </div>
              )}
              <div className="editor-body" style={{ padding: 12 }}>
                {showDiff && fileHasChanges ? (
                  <div className="diff-view"
                    style={{ height: '100%', overflow: 'auto', padding: '8px 0',
                              fontFamily: 'Consolas, Monaco, monospace',
                              fontSize: 13, lineHeight: 1.5 }}
                  >
                    {computeDiffLines(originalContent, editingFile.content).map((line, idx) => {
                      const bg = line.type === 'add' ? (theme === 'dark' ? 'rgba(46,160,67,0.2)' : '#e6ffec')
                        : line.type === 'del' ? (theme === 'dark' ? 'rgba(248,81,73,0.2)' : '#ffebe9')
                        : 'transparent';
                      const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
                      const num = line.type === 'del' ? line.oldLine : line.type === 'add' ? line.newLine : line.oldLine ?? line.newLine;
                      return (
                        <div key={idx} style={{ display: 'flex', background: bg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          <span style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingRight: 8, opacity: 0.5, userSelect: 'none', borderRight: '1px solid rgba(128,128,128,0.2)' }}>{num ?? ''}</span>
                          <span style={{ width: 16, flexShrink: 0, textAlign: 'center', userSelect: 'none', opacity: 0.7 }}>{prefix}</span>
                          <span style={{ padding: '0 8px', flex: 1 }}>{line.text}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : editingFile.is_text && isMarkdownPath(editingFile.path) ? (
                  <MDEditor
                    value={editingFile.content}
                    height={editorHeight}
                    preview="edit"
                    data-color-mode={theme === 'dark' ? 'dark' : 'light'}
                    textareaProps={{
                      disabled: !editingFile.is_text,
                      spellCheck: false,
                    }}
                    onChange={(e) => setEditingFile({ ...editingFile, content: e || '' })}
                  />
                ) : editingFile.is_text ? (
                  <AntInput.TextArea
                    value={editingFile.content}
                    disabled={!editingFile.is_text}
                    onChange={e => setEditingFile({ ...editingFile, content: e.target.value })}
                    style={{ height: editorHeight, fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, resize: 'none' }}
                  />
                ) : (
                  <div style={{ padding: 24, color: theme === 'dark' ? '#888' : '#999' }}>
                    二进制文件，不支持在线编辑
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============== 行级 diff ==============
type DiffLine = { type: 'add' | 'del' | 'same'; oldLine?: number; newLine?: number; text: string };

const computeDiffLines = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const MAX = 4000;
  let o = oldLines, n = newLines;
  let oTrim = 0, nTrim = 0;
  if (o.length > MAX + n.length) { o = o.slice(0, MAX); oTrim = oldLines.length - o.length; }
  if (n.length > MAX + o.length) { n = n.slice(0, MAX); nTrim = newLines.length - n.length; }

  const len1 = o.length, len2 = n.length;
  const dp: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
  for (let i = len1 - 1; i >= 0; i--) {
    for (let j = len2 - 1; j >= 0; j--) {
      dp[i][j] = o[i] === n[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const seq: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < len1 && j < len2) {
    if (o[i] === n[j]) {
      seq.push({ type: 'same', oldLine: i + 1, newLine: j + 1, text: o[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      seq.push({ type: 'del', oldLine: i + 1, text: o[i] });
      i++;
    } else {
      seq.push({ type: 'add', newLine: j + 1, text: n[j] });
      j++;
    }
  }
  while (i < len1) { seq.push({ type: 'del', oldLine: i + 1, text: o[i] }); i++; }
  while (j < len2) { seq.push({ type: 'add', newLine: j + 1, text: n[j] }); j++; }
  if (oTrim > 0 || nTrim > 0) {
    seq.push({ type: 'same', text: `…（已省略 ${Math.max(oTrim, nTrim)} 行，仅显示前 ${MAX} 行）` });
  }
  return seq;
};

export default SkillFileManager;
