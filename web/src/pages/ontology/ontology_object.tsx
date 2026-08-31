import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Drawer, Input, message, Modal, Space, Dropdown, Popconfirm,
  Form, Spin, Checkbox, Typography, Layout, Empty, Tooltip, Select, Pagination, Popover, Progress, Upload
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  SearchOutlined, ExportOutlined, ReloadOutlined, FileTextOutlined, SaveOutlined, ClearOutlined,
  DownOutlined, CopyOutlined, UploadOutlined
} from '@ant-design/icons';
import { ontologyService, OntologyObject, OntologyContent } from '../../services/ontology';
import { datasourceService, Datasource } from '../../services/datasource';
import { getDatasourceIcon as getDatasourceIconSvg } from '../../utils/avatar';
import '../../styles/common.css';
import '../chat/chat.less';

const { TextArea } = Input;
const { Text } = Typography;
const { Sider: LeftSider, Content } = Layout;

/**
 * 编辑本体对象抽屉（独立子组件）
 * 将编辑抽屉的表单、字段表格状态隔离在子组件内，
 * 输入中文名称时只重渲染子组件，避免触发整个页面（含主列表表格、添加本体弹窗）重渲染导致卡顿。
 */
const OntologyEditDrawer: React.FC<{
  open: boolean;
  object: OntologyObject | null;
  datasourceId: string;
  onClose: () => void;
  onSave: (id: string, values: { title: string; description: string; content: OntologyContent }) => Promise<void>;
}> = ({ open, object, datasourceId, onClose, onSave }) => {
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<OntologyObject | null>(null);
  const [descEditingIndex, setDescEditingIndex] = useState<number>(-1);
  const [descEditingValue, setDescEditingValue] = useState<string>('');
  const [tables, setTables] = useState<any[]>([]);
  const [fkColumnsCache, setFkColumnsCache] = useState<Record<string, any[]>>({});
  const [saving, setSaving] = useState(false);

  // 打开抽屉时加载数据源表列表（供外键表下拉框使用）并预加载已有外键字段
  useEffect(() => {
    if (!open || !object) return;
    setEditing(object);
    setDescEditingIndex(-1);
    setDescEditingValue('');
    setFkColumnsCache({});
    setTables([]);
    form.setFieldsValue({ title: object.title, description: object.description });
    if (!datasourceId) return;
    datasourceService.listTables(datasourceId).then(res => {
      setTables(res?.tables || []);
      const fkTables = [...new Set(
        (object.content?.columns || [])
          .map(c => c.foreign_key?.referenced_table)
          .filter(Boolean)
      )];
      fkTables.forEach(async (fkTable) => {
        try {
          const fkRes = await datasourceService.getTableColumns(datasourceId, fkTable as string);
          const colList = (fkRes?.columns || []).map((col: any) => ({
            column_name: col.column_name || '',
            data_type: col.data_type || col.column_type || '',
          }));
          setFkColumnsCache(prev => ({ ...prev, [fkTable as string]: colList }));
        } catch {
          // 忽略加载失败
        }
      });
    }).catch(() => setTables([]));
  }, [open, object, datasourceId]);

  const handleClose = () => {
    setEditing(null);
    onClose();
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      await onSave(editing.id, { title: values.title, description: values.description, content: editing.content });
      setEditing(null);
      onClose();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败
      message.error(e.message || '保存失败');
    }
    setSaving(false);
  };

  const handleColumnChange = (colIndex: number, field: string, value: any) => {
    if (!editing) return;
    const content = { ...editing.content };
    const columns = [...(content.columns || [])];
    columns[colIndex] = { ...columns[colIndex], [field]: value };
    content.columns = columns;
    setEditing({ ...editing, content });
  };

  const handleForeignKeyChange = async (colIndex: number, fkField: string, value: string) => {
    if (!editing) return;
    const content = { ...editing.content };
    const columns = [...(content.columns || [])];
    const fk = columns[colIndex].foreign_key || { referenced_table: '', referenced_column: '' };
    if (fkField === 'referenced_table' && value !== fk.referenced_table) {
      fk.referenced_column = '';
    }
    columns[colIndex] = { ...columns[colIndex], foreign_key: { ...fk, [fkField]: value } };
    content.columns = columns;
    setEditing({ ...editing, content });
    if (fkField === 'referenced_table' && value && !fkColumnsCache[value] && datasourceId) {
      try {
        const res = await datasourceService.getTableColumns(datasourceId, value);
        const colList = (res?.columns || []).map((col: any) => ({
          column_name: col.column_name || '',
          data_type: col.data_type || col.column_type || '',
        }));
        setFkColumnsCache(prev => ({ ...prev, [value]: colList }));
      } catch {
        // 忽略加载失败
      }
    }
  };

  const fieldColumns = [
    { title: '字段名', dataIndex: 'column_name', key: 'column_name', width: 220,
      render: (text: string) => <Text code>{text}</Text>
    },
    { title: '中文名称', dataIndex: 'column_name_cn', key: 'column_name_cn', width: 120,
      render: (text: string, _: any, index: number) => (
        <Input size="small" value={text} placeholder="中文名称"
          onChange={e => handleColumnChange(index, 'column_name_cn', e.target.value)} />
      )
    },
    { title: '主键', dataIndex: 'is_primary_key', key: 'is_primary_key', width: 60,
      render: (val: boolean, _: any, index: number) => (
        <Checkbox checked={val} onChange={e => handleColumnChange(index, 'is_primary_key', e.target.checked)} />
      )
    },
    { title: '外键表', key: 'fk_table', width: 100,
      render: (_: any, record: any, index: number) => (
        <Select
          size="small"
          value={record.foreign_key?.referenced_table || undefined}
          placeholder="请选择外键表"
          showSearch
          allowClear
          style={{ width: '100%' }}
          options={tables.map(t => ({ label: t.table_name || t, value: t.table_name || t }))}
          notFoundContent="暂无表数据"
          onChange={(val) => handleForeignKeyChange(index, 'referenced_table', val || '')}
        />
      )
    },
    { title: '外键字段', key: 'fk_column', width: 100,
      render: (_: any, record: any, index: number) => {
        const fkTable = record.foreign_key?.referenced_table;
        const cols = fkTable ? (fkColumnsCache[fkTable] || []) : [];
        const fkColumns = cols.map((c: any) => ({ label: c.column_name, value: c.column_name }));
        return (
          <Select
            size="small"
            value={record.foreign_key?.referenced_column || undefined}
            placeholder={fkTable ? '请选择外键字段' : '请先选择外键表'}
            showSearch
            allowClear
            style={{ width: '100%' }}
            options={fkColumns}
            notFoundContent={fkTable ? '暂无字段数据' : '请先选择外键表'}
            disabled={!fkTable}
            onChange={(val) => handleForeignKeyChange(index, 'referenced_column', val || '')}
          />
        );
      }
    },
    { title: '描述', dataIndex: 'column_description', key: 'column_description', width: 80, align: 'center' as const,
      render: (text: string, _: any, index: number) => (
        <Popover
          trigger="click"
          placement="leftTop"
          open={descEditingIndex === index}
          onOpenChange={(visible) => {
            if (visible) {
              setDescEditingIndex(index);
              setDescEditingValue(text || '');
            } else if (descEditingIndex === index) {
              setDescEditingIndex(-1);
            }
          }}
          title="编辑字段描述"
          content={
            <div style={{ width: 280 }}>
              <TextArea
                rows={4}
                value={descEditingValue}
                onChange={e => setDescEditingValue(e.target.value)}
                placeholder="请输入字段描述"
                autoFocus
              />
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Space size={8}>
                  <Button size="small" onClick={() => setDescEditingIndex(-1)}>取消</Button>
                  <Button size="small" type="primary" onClick={() => {
                    handleColumnChange(index, 'column_description', descEditingValue);
                    setDescEditingIndex(-1);
                  }}>保存</Button>
                </Space>
              </div>
            </div>
          }
        >
          <Button
            type="text"
            size="small"
            icon={<FileTextOutlined />}
            style={text ? { color: 'var(--primary-color)' } : undefined}
          />
        </Popover>
      )
    },
  ];

  return (
    <Drawer
      title="编辑本体对象"
      width={700}
      open={open}
      onClose={handleClose}
      getContainer={false}
      contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
      styles={{ body: { padding: 24, background: 'var(--bg-color, inherit)', color: 'var(--text-color, inherit)' } }}
    >
      {editing && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>保存</Button>
          </div>
          <Form form={form} layout="vertical">
            <Form.Item label="表名">
              <Input value={editing.name} disabled />
            </Form.Item>
            <Form.Item name="title" label="表中文名称">
              <Input placeholder="请输入表中文名称" />
            </Form.Item>
            <Form.Item name="description" label="表描述">
              <TextArea rows={2} placeholder="请输入表描述" />
            </Form.Item>
          </Form>
          <div style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>字段列表</div>
            <Table
              dataSource={editing.content.columns || []}
              rowKey="column_name"
              size="small"
              pagination={false}
              columns={fieldColumns}
            />
          </div>
        </>
      )}
    </Drawer>
  );
};

const OntologyObjectPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [dsSearchText, setDsSearchText] = useState('');
  const [selectedDatasourceId, setSelectedDatasourceId] = useState<string>('');
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchName, setSearchName] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('ascend');
  const [pageSize, setPageSize] = useState(20);
  // 批量操作
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 编辑抽屉
  const [editVisible, setEditVisible] = useState(false);
  const [editObject, setEditObject] = useState<OntologyObject | null>(null);

  // 查询数据抽屉
  const [queryVisible, setQueryVisible] = useState(false);
  const [queryData, setQueryData] = useState<any[]>([]);
  const [queryColumns, setQueryColumns] = useState<string[]>([]);
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryRecord, setQueryRecord] = useState<OntologyObject | null>(null);
  const [customSql, setCustomSql] = useState('');

  // 添加本体弹窗
  const [batchVisible, setBatchVisible] = useState(false);
  const [tables, setTables] = useState<any[]>([]); // 完整表对象列表
  const [selectedTables, setSelectedTables] = useState<string[]>([]); // 选中的表名
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState('');
  const [fileFilterTables, setFileFilterTables] = useState<Set<string> | null>(null); // 通过文件过滤的表名集合
  const [previewTable, setPreviewTable] = useState<string>(''); // 当前预览的表名
  const [previewColumns, setPreviewColumns] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  // 编辑的表元数据 { table_name: { title, description, columns: [...] } }
  const [tableEdits, setTableEdits] = useState<Record<string, { title: string; description: string; columns: any[] }>>({});
  // 外键表字段缓存 { table_name: [{ column_name, ... }] }
  const [fkTableColumnsCache, setFkTableColumnsCache] = useState<Record<string, any[]>>({});
  // 批量创建进度
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  // 拖拽分隔线
  const [leftWidth, setLeftWidth] = useState(260);
  const dragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      if (newWidth >= 200 && newWidth <= rect.width - 300) {
        setLeftWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 主题检测
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

  // 加载数据源列表（仅关系型数据库）
  const loadDatasources = useCallback(async () => {
    try {
      const res = await datasourceService.getDatasources(undefined, 1, 100, undefined, undefined, 'mysql,postgresql,oracle,sql_server');
      const list = res.data || [];
      setDatasources(list);
      if (list.length > 0 && !selectedDatasourceId) {
        setSelectedDatasourceId(list[0].id);
      }
    } catch (e: any) {
      message.error('加载数据源列表失败');
    }
  }, []);

  // 名称搜索ref（失焦时才提交查询，避免每次输入触发请求）
  const searchNameRef = useRef<string>('');

  // 加载本体对象列表
  const loadObjects = useCallback(async () => {
    setLoading(true);
    try {
      const sortOrderStr = sortOrder === 'descend' ? 'desc' : 'asc';
      const res = await ontologyService.getObjects(selectedDatasourceId || undefined, page, pageSize, sortBy, sortOrderStr, searchNameRef.current || undefined);
      setObjects(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error('加载本体对象列表失败');
    }
    setLoading(false);
  }, [selectedDatasourceId, page, pageSize, sortBy, sortOrder]);

  useEffect(() => { loadDatasources(); }, [loadDatasources]);
  useEffect(() => { loadObjects(); }, [loadObjects]);

  // 点击数据源
  const handleDatasourceClick = (id: string) => {
    setSelectedDatasourceId(id);
    setPage(1);
  };

  // 添加本体
  const handleBatchAdd = async () => {
    if (!selectedDatasourceId) {
      message.warning('请先选择数据源');
      return;
    }
    setBatchVisible(true);
    setTablesLoading(true);
    setTableFilter('');
    setFileFilterTables(null);
    setSelectedTables([]);
    setPreviewTable('');
    setPreviewColumns([]);
    setTableEdits({});
    setFkTableColumnsCache({});
    try {
      const res = await datasourceService.listTables(selectedDatasourceId);
      setTables(res?.tables || []);
    } catch (e: any) {
      message.error(e.message || '获取表列表失败');
    }
    setTablesLoading(false);
  };

  // 预览表字段
  const handlePreviewTable = async (tableName: string) => {
    setPreviewTable(tableName);
    // 如果已有编辑数据，使用编辑数据
    if (tableEdits[tableName]) {
      setPreviewColumns(tableEdits[tableName].columns);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await datasourceService.getTableColumns(selectedDatasourceId, tableName);
      const cols = (res?.columns || []).map((col: any) => ({
        column_name: col.column_name || '',
        column_name_cn: col.column_comment || '',
        column_description: col.column_comment || '',
        data_type: col.data_type || col.column_type || '',
        is_primary_key: col.is_primary_key || col.column_key === 'PRI' || false,
        is_nullable: col.is_nullable !== 'NO',
        foreign_key: col.foreign_key || null,
      }));
      setPreviewColumns(cols);
      // 初始化编辑数据
      const tableInfo = tables.find(t => (t.table_name || t) === tableName);
      setTableEdits(prev => ({
        ...prev,
        [tableName]: {
          title: '',
          description: tableInfo?.table_comment || '',
          columns: cols,
        },
      }));
      // 预加载已有外键表的字段
      const fkTables = [...new Set(
        cols.map(c => c.foreign_key?.referenced_table).filter(Boolean)
      )];
      for (const fkTable of fkTables) {
        if (!tableEdits[fkTable] && !fkTableColumnsCache[fkTable]) {
          try {
            const fkRes = await datasourceService.getTableColumns(selectedDatasourceId, fkTable);
            const fkColList = (fkRes?.columns || []).map((col: any) => ({
              column_name: col.column_name || '',
              data_type: col.data_type || col.column_type || '',
            }));
            setFkTableColumnsCache(prev => ({ ...prev, [fkTable]: fkColList }));
          } catch {
            // 忽略加载失败
          }
        }
      }
    } catch (e: any) {
      message.error(e.message || '获取表字段失败');
    }
    setPreviewLoading(false);
  };

  // 编辑预览字段
  const handlePreviewColumnChange = (colIndex: number, field: string, value: any) => {
    if (!previewTable) return;
    const cols = [...previewColumns];
    cols[colIndex] = { ...cols[colIndex], [field]: value };
    setPreviewColumns(cols);
    setTableEdits(prev => ({
      ...prev,
      [previewTable]: { ...prev[previewTable], columns: cols },
    }));
  };

  const handlePreviewForeignKeyChange = async (colIndex: number, fkField: string, value: string) => {
    if (!previewTable) return;
    const cols = [...previewColumns];
    const fk = cols[colIndex].foreign_key || { referenced_table: '', referenced_column: '' };
    // 如果选了外键表，清空外键字段
    if (fkField === 'referenced_table' && value !== fk.referenced_table) {
      fk.referenced_column = '';
    }
    cols[colIndex] = { ...cols[colIndex], foreign_key: { ...fk, [fkField]: value } };
    setPreviewColumns(cols);
    setTableEdits(prev => ({
      ...prev,
      [previewTable]: { ...prev[previewTable], columns: cols },
    }));
    // 如果选了外键表，且该表字段未缓存，则加载
    if (fkField === 'referenced_table' && value && !fkTableColumnsCache[value] && !tableEdits[value]) {
      try {
        const res = await datasourceService.getTableColumns(selectedDatasourceId, value);
        const colList = (res?.columns || []).map((col: any) => ({
          column_name: col.column_name || '',
          data_type: col.data_type || col.column_type || '',
        }));
        setFkTableColumnsCache(prev => ({ ...prev, [value]: colList }));
      } catch {
        // 忽略加载失败
      }
    }
  };

  // 编辑预览表标题/描述（中文名为空时自动同步描述）
  const handlePreviewTableMetaChange = (field: string, value: string) => {
    if (!previewTable) return;
    setTableEdits(prev => {
      const current = prev[previewTable] || { title: '', description: '', columns: [] };
      const updated = { ...current, [field]: value };
      // 如果修改的是描述，且中文名为空，则自动同步
      if (field === 'description' && !updated.title) {
        updated.title = value;
      }
      return { ...prev, [previewTable]: updated };
    });
  };

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTables(filteredTables.map(t => t.table_name || t));
    } else {
      setSelectedTables([]);
    }
  };

  const filteredTables = tables.filter(t => {
    const name = t.table_name || t;
    const comment = t.table_comment || '';
    // 文件过滤优先：如果有文件过滤，只保留文件中包含的表（不区分大小写）
    if (fileFilterTables && fileFilterTables.size > 0) {
      if (!fileFilterTables.has(name.toLowerCase())) return false;
    }
    if (!tableFilter) return true;
    const filter = tableFilter.toLowerCase();
    return name.toLowerCase().includes(filter) || comment.toLowerCase().includes(filter);
  });

  const allChecked = filteredTables.length > 0 && filteredTables.every(t => selectedTables.includes(t.table_name || t));
  const someChecked = filteredTables.some(t => selectedTables.includes(t.table_name || t));

  const handleBatchConfirm = async () => {
    if (selectedTables.length === 0) {
      message.warning('请选择表');
      return;
    }
    try {
      setBatchCreating(true);
      setBatchProgress({ current: 0, total: selectedTables.length });

      // 为每个选中的表组装数据（不再前端查询字段，由后端按需查询）
      const objects = selectedTables.map(name => {
        const edits = tableEdits[name];
        if (edits && edits.columns && edits.columns.length > 0) {
          // 已预览/编辑过的表，发送编辑后的字段信息
          const buildColumns = (cols: any[]) => cols.map((col: any) => ({
            column_name: col.column_name || '',
            column_name_cn: col.column_comment || col.column_name_cn || '',
            column_description: col.column_comment || col.column_description || '',
            data_type: col.data_type || col.column_type || '',
            is_primary_key: col.is_primary_key || col.column_key === 'PRI' || false,
            is_nullable: col.is_nullable !== 'NO' && col.is_nullable !== false,
            foreign_key: col.foreign_key || null,
          }));
          return {
            name,
            title: edits.title || '',
            description: edits.description || '',
            content: {
              table_name: name,
              title: edits.title || '',
              description: edits.description || '',
              columns: buildColumns(edits.columns),
            },
          };
        } else {
          // 未预览的表，只发送基本信息，由后端查询字段
          const tableInfo = tables.find(t => (t.table_name || t) === name);
          return {
            name,
            title: '',
            description: tableInfo?.table_comment || '',
            content: {
              table_name: name,
              title: '',
              description: tableInfo?.table_comment || '',
              columns: [],
            },
          };
        }
      });

      setBatchProgress({ current: Math.ceil(selectedTables.length / 2), total: selectedTables.length });
      const results = await ontologyService.batchCreateObjects(selectedDatasourceId, objects);
      
      setBatchProgress({ current: selectedTables.length, total: selectedTables.length });
      
      if (results && results.length > 0) {
        message.success(`成功创建${results.length}个本体对象`);
      } else {
        message.warning('没有创建新的本体对象（可能已存在）');
      }
      setBatchVisible(false);
      setSelectedTables([]);
      setTableEdits({});
      setFkTableColumnsCache({});
      setFileFilterTables(null);
      setTableFilter('');
      loadObjects();
    } catch (e: any) {
      message.error(e.message || '创建失败');
    } finally {
      setBatchCreating(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // 编辑：打开抽屉，字段加载与编辑逻辑封装在子组件内
  const handleEdit = (record: OntologyObject) => {
    setEditObject(record);
    setEditVisible(true);
  };

  // 编辑抽屉保存（由子组件回调）
  const handleEditSave = async (id: string, values: { title: string; description: string; content: OntologyContent }) => {
    await ontologyService.updateObject(id, values);
    message.success('保存成功');
    loadObjects();
  };

  // 删除
  const handleDelete = (record: OntologyObject) => {
    Modal.confirm({
      title: '确认删除',
      okText: '确定',
      cancelText: '取消',
      content: `确定要删除本体对象 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await ontologyService.deleteObject(record.id);
          message.success('删除成功');
          loadObjects();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  // 批量删除
  const handleBatchDeleteObjects = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的本体对象');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个本体对象吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await ontologyService.batchDeleteObjects(selectedRowKeys.map(key => key as string));
          message.success('批量删除成功');
          setSelectedRowKeys([]);
          if (page !== 1) {
            setPage(1);
          } else {
            loadObjects();
          }
        } catch (e: any) {
          message.error(e.message || '批量删除失败');
        }
      },
    });
  };

  // 批量导出
  const handleBatchExportObjects = async (format: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要导出的本体对象');
      return;
    }
    try {
      const res = await ontologyService.batchExportObjects(selectedRowKeys.map(key => key as string), format);
      const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ontology_metadata_batch.${format === 'markdown' ? 'md' : 'json'}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (e: any) {
      message.error(e.message || '导出失败');
    }
  };

  // 同步
  const handleSync = async (record: OntologyObject) => {
    try {
      await ontologyService.syncObject(record.id);
      message.success('同步成功');
      loadObjects();
    } catch (e: any) {
      message.error(e.message || '同步失败');
    }
  };

  // 查询数据
  const handleQueryData = async (record: OntologyObject) => {
    setQueryVisible(true);
    setQueryRecord(record);
    setCustomSql(`SELECT * FROM ${record.name} LIMIT 10`);
    setQueryLoading(true);
    try {
      const res = await ontologyService.queryObjectData(record.id, 10);
      setQueryColumns(res.columns || []);
      setQueryData(res.rows || []);
    } catch (e: any) {
      message.error(e.message || '查询失败');
    }
    setQueryLoading(false);
  };

  // 执行自定义SQL
  const handleExecuteCustomSql = async () => {
    if (!queryRecord || !customSql.trim()) {
      message.warning('请输入SQL语句');
      return;
    }
    setQueryLoading(true);
    try {
      const res = await ontologyService.queryObjectData(queryRecord.id, 100, customSql);
      setQueryColumns(res.columns || []);
      setQueryData(res.rows || []);
      message.success('查询成功');
    } catch (e: any) {
      message.error(e.message || '查询失败');
    }
    setQueryLoading(false);
  };

  // 元数据导出
  const handleExport = async (record: OntologyObject, format: string) => {
    try {
      const res = await ontologyService.exportObjectMetadata(record.id, format);
      const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.name}_metadata.${format === 'markdown' ? 'md' : 'json'}`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (e: any) {
      message.error(e.message || '导出失败');
    }
  };

  // 查询数据列：固定列宽，内容超过宽度用 Tooltip 展示完整内容并支持复制
  const copyCellValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success('已复制');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); message.success('已复制'); }
      catch { message.error('复制失败'); }
      document.body.removeChild(ta);
    }
  };

  const queryTableColumns = queryColumns.map(col => ({
    title: col,
    dataIndex: col,
    key: col,
    width: 160,
    ellipsis: true,
    render: (value: any) => {
      const str = value === null || value === undefined ? '' : String(value);
      if (!str) return <Text type="secondary">-</Text>;
      return (
        <Tooltip
          title={
            <div style={{ maxWidth: 360, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                <span>{str}</span>
                <CopyOutlined style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => copyCellValue(str)} />
              </div>
            </div>
          }
          placement="topLeft"
          overlayStyle={{ maxWidth: 400 }}
        >
          <span style={{ cursor: 'default' }}>{str}</span>
        </Tooltip>
      );
    },
  }));

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 200, sorter: true, defaultSortOrder: 'ascend' as const },
    { title: '中文名', dataIndex: 'title', key: 'title', width: 200, sorter: true,
      render: (text: string) => text || <Text type="secondary">-</Text>
    },
    { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true, sorter: true,
      render: (text: string) => text || <Text type="secondary">-</Text>
    },
    {
      title: '操作', key: 'actions', width: 180, fixed: 'right' as const,
      render: (_: any, record: OntologyObject) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="同步">
            <Button type="text" size="small" icon={<SyncOutlined />} onClick={() => handleSync(record)} />
          </Tooltip>
          <Tooltip title="查询">
            <Button type="text" size="small" icon={<SearchOutlined />} onClick={() => handleQueryData(record)} />
          </Tooltip>
          <Dropdown menu={{
            items: [
              { key: 'json', label: 'JSON', onClick: () => handleExport(record, 'json') },
              { key: 'markdown', label: 'Markdown', onClick: () => handleExport(record, 'markdown') },
            ]
          }}>
            <Tooltip title="导出本体">
              <Button type="text" size="small" icon={<ExportOutlined />} />
            </Tooltip>
          </Dropdown>
          <Popconfirm
            title="确定要删除该本体对象吗？"
            onConfirm={() => handleDelete(record)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const getDatasourceIcon = (type: string) => {
    // 特殊类型映射
    const iconTypeMap: Record<string, string> = {
      's3': 'amazon_s3',
    };
    const mappedType = iconTypeMap[type] || type;
    return getDatasourceIconSvg(mappedType);
  };

  const getDatasourceTypeLabel = (type: string) => {
    const labelMap: Record<string, string> = {
      mysql: 'MySQL', postgresql: 'PostgreSQL', oracle: 'Oracle',
      sql_server: 'SQL Server', s3: 'S3', minio: 'MinIO', rustfs: 'RustFS', tavily: 'Tavily',
    };
    return labelMap[type] || type;
  };

  const filteredDatasources = datasources.filter(ds =>
    !dsSearchText || ds.name.toLowerCase().includes(dsSearchText.toLowerCase())
  );

  return (
    <Layout className="chat-layout" style={{ height: '100%' }}>
      {/* 左侧数据源列表 - 复用聊天样式 */}
      <LeftSider
        width={280}
        className={`chat-sider ${theme === 'dark' ? 'dark' : 'light'}`}
      >
        <div className={`chat-list ${theme === 'dark' ? 'dark' : 'light'}`}>
          <div className={`chat-list-header ${theme === 'dark' ? 'dark' : 'light'}`}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>数据源列表</span>
          </div>
          <div className="search-box">
            <Input
              placeholder="搜索数据源"
              prefix={<SearchOutlined />}
              value={dsSearchText}
              onChange={e => setDsSearchText(e.target.value)}
              allowClear
              className={`search-input ${theme === 'dark' ? 'dark' : 'light'}`}
            />
          </div>
          <div className={`conversation-list ${theme === 'dark' ? 'dark' : 'light'}`}>
            {filteredDatasources.length === 0 ? (
              <Empty description="暂无数据源" image={Empty.PRESENTED_IMAGE_SIMPLE} className={`empty-container ${theme === 'dark' ? 'dark' : 'light'}`} />
            ) : (
              filteredDatasources.map(ds => (
                <div
                  key={ds.id}
                  onClick={() => handleDatasourceClick(ds.id)}
                  className={`conversation-item ${theme === 'dark' ? 'dark' : 'light'} ${selectedDatasourceId === ds.id ? 'selected' : ''}`}
                >
                  <div className="conversation-icon">
                    <img src={getDatasourceIcon(ds.type)} alt={ds.type} style={{ width: 20, height: 20 }} />
                  </div>
                  <div className="conversation-content">
                    <div className="conversation-title" style={{ textAlign: 'left' }}>{ds.name}</div>
                    <div className="conversation-meta" style={{ justifyContent: 'flex-start' }}>
                      <span className="conversation-group">{getDatasourceTypeLabel(ds.type)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </LeftSider>

      {/* 右侧本体对象列表 */}
      <Content className={`chat-content ${theme === 'dark' ? 'dark' : 'light'}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleBatchAdd} disabled={!selectedDatasourceId}>
            添加本体
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDeleteObjects}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除 ({selectedRowKeys.length})
          </Button>
          <Dropdown
            menu={{
              items: [
                { key: 'json', label: 'JSON', onClick: () => handleBatchExportObjects('json') },
                { key: 'markdown', label: 'Markdown', onClick: () => handleBatchExportObjects('markdown') },
              ],
            }}
          >
            <Button icon={<ExportOutlined />} disabled={selectedRowKeys.length === 0}>
              导出本体 ({selectedRowKeys.length}) <DownOutlined />
            </Button>
          </Dropdown>
          <Input
            placeholder="搜索名称/中文名/描述"
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            onBlur={() => {
              searchNameRef.current = searchName;
              if (page === 1) {
                loadObjects();
              } else {
                setPage(1);
              }
            }}
            onPressEnter={() => {
              searchNameRef.current = searchName;
              if (page === 1) {
                loadObjects();
              } else {
                setPage(1);
              }
            }}
            prefix={<SearchOutlined />}
            style={{
              width: 200,
              height: 36,
              borderRadius: 18,
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
              color: theme === 'dark' ? '#ffffff' : '#000000',
            }}
            allowClear
          />
          <Button icon={<ClearOutlined />} onClick={() => {
            setSearchName('');
            searchNameRef.current = '';
            setSelectedRowKeys([]);
            if (page !== 1) {
              setPage(1);
            } else {
              loadObjects();
            }
          }}>清空</Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            if (page !== 1) {
              setPage(1);
            } else {
              loadObjects();
            }
          }}>刷新</Button>
        </div>
        <div style={{ flex: 1, padding: '0 16px', minHeight: 0 }}>
        <Table
          dataSource={objects}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          locale={{ emptyText: '暂无本体对象，请先选择数据源并批量添加' }}
          pagination={false}
          scroll={{ x: 800, y: 'calc(100vh - 280px)' }}
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
            preserveSelectedRowKeys: true,
          }}
          onChange={(_pagination, _filters, sorter: any) => {
            if (sorter && sorter.field) {
              setSortBy(sorter.field as string);
              setSortOrder(sorter.order as 'ascend' | 'descend' || 'ascend');
              setPage(1);
            }
          }}
        />
        </div>
        <div style={{ paddingTop: '16px', paddingBottom: '16px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={(p) => setPage(p)}
            onShowSizeChange={(_current, size) => {
              setPageSize(size);
              setPage(1);
            }}
            showTotal={(t) => `共 ${t} 条记录`}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '40', '60', '80']}
            locale={{
              items_per_page: '条/页',
              jump_to: '前往',
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
            className={`pagination ${theme === 'dark' ? 'dark' : 'light'}`}
            style={{ margin: 0 }}
          />
        </div>
      </Content>

      {/* 编辑抽屉（独立子组件，隔离重渲染） */}
      <OntologyEditDrawer
        open={editVisible}
        object={editObject}
        datasourceId={selectedDatasourceId}
        onClose={() => { setEditVisible(false); setEditObject(null); }}
        onSave={handleEditSave}
      />

      {/* 查询数据抽屉 */}
      <Drawer
        title="查询数据"
        width={800}
        open={queryVisible}
        onClose={() => setQueryVisible(false)}
        getContainer={false}
        contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
        styles={{ body: { padding: 24, background: 'var(--bg-color, inherit)', color: 'var(--text-color, inherit)' } }}
      >
        <Spin spinning={queryLoading}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
              <TextArea
                value={customSql}
                onChange={e => setCustomSql(e.target.value)}
                placeholder="请输入SQL语句（仅支持SELECT查询）"
                autoSize={{ minRows: 2, maxRows: 6 }}
                style={{ flex: 1 }}
              />
              <Button type="primary" onClick={handleExecuteCustomSql}>执行</Button>
            </div>
          </div>
          <Table
            dataSource={queryData}
            rowKey={(_, index) => String(index)}
            size="small"
            pagination={false}
            scroll={{ x: queryColumns.length * 160, y: 'calc(100vh - 300px)' }}
            locale={{ emptyText: '暂无数据' }}
            columns={queryTableColumns}
          />
        </Spin>
      </Drawer>

      {/* 添加本体弹窗 */}
      <Modal
        title="添加本体"
        open={batchVisible}
        onOk={handleBatchConfirm}
        onCancel={() => { setBatchVisible(false); setSelectedTables([]); setTableEdits({}); setFkTableColumnsCache({}); setPreviewTable(''); setFileFilterTables(null); setTableFilter(''); }}
        okText={batchCreating ? '创建中...' : '确定'}
        cancelText="取消"
        width={1150}
        confirmLoading={batchCreating}
        okButtonProps={{ disabled: batchCreating }}
        cancelButtonProps={{ disabled: batchCreating }}
      >
        {/* 进度条 */}
        {batchCreating && batchProgress.total > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Progress
              percent={Math.round((batchProgress.current / batchProgress.total) * 100)}
              format={percent => `正在创建 ${batchProgress.current}/${batchProgress.total} (${percent}%)`}
              status="active"
            />
          </div>
        )}
        <div ref={containerRef} style={{ display: 'flex', height: 480 }}>
          {/* 左侧：表列表 */}
          <div style={{ width: leftWidth, minWidth: 200, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e8e8e8', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Checkbox
                checked={allChecked}
                indeterminate={!allChecked && someChecked}
                onChange={e => handleSelectAll(e.target.checked)}
              />
              <Input
                placeholder="搜索表名"
                size="small"
                prefix={<SearchOutlined />}
                value={tableFilter}
                onChange={e => setTableFilter(e.target.value)}
                allowClear
                style={{ flex: 1, minWidth: 100 }}
              />
              <Upload
                accept=".txt"
                showUploadList={false}
                beforeUpload={(file) => {
                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const text = (e.target?.result as string) || '';
                    const names = text.split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(Boolean);
                    if (names.length === 0) {
                      message.warning('文件为空，请上传包含表名的txt文件');
                      return;
                    }
                    const nameSet = new Set(names);
                    const matchedCount = tables.filter(t => nameSet.has((t.table_name || t).toLowerCase())).length;
                    setFileFilterTables(nameSet);
                    message.success(`文件中 ${names.length} 个表名，匹配到 ${matchedCount} 个`);
                  };
                  reader.readAsText(file);
                  return false;
                }}
              >
                <Button size="small" icon={<UploadOutlined />}>通过文件过滤</Button>
              </Upload>
              {fileFilterTables && (
                <Button
                  size="small"
                  icon={<ClearOutlined />}
                  onClick={() => { setFileFilterTables(null); message.success('已清除文件过滤'); }}
                >
                  清空文件过滤
                </Button>
              )}
              <Button size="small" onClick={() => setSelectedTables([])}>清空已选</Button>
              <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>
                已选 {selectedTables.length}/{tables.length}
              </span>
            </div>
            <Spin spinning={tablesLoading}>
              <div style={{ maxHeight: 420, overflow: 'auto' }}>
                {filteredTables.length === 0 && !tablesLoading ? (
                  <Empty description="暂无可用表" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
                ) : (
                  filteredTables.map(table => {
                    const name = table.table_name || table;
                    const comment = table.table_comment || '';
                    const checked = selectedTables.includes(name);
                    const isPreview = previewTable === name;
                    return (
                      <div
                        key={name}
                        onClick={() => handlePreviewTable(name)}
                        style={{
                          padding: '8px 12px',
                          height: 52,
                        boxSizing: 'border-box',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        background: isPreview ? (theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f0f5ff') : 'transparent',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <Checkbox
                            checked={checked}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedTables(prev => [...prev, name]);
                              } else {
                                setSelectedTables(prev => prev.filter(t => t !== name));
                              }
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                          <Tooltip title={name} placement="topLeft">
                            <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          </Tooltip>
                        </div>
                        {comment && (
                          <div style={{ marginLeft: 24, fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comment}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Spin>
          </div>

          {/* 拖拽分隔线 */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              width: 4,
              cursor: 'col-resize',
              background: 'transparent',
              flexShrink: 0,
              margin: '0 1px',
              borderRadius: 2,
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => { (e.target as HTMLElement).style.background = '#d0d0d0'; }}
            onMouseOut={(e) => { if (!dragRef.current) (e.target as HTMLElement).style.background = 'transparent'; }}
          />

          {/* 右侧：表元数据和字段信息 */}
          <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', border: '1px solid #e8e8e8', borderRadius: 6, overflow: 'hidden' }}>
            {!previewTable ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Empty description="请从左侧选择表查看详情" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <Spin spinning={previewLoading}>
                <div style={{ padding: 12, overflow: 'auto', maxHeight: 480 }}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>表名：</Text>
                    <Text code>{previewTable}</Text>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>中文名称</div>
                    <Input
                      size="small"
                      placeholder="请输入中文名称"
                      value={tableEdits[previewTable]?.title || ''}
                      onChange={e => handlePreviewTableMetaChange('title', e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ marginBottom: 4, fontSize: 13, fontWeight: 500 }}>描述</div>
                    <Input.TextArea
                      rows={2}
                      size="small"
                      placeholder="请输入描述"
                      value={tableEdits[previewTable]?.description || ''}
                      onChange={e => handlePreviewTableMetaChange('description', e.target.value)}
                    />
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>字段列表</div>
                  <Table
                    dataSource={previewColumns}
                    rowKey="column_name"
                    size="small"
                    pagination={false}
                    scroll={{ x: 600 }}
                    columns={[
                      { title: '字段名', dataIndex: 'column_name', key: 'column_name', width: 120,
                        render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>
                      },
                      { title: '中文名', dataIndex: 'column_name_cn', key: 'column_name_cn', width: 100,
                        render: (text: string, _: any, index: number) => (
                          <Input size="small" value={text} placeholder="中文名"
                            onChange={e => handlePreviewColumnChange(index, 'column_name_cn', e.target.value)} />
                        )
                      },
                      { title: '类型', dataIndex: 'data_type', key: 'data_type', width: 90,
                        render: (text: string) => <span style={{ fontSize: 12 }}>{text}</span>
                      },
                      { title: '主键', dataIndex: 'is_primary_key', key: 'is_primary_key', width: 50,
                        render: (val: boolean, _: any, index: number) => (
                          <Checkbox checked={val} size="small"
                            onChange={e => handlePreviewColumnChange(index, 'is_primary_key', e.target.checked)} />
                        )
                      },
                      { title: '外键表', key: 'fk_table', width: 120,
                        render: (_: any, record: any, index: number) => (
                          <Select
                            size="small"
                            value={record.foreign_key?.referenced_table || undefined}
                            placeholder="请选择外键表"
                            showSearch
                            allowClear
                            style={{ width: '100%' }}
                            options={tables.map(t => ({ label: t.table_name || t, value: t.table_name || t }))}
                            notFoundContent="暂无表数据"
                            onChange={(val) => handlePreviewForeignKeyChange(index, 'referenced_table', val || '')}
                          />
                        )
                      },
                      { title: '外键字段', key: 'fk_column', width: 120,
                        render: (_: any, record: any, index: number) => {
                          const fkTable = record.foreign_key?.referenced_table;
                          // 优先从tableEdits获取，其次从fkTableColumnsCache获取
                          const cols = fkTable
                            ? (tableEdits[fkTable]?.columns || fkTableColumnsCache[fkTable] || [])
                            : [];
                          const fkColumns = cols.map((c: any) => ({ label: c.column_name, value: c.column_name }));
                          return (
                            <Select
                              size="small"
                              value={record.foreign_key?.referenced_column || undefined}
                              placeholder={fkTable ? '请选择外键字段' : '请先选择外键表'}
                              showSearch
                              allowClear
                              style={{ width: '100%' }}
                              options={fkColumns}
                              notFoundContent="暂无字段数据"
                              disabled={!fkTable}
                              onChange={(val) => handlePreviewForeignKeyChange(index, 'referenced_column', val || '')}
                            />
                          );
                        }
                      },
                    ]}
                  />
                </div>
              </Spin>
            )}
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default OntologyObjectPage;