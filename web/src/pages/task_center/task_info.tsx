import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Drawer, Input, message, Modal, Space, Tag, Select,
  Descriptions, Empty, Pagination, Tooltip, Dropdown, Popconfirm,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  ReloadOutlined, EyeOutlined, RedoOutlined, DownOutlined, HistoryOutlined, EditOutlined,
} from '@ant-design/icons';
import { taskCenterService, TaskInfo, TaskLog, TaskTypeInfo, TaskResult } from '../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds, useTheme } from './constants';
import TaskFormModal from './forms';
import TaskResultDrawer from './results';

const TaskCenterTaskPage: React.FC = () => {
  const theme = useTheme();
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 过滤条件
  const [searchName, setSearchName] = useState('');
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  // 字典（任务类型/状态，来自后端常量）
  const [taskTypes, setTaskTypes] = useState<Record<string, TaskTypeInfo>>({});
  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});

  // 新增/编辑任务弹窗
  const [formVisible, setFormVisible] = useState(false);
  const [formTaskType, setFormTaskType] = useState<string>('');
  const [editingTask, setEditingTask] = useState<TaskInfo | null>(null);

  // 结果查看抽屉
  const [resultVisible, setResultVisible] = useState(false);
  const [resultTaskType, setResultTaskType] = useState<string>('');
  const [resultData, setResultData] = useState<TaskResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  // 执行历史抽屉
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyTask, setHistoryTask] = useState<TaskInfo | null>(null);
  const [historyLogs, setHistoryLogs] = useState<TaskLog[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskCenterService.getTasks(searchName || undefined, filterType, filterStatus, page, pageSize);
      setTasks(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error('加载任务列表失败');
    }
    setLoading(false);
  }, [searchName, filterType, filterStatus, page, pageSize]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // 加载任务类型/状态字典
  useEffect(() => {
    taskCenterService.getTaskTypes().then(setTaskTypes).catch(() => {});
    taskCenterService.getTaskStatuses().then(setTaskStatuses).catch(() => {});
  }, []);

  // SSE订阅任务事件，运行中任务状态/进度实时推送
  useEffect(() => {
    const eventSource = new EventSource(taskCenterService.getTaskEventsUrl());
    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        setTasks(prevTasks => prevTasks.map(task => {
          if (task.id === data.task_id) {
            return {
              ...task,
              task_status: data.task_status,
              task_status_label: taskStatuses[data.task_status] || data.task_status,
              task_progress: data.task_progress,
              task_progress_message: data.task_progress_message,
            };
          }
          return task;
        }));
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    });
    eventSource.onerror = () => {
      // EventSource 断线后浏览器会自动重连，此处仅记录
    };
    return () => eventSource.close();
  }, [taskStatuses]);

  // 打开新增任务弹窗
  const handleOpenCreate = (taskType: string) => {
    setFormTaskType(taskType);
    setEditingTask(null);
    setFormVisible(true);
  };

  // 打开编辑任务弹窗（运行中的任务不可编辑）
  const handleOpenEdit = (record: TaskInfo) => {
    if (record.task_status === 'running') {
      message.warning('任务运行中，暂不可编辑');
      return;
    }
    setFormTaskType(record.task_type);
    setEditingTask(record);
    setFormVisible(true);
  };

  // 表单保存成功回调
  const handleFormSuccess = () => {
    setFormVisible(false);
    setEditingTask(null);
    loadTasks();
  };

  // 开始任务
  const handleStart = async (record: TaskInfo) => {
    try {
      await taskCenterService.startTask(record.id);
      message.success('任务提交成功');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '启动失败');
    }
  };

  // 重新执行
  const handleRerun = async (record: TaskInfo) => {
    try {
      await taskCenterService.rerunTask(record.id);
      message.success('任务提交成功');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
  };

  // 停止任务
  const handleStop = async (record: TaskInfo) => {
    try {
      await taskCenterService.stopTask(record.id);
      message.success('任务已停止');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '停止失败');
    }
  };

  // 结果查看（按任务类型展示不同抽屉）
  const handleViewResult = async (record: TaskInfo) => {
    setResultVisible(true);
    setResultTaskType(record.task_type);
    setResultData(null);
    setResultLoading(true);
    try {
      const res = await taskCenterService.getTaskResult(record.id);
      setResultData(res);
    } catch (e: any) {
      message.error(e.message || '获取结果失败');
    }
    setResultLoading(false);
  };

  // 加载执行历史
  const loadHistoryLogs = useCallback(async (taskId: string, p: number = 1) => {
    setHistoryLoading(true);
    try {
      const res = await taskCenterService.getTaskHistoryLogs(taskId, p);
      setHistoryLogs(res.data || []);
      setHistoryTotal(res.total || 0);
    } catch (e: any) {
      message.error('加载执行历史失败');
    }
    setHistoryLoading(false);
  }, []);

  // 任务执行历史
  const handleViewHistory = (record: TaskInfo) => {
    setHistoryTask(record);
    setHistoryPage(1);
    setHistoryVisible(true);
    loadHistoryLogs(record.id, 1);
  };

  // 删除任务
  const handleDelete = (record: TaskInfo) => {
    Modal.confirm({
      title: '确认删除',
      okText: '确定',
      cancelText: '取消',
      content: `确定要删除任务 "${record.name}" 吗？其执行历史日志将一并删除。`,
      onOk: async () => {
        try {
          await taskCenterService.deleteTask(record.id);
          message.success('删除成功');
          loadTasks();
        } catch (e: any) {
          message.error(e.message || '删除失败');
        }
      },
    });
  };

  const columns = [
    {
      title: '任务名称', dataIndex: 'name', key: 'name', width: 200,
      render: (name: string, record: TaskInfo) => (
        <Tooltip title={record.description || name} placement="topLeft">
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '任务描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true,
      render: (text: string) => text ? (
        <Tooltip title={text} placement="topLeft">
          <span>{text}</span>
        </Tooltip>
      ) : '-',
    },
    {
      title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 130,
      render: (type: string, record: TaskInfo) => (
        <Tag color={taskTypeColorMap[type] || 'default'}>{record.task_type_name}</Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '状态', dataIndex: 'task_status', key: 'task_status', width: 140,
      render: (status: string, record: TaskInfo) => {
        const progress = Math.round((record.task_progress || 0) * 100);
        const isRunning = status === 'running';
        const statusTag = (
          <Tag color={statusColorMap[status] || 'default'}>
            {isRunning ? `${record.task_status_label} ${progress}%` : record.task_status_label}
          </Tag>
        );

        const popoverContent = (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>任务详情</div>
            <Descriptions size="small" column={1} style={{ width: '400px' }}>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColorMap[status] || 'default'}>{record.task_status_label}</Tag>
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
          <Tooltip title={popoverContent} placement="top" overlayStyle={{ maxWidth: 460 }}>
            {statusTag}
          </Tooltip>
        );
      },
    },
    {
      title: '操作', key: 'actions', width: 300, fixed: 'right',
      render: (_: any, record: TaskInfo) => (
        <Space size={4}>
          {record.task_status !== 'running' && record.task_status !== 'done' && record.task_status !== 'fail' && (
            <Tooltip title="开始">
              <Button
                type="text"
                size="small"
                icon={<PlayCircleOutlined />}
                style={{ color: '#52c41a' }}
                onClick={() => handleStart(record)}
              />
            </Tooltip>
          )}
          {(record.task_status === 'done' || record.task_status === 'fail' || record.task_status === 'cancel') && (
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
          {record.task_status === 'running' && (
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
          {record.task_status !== 'running' && (
            <Tooltip title="编辑">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)} />
            </Tooltip>
          )}
          <Tooltip title="结果查看">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewResult(record)} />
          </Tooltip>
          <Tooltip title="任务执行历史">
            <Button type="text" size="small" icon={<HistoryOutlined />} onClick={() => handleViewHistory(record)} />
          </Tooltip>
          {record.task_status !== 'running' && (
            <Tooltip title="删除">
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 执行历史抽屉表格列
  const historyColumns = [
    { title: '执行时间', dataIndex: 'created_at', key: 'created_at', width: 160 },
    {
      title: '状态', dataIndex: 'task_status', key: 'task_status', width: 100,
      render: (status: string, record: TaskLog) => (
        <Tag color={statusColorMap[status] || 'default'}>{record.task_status_label}</Tag>
      ),
    },
    {
      title: '进度', dataIndex: 'task_progress', key: 'task_progress', width: 80,
      render: (progress: number) => `${Math.round((progress || 0) * 100)}%`,
    },
    { title: '开始时间', dataIndex: 'task_begin_at', key: 'task_begin_at', width: 160 },
    { title: '结束时间', dataIndex: 'task_end_at', key: 'task_end_at', width: 160 },
    {
      title: '耗时', dataIndex: 'task_duration', key: 'task_duration', width: 90,
      render: (ms: number) => formatDurationSeconds(ms),
    },
  ];

  // 任务类型下拉选项（来自后端常量）
  const taskTypeOptions = Object.entries(taskTypes).map(([value, info]) => ({
    value, label: info?.name || value,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 顶部操作栏 */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Dropdown
          menu={{
            items: taskTypeOptions.map(({ value, label }) => ({
              key: value, label, icon: <PlusOutlined />,
            })),
            onClick: ({ key }) => handleOpenCreate(key),
          }}
          placement="bottomLeft"
        >
          <Button type="primary" icon={<PlusOutlined />}>
            新增任务 <DownOutlined />
          </Button>
        </Dropdown>
        <Input
          placeholder="搜索任务名称"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
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
        <Select
          placeholder="任务类型"
          value={filterType}
          onChange={value => { setFilterType(value); setPage(1); }}
          allowClear
          style={{ width: 150 }}
          options={taskTypeOptions}
        />
        <Select
          placeholder="状态"
          value={filterStatus}
          onChange={value => { setFilterStatus(value); setPage(1); }}
          allowClear
          style={{ width: 130 }}
          options={Object.entries(taskStatuses).map(([value, label]) => ({ value, label }))}
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
          scroll={{ x: 1100, y: 'calc(100vh - 280px)' }}
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

      {/* 新增/编辑任务弹窗（按任务类型分发） */}
      <TaskFormModal
        open={formVisible}
        taskType={formTaskType}
        taskTypeLabel={taskTypes[formTaskType]?.name || formTaskType}
        editingTask={editingTask}
        onCancel={() => setFormVisible(false)}
        onSuccess={handleFormSuccess}
      />

      {/* 任务结果抽屉（按任务类型分发） */}
      <TaskResultDrawer
        open={resultVisible}
        taskType={resultTaskType}
        result={resultData}
        loading={resultLoading}
        theme={theme}
        onClose={() => setResultVisible(false)}
      />

      {/* 任务执行历史抽屉 */}
      <Drawer
        title={`任务执行历史${historyTask ? ` - ${historyTask.name}` : ''}`}
        width={920}
        open={historyVisible}
        onClose={() => setHistoryVisible(false)}
        getContainer={false}
        contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
      >
        <Table
          dataSource={historyLogs}
          columns={historyColumns}
          rowKey="id"
          loading={historyLoading}
          size="small"
          locale={{ emptyText: <Empty description="暂无执行历史" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={false}
          expandable={{
            expandedRowRender: (record: TaskLog) => (
              <div>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>进度日志</div>
                <pre style={{
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                  color: theme === 'dark' ? '#e0e0e0' : '#333333',
                  padding: 12, borderRadius: 6, fontFamily: 'monospace',
                  fontSize: 12, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
                }}>
                  {record.task_progress_message || '暂无日志'}
                </pre>
              </div>
            ),
            rowExpandable: (record: TaskLog) => !!record.task_progress_message,
          }}
        />
        <div style={{ paddingTop: 16, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            current={historyPage}
            pageSize={20}
            total={historyTotal}
            showTotal={(t) => `共 ${t} 条记录`}
            onChange={(p) => {
              setHistoryPage(p);
              if (historyTask) loadHistoryLogs(historyTask.id, p);
            }}
          />
        </div>
      </Drawer>
    </div>
  );
};

export default TaskCenterTaskPage;
