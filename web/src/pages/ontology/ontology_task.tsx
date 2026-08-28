import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Drawer, Input, message, Modal, Space, Tag, Steps,
  Form, Select, Radio, Checkbox, Descriptions, Typography, Empty, Pagination, Tooltip, Popover, Popconfirm,
  Dropdown, Switch
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  ReloadOutlined, EyeOutlined, RedoOutlined, EditOutlined, DownOutlined, TableOutlined,
  CopyOutlined, RightOutlined
} from '@ant-design/icons';
import { ontologyService, OntologyTask, OntologyObject, ExportFormat, TaskResult } from '../../services/ontology';
import { datasourceService, Datasource } from '../../services/datasource';

const { Text, Link } = Typography;

/** 耗时（数据库存毫秒）转为秒显示 */
const formatDurationSeconds = (ms?: number | null): string => {
  if (ms == null || ms < 0) return '-';
  return `${(ms / 1000).toFixed(2)}秒`;
};

const { TextArea } = Input;

const statusColorMap: Record<string, string> = {
  pending: 'default', waiting: 'warning', running: 'processing',
  cancel: 'default', done: 'success', fail: 'error', schedule: 'purple',
};

const statusLabelMap: Record<string, string> = {
  pending: '未开始', waiting: '等待执行', running: '运行中',
  cancel: '已取消', done: '已完成', fail: '失败', schedule: '定时调度',
};

const OntologyTaskPage: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [tasks, setTasks] = useState<OntologyTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchName, setSearchName] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(20);

  // 创建任务弹窗
  const [createVisible, setCreateVisible] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createForm] = Form.useForm();
  // 创建模式：single(单个创建) | batch(批量创建) | null(编辑模式)
  const [createMode, setCreateMode] = useState<'single' | 'batch' | null>(null);
  // 批量创建时选中的本体对象列表及各自的字段配置
  const [batchObjectIds, setBatchObjectIds] = useState<string[]>([]);
  const [batchColumnsMap, setBatchColumnsMap] = useState<Record<string, string[]>>({});
  // 字段配置步骤中已展开字段列表的对象（默认收起）
  const [expandedFieldObjs, setExpandedFieldObjs] = useState<string[]>([]);
  // 订阅导出格式字段变化，切换时联动显示对应样例
  const exportFormatValue = Form.useWatch('export_format', createForm);
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  const [taskType, setTaskType] = useState<'object' | 'sql'>('object');
  // 选中的本体对象及字段选择
  const [selectedObject, setSelectedObject] = useState<OntologyObject | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  // 编辑任务
  const [editingTask, setEditingTask] = useState<OntologyTask | null>(null);
  // 结果查看抽屉
  const [resultVisible, setResultVisible] = useState(false);
  const [resultData, setResultData] = useState<TaskResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ontologyService.getTasks(searchName || undefined, page, pageSize);
      setTasks(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error('加载任务列表失败');
    }
    setLoading(false);
  }, [searchName, page, pageSize]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

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

  // 已触发自动下载的本体任务id集合（避免重复下载）
  const autoDownloadedRef = useRef<Set<string>>(new Set());
  // 正在处理中的自动下载任务（防止SSE重复事件触发多次后端查询/下载）
  const autoDownloadPendingRef = useRef<Set<string>>(new Set());
  // 执行过的任务（含跨页选中）的auto_download缓存：task_id -> { auto_download: boolean, name: string }
  // 批量执行/单个执行提交成功后写入，SSE事件到达时优先读取，不依赖当前页数据也不请求后端
  const executedTaskConfigsRef = useRef<Map<string, { auto_download: boolean; name: string }>>(new Map());
  const tasksRef = useRef<OntologyTask[]>(tasks);
  tasksRef.current = tasks;

  /** 记录要执行的任务配置（在批量执行/单个执行提交成功后调用） */
  const rememberExecutedTaskConfig = useCallback((taskId: string, cfg: { auto_download: boolean; name: string }) => {
    executedTaskConfigsRef.current.set(taskId, cfg);
  }, []);

  /** 本体任务自动下载：fetch获取blob后用同源blob URL触发下载，不跳转、不弹框。
   *  后端返回文件404时最多重试2次（间隔1.5s），应对_task_output/Redis结果未落盘的短暂竞态。 */
  const triggerOntologyAutoDownload = useCallback(async (ontologyTaskId: string, fileName?: string) => {
    if (autoDownloadedRef.current.has(ontologyTaskId)) return;
    autoDownloadedRef.current.add(ontologyTaskId);
    const maxRetry = 2;
    for (let attempt = 0; attempt <= maxRetry; attempt++) {
      try {
        const { blob, fileName: backendName } = await ontologyService.downloadTaskResult(ontologyTaskId);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = backendName || fileName || 'result';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        console.info(`[ontology_auto_download] ✅ 下载成功 task=${ontologyTaskId} 文件=${a.download}`);
        return;
      } catch (e: any) {
        const isNotFound = /404|不存在|已过期/.test(e?.message || '');
        if (attempt < maxRetry && isNotFound) {
          console.info(`[ontology_auto_download] 重试(${attempt + 1}/${maxRetry}) task=${ontologyTaskId}: ${e?.message}`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        console.warn('[ontology_auto_download] failed:', e);
        message.error(`自动下载失败：${e?.message || '未知错误'}`);
        return;
      }
    }
  }, []);

  // SSE订阅任务事件，运行中任务状态/进度实时推送
  useEffect(() => {
    const eventSource = new EventSource(ontologyService.getTaskEventsUrl());
    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        const isTerminal = ['done', 'success', 'fail', 'cancel', 'error'].includes(data.status);
        const isSuccess = data.status === 'done' || data.status === 'success';
        setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === data.task_id) {
            return {
              ...task,
              status: data.status,
              status_label: statusLabelMap[data.status] || data.status,
              task_progress: data.task_progress,
              task_progress_message: data.task_progress_message,
            };
          }
          return task;
        }));
        if (isSuccess
            && !autoDownloadedRef.current.has(data.task_id)
            && !autoDownloadPendingRef.current.has(data.task_id)) {
          autoDownloadPendingRef.current.add(data.task_id);
          (async () => {
            try {
              let task = tasksRef.current.find(t => t.id === data.task_id);
              if (!task) {
                task = await ontologyService.getTask(data.task_id);
              }
              if (task?.configs?.auto_download) {
                triggerOntologyAutoDownload(data.task_id, `${task.name}`);
              }
            } catch (e) {
              console.warn('[ontology_auto_download] check failed:', e);
            } finally {
              autoDownloadPendingRef.current.delete(data.task_id);
            }
          })();
        }
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    });
    eventSource.onerror = () => {
      // EventSource 断线后浏览器会自动重连，此处仅记录
    };
    return () => eventSource.close();
  }, []);

  // 打开创建/编辑弹窗
  const handleOpenCreate = async (mode?: 'single' | 'batch', task?: OntologyTask) => {
    setCreateStep(0);
    setSelectedObject(null);
    setSelectedColumns([]);
    setBatchObjectIds([]);
    setBatchColumnsMap({});
    createForm.resetFields();
    // 防御性检查：必须是有效的任务对象（含id），而非事件对象等其他类型
    const isEditMode = !!(task && task.id);
    if (isEditMode) {
      // 编辑模式
      setCreateMode(null);
      setEditingTask(task);
      const cfg = task.configs || {};
      const isSql = !!cfg.custom_sql;
      setTaskType(isSql ? 'sql' : 'object');
      createForm.setFieldsValue({
        name: task.name,
        datasource_id: task.datasource_id,
        ontology_object_id: cfg.ontology_object_id,
        custom_sql: cfg.custom_sql,
        export_format: cfg.export_format,
        auto_download: !!cfg.auto_download,
      });
      // 加载数据源（仅关系型数据库）
      try {
        const res = await datasourceService.getDatasources(undefined, 1, 100, undefined, undefined, 'mysql,postgresql,oracle,sql_server');
        setDatasources(res.data || []);
      } catch (e) {}
      // 加载本体对象
      if (!isSql && task.datasource_id) {
        try {
          const res = await ontologyService.getObjects(task.datasource_id, 1, 100);
          const objList = res.data || [];
          setObjects(objList);
          const obj = objList.find(o => o.id === cfg.ontology_object_id) || null;
          setSelectedObject(obj);
          if (obj) {
            const cols = obj.content?.columns || [];
            const selectedCols = cfg.columns || cols.map(c => c.column_name);
            setSelectedColumns(selectedCols);
          }
        } catch (e) {}
      }
    } else {
      // 创建模式
      setCreateMode(mode || 'single');
      setEditingTask(null);
      setTaskType('object');
      // 加载数据源（仅关系型数据库）
      try {
        const res = await datasourceService.getDatasources(undefined, 1, 100, undefined, undefined, 'mysql,postgresql,oracle,sql_server');
        setDatasources(res.data || []);
      } catch (e) {}
    }
    // 加载导出格式
    try {
      const res = await ontologyService.getExportFormats();
      const formats = res.formats || [];
      setExportFormats(formats);
      // 默认选中第一个导出格式，保证格式样例可见
      if (formats.length > 0 && !createForm.getFieldValue('export_format')) {
        createForm.setFieldValue('export_format', formats[0].value);
      }
    } catch (e) {}
    setCreateVisible(true);
  };

  // 编辑任务（运行中的任务不可编辑）
  const handleEditTask = (record: OntologyTask) => {
    if (record.status === 'running') {
      message.warning('任务运行中，暂不可编辑');
      return;
    }
    handleOpenCreate(undefined, record);
  };

  // 选择数据源后加载本体对象
  const handleDatasourceChange = async (dsId: string) => {
    setSelectedObject(null);
    setSelectedColumns([]);
    setBatchObjectIds([]);
    setBatchColumnsMap({});
    setObjects([]);
    if (!dsId) return;
    try {
      const res = await ontologyService.getObjects(dsId, 1, 100);
      setObjects(res.data || []);
    } catch (e) {}
  };

  // 选择本体对象：展示字段列表并默认全选
  const handleObjectChange = (objectId: string) => {
    const obj = objects.find(o => o.id === objectId) || null;
    setSelectedObject(obj);
    const cols = obj?.content?.columns || [];
    setSelectedColumns(cols.map(c => c.column_name));
    // 需求3：单个创建模式下，任务名称为空时自动填充为对象名称
    if (createMode === 'single' && obj) {
      const currentName = createForm.getFieldValue('name');
      if (!currentName || currentName.trim() === '') {
        createForm.setFieldValue('name', obj.name);
      }
    }
  };

  // 批量创建：选中/取消选中本体对象时，初始化字段配置
  const handleBatchObjectsChange = (objectIds: string[]) => {
    setBatchObjectIds(objectIds);
    // 为新选中的对象初始化字段配置（默认全选）
    const newMap = { ...batchColumnsMap };
    objectIds.forEach(id => {
      if (!newMap[id]) {
        const obj = objects.find(o => o.id === id);
        const cols = obj?.content?.columns || [];
        newMap[id] = cols.map(c => c.column_name);
      }
    });
    // 移除已取消选中的对象的字段配置
    Object.keys(newMap).forEach(id => {
      if (!objectIds.includes(id)) {
        delete newMap[id];
      }
    });
    setBatchColumnsMap(newMap);
  };

  // 批量创建：切换某个对象的全选状态
  const handleBatchSelectAll = (objectId: string, checked: boolean) => {
    const obj = objects.find(o => o.id === objectId);
    const cols = obj?.content?.columns || [];
    const newMap = { ...batchColumnsMap };
    newMap[objectId] = checked ? cols.map(c => c.column_name) : [];
    setBatchColumnsMap(newMap);
  };

  // 批量创建：切换某个对象的单个字段
  const handleBatchColumnToggle = (objectId: string, columnName: string, checked: boolean) => {
    const newMap = { ...batchColumnsMap };
    const current = newMap[objectId] || [];
    if (checked) {
      newMap[objectId] = [...current, columnName];
    } else {
      newMap[objectId] = current.filter(c => c !== columnName);
    }
    setBatchColumnsMap(newMap);
  };

  // 批量创建：切换对象字段列表的展开/收起状态
  const toggleFieldExpand = (objectId: string) => {
    setExpandedFieldObjs(prev =>
      prev.includes(objectId) ? prev.filter(id => id !== objectId) : [...prev, objectId]
    );
  };

  // 步骤条点击跳转
  const handleStepChange = (step: number) => {
    setCreateStep(step);
  };

  // 保存时校验全部必填参数（步骤条可跳转，需跨步骤校验）
  const validateAllFields = (): boolean => {
    const values = createForm.getFieldsValue(true);
    // 第1步必填项
    if (!values.datasource_id) {
      message.warning('请选择数据源');
      setCreateStep(0);
      return false;
    }
    if (createMode === 'batch') {
      // 批量创建：任务名称（前缀）+ 本体对象列表
      if (!values.name?.trim()) {
        message.warning('请输入任务名称前缀');
        setCreateStep(0);
        return false;
      }
      if (batchObjectIds.length === 0) {
        message.warning('请至少选择一个本体对象');
        setCreateStep(0);
        return false;
      }
    } else {
      // 单个创建/编辑
      if (!values.name?.trim()) {
        message.warning('请输入任务名称');
        setCreateStep(0);
        return false;
      }
      if (taskType === 'object' && !values.ontology_object_id) {
        message.warning('请选择本体对象');
        setCreateStep(0);
        return false;
      }
      if (taskType === 'sql' && !values.custom_sql?.trim()) {
        message.warning('请输入自定义SQL');
        setCreateStep(0);
        return false;
      }
    }
    // 批量创建：第1.5步（字段配置）需确保每个对象至少选一个字段
    if (createMode === 'batch' && createStep >= 1) {
      for (const objId of batchObjectIds) {
        const cols = batchColumnsMap[objId] || [];
        if (cols.length === 0) {
          const obj = objects.find(o => o.id === objId);
          message.warning(`对象 "${obj?.name}" 至少需要选择一个抽取字段`);
          setCreateStep(1);
          return false;
        }
      }
    }
    // 导出格式检查在对应步骤
    const formatStep = createMode === 'batch' ? 2 : 1;
    if (!values.export_format && createStep >= formatStep) {
      message.warning('请选择导出格式');
      setCreateStep(formatStep);
      return false;
    }
    return true;
  };

  // 获取当前模式的步骤数
  const getStepCount = () => {
    if (createMode === 'batch') return 3;
    return 2;
  };

  const handleNextStep = () => {
    const stepCount = getStepCount();
    if (createStep < stepCount - 1) {
      setCreateStep(createStep + 1);
    }
  };

  const handleCreateTask = async () => {
    if (!validateAllFields()) return;
    try {
      const values = createForm.getFieldsValue(true);

      if (createMode === 'batch') {
        // 批量创建：每个本体对象保存为一个独立任务
        const exportFormat = values.export_format;
        const baseName = values.name.trim();
        let successCount = 0;
        let failCount = 0;

        for (const objId of batchObjectIds) {
          const obj = objects.find(o => o.id === objId);
          if (!obj) { failCount++; continue; }

          const selectedCols = batchColumnsMap[objId] || [];
          const allCols = (obj.content?.columns || []).map(c => c.column_name);
          const configs: Record<string, any> = {
            export_format: exportFormat,
            ontology_object_id: objId,
          };
          if (values.auto_download) configs.auto_download = true;
          if (selectedCols.length > 0 && selectedCols.length < allCols.length) {
            configs.columns = selectedCols;
          }

          const taskName = `${baseName}_${obj.name}`;
          try {
            await ontologyService.createTask({
              name: taskName,
              datasource_id: values.datasource_id,
              configs,
            });
            successCount++;
          } catch (e) {
            console.error(`批量创建任务失败: ${taskName}, error: ${e}`);
            failCount++;
          }
        }

        if (failCount > 0) {
          message.warning(`批量创建完成：成功${successCount}个，失败${failCount}个`);
        } else {
          message.success(`批量创建成功：共${successCount}个任务`);
        }
      } else {
        // 单个创建或编辑
        const configs: Record<string, any> = {
          export_format: values.export_format,
        };
        if (values.auto_download) configs.auto_download = true;
        if (taskType === 'object') {
          configs.ontology_object_id = values.ontology_object_id;
          if (selectedObject) {
            const allCols = (selectedObject.content?.columns || []).map(c => c.column_name);
            if (selectedColumns.length > 0 && selectedColumns.length < allCols.length) {
              configs.columns = selectedColumns;
            }
          }
        } else {
          configs.custom_sql = values.custom_sql;
          delete configs.ontology_object_id;
        }
        if (editingTask) {
          await ontologyService.updateTask(editingTask.id, {
            name: values.name,
            datasource_id: values.datasource_id,
            configs,
          });
          message.success('任务更新成功');
        } else {
          await ontologyService.createTask({
            name: values.name,
            datasource_id: values.datasource_id,
            configs,
          });
          message.success('任务创建成功');
        }
      }
      setCreateVisible(false);
      loadTasks();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败
      message.error(e.message || (editingTask ? '更新失败' : '创建失败'));
    }
  };

  // 启动任务
  const handleStart = async (record: OntologyTask) => {
    try {
      await ontologyService.startTask(record.id);
      message.success('任务提交成功');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '启动失败');
    }
  };

  // 停止任务
  const handleStop = async (record: OntologyTask) => {
    try {
      await ontologyService.stopTask(record.id);
      message.success('任务已停止');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '停止失败');
    }
  };

  // 重新执行
  const handleRerun = async (record: OntologyTask) => {
    try {
      await ontologyService.rerunTask(record.id);
      message.success('任务提交成功');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  // 批量执行（跳过运行中/等待执行的任务，加入队列，默认同时最多执行5个）
  const handleBatchExecute = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要执行的任务');
      return;
    }
    Modal.confirm({
      title: '批量执行',
      okText: '确定',
      cancelText: '取消',
      content: `确定要执行选中的 ${selectedRowKeys.length} 个任务吗？（运行中/等待执行的任务将被跳过，同时最多执行5个，超出的排队等待）`,
      onOk: async () => {
        try {
          const result = await ontologyService.batchExecuteTasks(selectedRowKeys);
          const successCount = result.success?.length || 0;
          const skippedCount = result.skipped?.length || 0;
          const failedCount = result.failed?.length || 0;
          if (failedCount > 0) {
            message.warning(`批量执行完成：成功${successCount}个，跳过${skippedCount}个，失败${failedCount}个`);
          } else if (skippedCount > 0) {
            message.warning(`批量执行完成：成功${successCount}个，跳过${skippedCount}个`);
          } else {
            message.success(`批量执行成功：${successCount}个`);
          }
          setSelectedRowKeys([]);
          loadTasks();
        } catch (e: any) {
          message.error(e.message || '批量执行失败');
        }
      },
    });
  };

  // 查看结果
  const handleViewResult = async (record: OntologyTask) => {
    setResultVisible(true);
    setResultLoading(true);
    try {
      const res = await ontologyService.getTaskResult(record.id);
      setResultData(res);
    } catch (e: any) {
      message.error(e.message || '获取结果失败');
    }
    setResultLoading(false);
  };

  // 下载结果文件
  const handleDownloadResult = () => {
    if (resultData?.file_base64) {
      const byteChars = atob(resultData.file_base64);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNums[i] = byteChars.charCodeAt(i);
      }
      const byteArr = new Uint8Array(byteNums);
      const blob = new Blob([byteArr]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resultData.file_name || 'result';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // 删除单个任务
  const handleDelete = (record: OntologyTask) => {
    Modal.confirm({
      title: '确认删除',
      okText: '确定',
      cancelText: '取消',
      content: `确定要删除任务 "${record.name}" 吗？`,
      onOk: async () => {
        try {
          await ontologyService.deleteTask(record.id);
          message.success('删除成功');
          loadTasks();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  // 批量删除
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的任务');
      return;
    }
    Modal.confirm({
      title: '批量删除',
      okText: '确定',
      cancelText: '取消',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个任务吗？（跳过正在运行的任务）`,
      onOk: async () => {
        try {
          await ontologyService.batchDeleteTasks(selectedRowKeys);
          message.success('删除成功');
          setSelectedRowKeys([]);
          loadTasks();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '数据源', dataIndex: 'datasource_name', key: 'datasource_name', width: 150,
      render: (text: string) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 140,
      render: (status: string, record: OntologyTask) => {
        const progress = Math.round((record.task_progress || 0) * 100);
        const isRunning = status === 'running' || status === 'waiting';
        const statusTag = (
          <Tag color={statusColorMap[status] || 'default'}>
            {isRunning ? `${record.status_label} ${progress}%` : record.status_label}
          </Tag>
        );

        const popoverContent = (
          <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
            <Descriptions size="small" column={1} style={{ width: '400px' }}>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColorMap[status] || 'default'}>{record.status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="进度">{((record.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
              {record.task_progress_message && (
                <Descriptions.Item label="日志">
                  <div style={{ maxWidth: '360px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '250px', overflowY: 'auto' }}>
                    {record.task_progress_message}
                  </div>
                </Descriptions.Item>
              )}
              {record.task_begin_at && (
                <Descriptions.Item label="开始时间">{record.task_begin_at}</Descriptions.Item>
              )}
              {record.task_end_at && (
                <Descriptions.Item label="结束时间">{record.task_end_at}</Descriptions.Item>
              )}
              <Descriptions.Item label="耗时">{formatDurationSeconds(record.task_duration)}</Descriptions.Item>
            </Descriptions>
          </div>
        );

        return (
          <Popover
            content={popoverContent}
            title="任务详情"
            placement="top"
            trigger="hover"
            getPopupContainer={() => document.body}
          >
            {statusTag}
          </Popover>
        );
      },
    },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right',
      render: (_: any, record: OntologyTask) => (
        <Space size={4}>
          {(record.status === 'pending' || record.status === 'waiting') && (
            <Tooltip title={record.status === 'waiting' ? '已在执行队列中' : '开始'}>
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleStart(record)}
              />
            </Tooltip>
          )}
          {(record.status === 'running' || record.status === 'waiting') && (
            <Tooltip title="停止">
              <Button
                type="text"
                size="small"
                icon={<PauseCircleOutlined />}
                style={{ color: '#1890ff' }}
                onClick={() => handleStop(record)}
              />
            </Tooltip>
          )}
          {(record.status === 'done' || record.status === 'fail' || record.status === 'cancel') && (
            <Tooltip title="重新执行">
              <Popconfirm
                title="确认重新执行"
                description="确定要重新执行该任务吗？"
                okText="确定"
                cancelText="取消"
                onConfirm={() => handleRerun(record)}
              >
                <Button
                  type="text"
                  size="small"
                  icon={<RedoOutlined />}
                  style={{ color: '#52c41a' }}
                />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="结果">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewResult(record)} />
          </Tooltip>
          {record.status !== 'running' && (
            <Tooltip title="编辑">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)} />
            </Tooltip>
          )}
          {record.status !== 'running' && (
            <Tooltip title="删除">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 本体对象字段列表
  const objectColumnList = selectedObject?.content?.columns || [];
  const allColumnsSelected = objectColumnList.length > 0
    && objectColumnList.every(c => selectedColumns.includes(c.column_name));
  const someColumnsSelected = objectColumnList.some(c => selectedColumns.includes(c.column_name));

  // 抽取字段表格列定义
  const extractFieldColumns = [
    {
      title: '字段名', dataIndex: 'column_name', key: 'column_name', width: 180,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '中文名', dataIndex: 'column_name_cn', key: 'column_name_cn', width: 160,
      render: (text: string) => text || <Text type="secondary">-</Text>,
    },
    {
      title: '描述', dataIndex: 'column_description', key: 'column_description',
      ellipsis: true,
      render: (text: string) => text || <Text type="secondary">-</Text>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 顶部操作栏 */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Dropdown
          menu={{
            items: [
              { key: 'single', label: '单个创建', icon: <PlusOutlined /> },
              { key: 'batch', label: '批量创建', icon: <TableOutlined /> },
            ],
            onClick: ({ key }) => {
              if (key === 'single') handleOpenCreate('single');
              else if (key === 'batch') handleOpenCreate('batch');
            },
          }}
          placement="bottomLeft"
        >
          <Button type="primary" icon={<PlusOutlined />}>
            创建任务 <DownOutlined />
          </Button>
        </Dropdown>
        <Button
          icon={<PlayCircleOutlined />}
          onClick={handleBatchExecute}
          disabled={selectedRowKeys.length === 0}
        >
          批量执行 ({selectedRowKeys.length})
        </Button>
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleBatchDelete}
          disabled={selectedRowKeys.length === 0}
        >
          批量删除 ({selectedRowKeys.length})
        </Button>
        <Input
          placeholder="搜索任务名称"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          onBlur={() => setPage(1)}
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
        <Button icon={<ReloadOutlined />} onClick={() => {
          if (page !== 1) {
            setPage(1);
          } else {
            loadTasks();
          }
        }}>刷新</Button>
      </div>

      {/* 表格区域 */}
      <div style={{ flex: 1, padding: '0 16px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Table
          dataSource={tasks}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={false}
          scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
            preserveSelectedRowKeys: true,
          }}
        />
      </div>

      {/* 底部分页栏 */}
      <div style={{ paddingTop: '16px', paddingBottom: '16px', borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'center' }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          onChange={(p) => setPage(p)}
          onShowSizeChange={(_current, size) => {
            setSelectedRowKeys([]);
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

      {/* 创建/编辑任务弹窗 */}
      <Modal
        title={
          editingTask ? '编辑数据抽取任务' :
          createMode === 'batch' ? '批量创建数据抽取任务' :
          '创建数据抽取任务'
        }
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        width={createMode === 'batch' ? 750 : 650}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>取消</Button>,
          createStep === 0 && !editingTask && (
            <Button key="next" type="primary" onClick={handleNextStep}>下一步</Button>
          ),
          createStep === 1 && createMode === 'batch' && !editingTask && (
            <Button key="next" type="primary" onClick={handleNextStep}>下一步</Button>
          ),
          createStep > 0 && !editingTask && (
            <Button key="back" onClick={() => setCreateStep(createStep - 1)}>上一步</Button>
          ),
          (!editingTask && createStep === getStepCount() - 1) && (
            <Button key="submit" type="primary" onClick={handleCreateTask}>
              {createMode === 'batch' ? `批量创建 (${batchObjectIds.length})` : '创建'}
            </Button>
          ),
          editingTask && (
            <Button key="submit" type="primary" onClick={handleCreateTask}>保存</Button>
          ),
        ].filter(Boolean)}
      >
        <Steps
          current={createStep}
          size="small"
          style={{ marginBottom: 24 }}
          onChange={handleStepChange}
          items={
            editingTask ? [
              { title: '选择数据源与对象' },
              { title: '选择导出格式' },
            ] : createMode === 'batch' ? [
              { title: '选择数据源与对象' },
              { title: '字段配置' },
              { title: '选择导出格式' },
            ] : [
              { title: '选择数据源与对象' },
              { title: '选择导出格式' },
            ]
          }
        />

        <Form form={createForm} layout="vertical">
          {createStep === 0 && (
            createMode === 'batch' ? (
              /* 批量创建 - 步骤1：选择数据源与多个本体对象 */
              <>
                <Form.Item name="name" label="任务名称前缀" rules={[{ required: true, message: '请输入任务名称前缀' }]}>
                  <Input placeholder="如：数据抽取_，最终任务名将为 前缀+对象名" />
                </Form.Item>
                <Form.Item name="datasource_id" label="数据源" rules={[{ required: true, message: '请选择数据源' }]}>
                  <Select
                    placeholder="请选择数据源"
                    allowClear
                    onChange={handleDatasourceChange}
                    options={datasources.map(ds => ({ label: ds.name, value: ds.id }))}
                    notFoundContent="暂无关系型数据源"
                  />
                </Form.Item>
                {objects.length > 0 && (
                  <Form.Item label="本体对象（多选）" required>
                    <Select
                      mode="multiple"
                      placeholder="请选择要创建任务的本体对象（可多选）"
                      value={batchObjectIds}
                      onChange={handleBatchObjectsChange}
                      optionFilterProp="label"
                      showSearch
                      notFoundContent="暂无本体对象"
                      options={objects.map(obj => ({
                        value: obj.id,
                        label: obj.title || obj.name,
                      }))}
                      optionRender={(option) => {
                        const obj = objects.find(o => o.id === option.value);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', overflow: 'hidden' }}>
                            <span style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {option.label}
                            </span>
                            {obj?.description && (
                              <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {obj.description}
                              </span>
                            )}
                          </div>
                        );
                      }}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#999', fontSize: 12 }}>
                        已选择 {batchObjectIds.length} 个对象，每个对象将创建一个独立任务
                      </span>
                      <Space size={8}>
                        <Button size="small" onClick={() => handleBatchObjectsChange(objects.map(o => o.id))}>全选</Button>
                        <Button size="small" onClick={() => handleBatchObjectsChange([])}>清空</Button>
                      </Space>
                    </div>
                  </Form.Item>
                )}
              </>
            ) : (
              /* 单个创建/编辑 - 步骤1 */
              <>
                <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                  <Input placeholder="请输入任务名称" />
                </Form.Item>
                <Form.Item name="datasource_id" label="数据源" rules={[{ required: true, message: '请选择数据源' }]}>
                  <Select
                    placeholder="请选择数据源"
                    allowClear
                    onChange={handleDatasourceChange}
                    options={datasources.map(ds => ({ label: ds.name, value: ds.id }))}
                    notFoundContent="暂无关系型数据源"
                  />
                </Form.Item>
                <div style={{ marginBottom: 16 }}>
                  <Radio.Group value={taskType} onChange={e => { setTaskType(e.target.value); createForm.setFieldValue('ontology_object_id', undefined); setSelectedObject(null); setSelectedColumns([]); }}>
                    <Radio.Button value="object">选择本体对象</Radio.Button>
                    <Radio.Button value="sql">自定义SQL</Radio.Button>
                  </Radio.Group>
                </div>
                {taskType === 'object' ? (
                  <>
                    <Form.Item name="ontology_object_id" label="本体对象" rules={[{ required: true, message: '请选择本体对象' }]}>
                      <Select
                        placeholder="请选择本体对象"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        onChange={handleObjectChange}
                        notFoundContent="暂无本体对象"
                        options={objects.map(obj => ({
                          value: obj.id,
                          label: obj.name,
                        }))}
                        optionRender={(option) => {
                          const obj = objects.find(o => o.id === option.value);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', overflow: 'hidden' }}>
                              <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj?.name}</span>
                              {obj?.title && (
                                <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obj.title}</span>
                              )}
                            </div>
                          );
                        }}
                      />
                    </Form.Item>
                    {selectedObject && (
                      <div style={{ marginBottom: 8, marginTop: -8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 13 }}>抽取字段</span>
                          <Checkbox
                            checked={allColumnsSelected}
                            indeterminate={!allColumnsSelected && someColumnsSelected}
                            onChange={e => {
                              const all = (selectedObject.content?.columns || []).map(c => c.column_name);
                              setSelectedColumns(e.target.checked ? all : []);
                            }}
                          >
                            全选
                          </Checkbox>
                        </div>
                        <Table
                          dataSource={objectColumnList}
                          columns={extractFieldColumns}
                          rowKey="column_name"
                          size="small"
                          pagination={false}
                          scroll={{ y: 200 }}
                          locale={{ emptyText: '暂无字段' }}
                          rowSelection={{
                            selectedRowKeys: selectedColumns,
                            onChange: (keys) => setSelectedColumns(keys as string[]),
                          }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <Form.Item name="custom_sql" label="自定义SQL" rules={[{ required: true, message: '请输入SQL语句' }]}>
                    <TextArea rows={4} placeholder="SELECT * FROM table_name" />
                  </Form.Item>
                )}
              </>
            )
          )}

          {/* 批量创建 - 步骤2：字段配置 */}
          {createStep === 1 && createMode === 'batch' && (
            <>
              {batchObjectIds.length === 0 ? (
                <Empty description="请先选择本体对象" />
              ) : (
                <div style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
                  {batchObjectIds.map(objId => {
                    const obj = objects.find(o => o.id === objId);
                    if (!obj) return null;
                    const cols = obj.content?.columns || [];
                    const selected = batchColumnsMap[objId] || [];
                    const allSelected = selected.length === cols.length && cols.length > 0;
                    const someSelected = selected.length > 0 && !allSelected;
                    return (
                      <div key={objId} style={{ marginBottom: 12, border: '1px solid #f0f0f0', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px' }}>
                          <span style={{ fontWeight: 600, cursor: 'pointer', flex: 1 }} onClick={() => toggleFieldExpand(objId)}>
                            {expandedFieldObjs.includes(objId) ? <DownOutlined style={{ fontSize: 12, marginRight: 8, color: '#999' }} /> : <RightOutlined style={{ fontSize: 12, marginRight: 8, color: '#999' }} />}
                            {obj.name}
                            {obj.title && <span style={{ color: '#999', fontWeight: 400, marginLeft: 8 }}>{obj.title}</span>}
                            <span style={{ color: '#999', fontWeight: 400, marginLeft: 8, fontSize: 12 }}>（已选 {selected.length}/{cols.length}）</span>
                          </span>
                          <Checkbox
                            checked={allSelected}
                            indeterminate={someSelected}
                            onChange={e => handleBatchSelectAll(objId, e.target.checked)}
                          >
                            全选
                          </Checkbox>
                        </div>
                        {expandedFieldObjs.includes(objId) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', padding: '0 12px 12px', maxHeight: 180, overflow: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                            {cols.map(col => (
                              <Checkbox
                                key={col.column_name}
                                checked={selected.includes(col.column_name)}
                                onChange={e => handleBatchColumnToggle(objId, col.column_name, e.target.checked)}
                              >
                                {col.column_name}
                                {col.column_name_cn && <span style={{ color: '#999', marginLeft: 4 }}>({col.column_name_cn})</span>}
                              </Checkbox>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* 导出格式步骤 */}
          {createStep === (createMode === 'batch' ? 2 : 1) && (
            <>
              <Form.Item name="export_format" label="导出格式" rules={[{ required: true, message: '请选择导出格式' }]}>
                <Radio.Group>
                  {exportFormats.map(fmt => (
                    <Radio.Button key={fmt.value} value={fmt.value}>{fmt.label}</Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>
              <Form.Item name="auto_download" label="执行完自动下载" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>格式样例：</div>
                {exportFormats.map(fmt => (
                  <div key={fmt.value} style={{ display: exportFormatValue === fmt.value ? 'block' : 'none' }}>
                    <pre style={{
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                      color: theme === 'dark' ? '#e0e0e0' : '#333333',
                      padding: 12, borderRadius: 6,
                      fontSize: 12, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
                    }}>
                      {fmt.sample}
                    </pre>
                  </div>
                ))}
              </div>
            </>
          )}
        </Form>
      </Modal>

      {/* 结果查看抽屉 */}
      <Drawer
        title="任务执行结果"
        width={700}
        open={resultVisible}
        onClose={() => setResultVisible(false)}
        getContainer={false}
        contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
      >
        {resultData ? (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务状态">
                <Tag color={statusColorMap[resultData.status] || 'default'}>{resultData.status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{resultData.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{resultData.task_end_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="耗时">{formatDurationSeconds(resultData.task_duration)}</Descriptions.Item>
              <Descriptions.Item label="执行时间">{resultData.executed_at || '-'}</Descriptions.Item>
              {resultData.task_progress_message && (
                <Descriptions.Item label="日志">
                  <Tooltip
                    title={
                      <div style={{ maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                        {resultData.task_progress_message}
                      </div>
                    }
                    placement="topLeft"
                    overlayStyle={{ maxWidth: 600 }}
                  >
                    <div style={{
                      maxWidth: 480,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span>{resultData.task_progress_message}</span>
                      <CopyOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(resultData.task_progress_message!).then(() => {
                            message.success('已复制');
                          });
                        }}
                        style={{ color: '#1890ff', fontSize: 12, flexShrink: 0 }}
                      />
                    </div>
                  </Tooltip>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="数据行数">{resultData.row_count ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="文件格式">{resultData.format || '-'}</Descriptions.Item>
              <Descriptions.Item label="链接过期时间">
                <Text type="warning">{resultData.expire_at || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="结果文件">
                {resultData.has_result ? (
                  <Link onClick={handleDownloadResult}>{resultData.file_name || '结果文件'}</Link>
                ) : (
                  <Text type="secondary">{resultData.message || '暂无结果'}</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        )}
      </Drawer>
    </div>
  );
};

export default OntologyTaskPage;
