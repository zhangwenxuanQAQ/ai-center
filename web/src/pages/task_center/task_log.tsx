import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Drawer, Input, message, Tag, Select, Descriptions,
  Empty, Pagination,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { taskCenterService, TaskLog, TaskTypeInfo } from '../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds, useTheme } from './constants';

const TaskCenterLogPage: React.FC = () => {
  const theme = useTheme();
  const [logs, setLogs] = useState<TaskLog[]>([]);
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

  // 日志详情抽屉
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLog, setDetailLog] = useState<TaskLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskCenterService.getTaskLogs(searchName || undefined, filterType, filterStatus, page, pageSize);
      setLogs(res.data || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      message.error('加载任务日志失败');
    }
    setLoading(false);
  }, [searchName, filterType, filterStatus, page, pageSize]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // 加载任务类型/状态字典
  useEffect(() => {
    taskCenterService.getTaskTypes().then(setTaskTypes).catch(() => {});
    taskCenterService.getTaskStatuses().then(setTaskStatuses).catch(() => {});
  }, []);

  // 查看日志详情
  const handleViewDetail = (record: TaskLog) => {
    setDetailLog(record);
    setDetailVisible(true);
  };

  const columns = [
    { title: '任务名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '任务类型', dataIndex: 'task_type', key: 'task_type', width: 130,
      render: (type: string, record: TaskLog) => (
        <Tag color={taskTypeColorMap[type] || 'default'}>{record.task_type_name}</Tag>
      ),
    },
    { title: '执行时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '状态', dataIndex: 'task_status', key: 'task_status', width: 110,
      render: (status: string, record: TaskLog) => (
        <Tag color={statusColorMap[status] || 'default'}>{record.task_status_label}</Tag>
      ),
    },
    {
      title: '进度', dataIndex: 'task_progress', key: 'task_progress', width: 80,
      render: (progress: number) => `${Math.round((progress || 0) * 100)}%`,
    },
    {
      title: '耗时', dataIndex: 'task_duration', key: 'task_duration', width: 100,
      render: (ms: number) => formatDurationSeconds(ms),
    },
    {
      title: '操作', key: 'actions', width: 90, fixed: 'right',
      render: (_: any, record: TaskLog) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>详情</Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 顶部过滤栏 */}
      <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
          options={Object.entries(taskTypes).map(([value, info]) => ({ value, label: info?.name || value }))}
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
            loadLogs();
          }
        }}>刷新</Button>
      </div>

      {/* 表格区域 */}
      <div style={{ flex: 1, padding: '0 16px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="middle"
          locale={{ emptyText: <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={false}
          scroll={{ x: 900, y: 'calc(100vh - 280px)' }}
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

      {/* 日志详情抽屉 */}
      <Drawer
        title="任务日志详情"
        width={700}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        getContainer={false}
        contentWrapperStyle={{ boxShadow: '-8px 0 24px rgba(0,0,0,0.15)' }}
      >
        {detailLog ? (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务名称">{detailLog.name}</Descriptions.Item>
              <Descriptions.Item label="任务类型">
                <Tag color={taskTypeColorMap[detailLog.task_type] || 'default'}>{detailLog.task_type_name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[detailLog.task_status] || 'default'}>{detailLog.task_status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="进度">{((detailLog.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="执行时间">{detailLog.created_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="开始时间">{detailLog.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{detailLog.task_end_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="耗时">{formatDurationSeconds(detailLog.task_duration)}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>进度日志</div>
            <pre style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
              color: theme === 'dark' ? '#e0e0e0' : '#333333',
              padding: 12, borderRadius: 6, fontFamily: 'monospace',
              fontSize: 12, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {detailLog.task_progress_message || '暂无日志'}
            </pre>

            <div style={{ fontWeight: 600, margin: '16px 0 8px' }}>任务配置</div>
            <pre style={{
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
              color: theme === 'dark' ? '#e0e0e0' : '#333333',
              padding: 12, borderRadius: 6, fontFamily: 'monospace',
              fontSize: 12, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {JSON.stringify(detailLog.task_configs || {}, null, 2)}
            </pre>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
        )}
      </Drawer>
    </div>
  );
};

export default TaskCenterLogPage;
