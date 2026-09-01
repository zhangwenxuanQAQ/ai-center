import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Drawer, Input, message, Tag, Select, Descriptions,
  Empty, Pagination, Tooltip, Typography,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { taskCenterService, TaskLog, TaskTypeInfo, TaskOutputField } from '../../services/taskCenter';
import { statusColorMap, taskTypeColorMap, formatDurationSeconds, useTheme } from './constants';
import { triggerBlobDownload } from '../../utils/download';

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
      render: (status: string, record: TaskLog) => {
        const statusTag = <Tag color={statusColorMap[status] || 'default'}>{record.task_status_label}</Tag>;
        const popoverContent = (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>任务详情</div>
            <Descriptions size="small" column={1} style={{ width: '360px' }}>
              <Descriptions.Item label="任务名称">{record.name}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <Tag color={statusColorMap[status] || 'default'}>{record.task_status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="进度">{((record.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
              {record.task_progress_message && (
                <Descriptions.Item label="日志">
                  <div style={{ maxWidth: '320px', wordBreak: 'break-word', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
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
          <Tooltip title={popoverContent} placement="top" overlayStyle={{ maxWidth: 420 }}>
            {statusTag}
          </Tooltip>
        );
      },
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
            <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, minWidth: 150 }}>
              <Descriptions.Item label="任务名称">{detailLog.name}</Descriptions.Item>
              <Descriptions.Item label="任务类型">
                <Tag color={taskTypeColorMap[detailLog.task_type] || 'default'}>{detailLog.task_type_name}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[detailLog.task_status] || 'default'}>{detailLog.task_status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="进度">{((detailLog.task_progress || 0) * 100).toFixed(1)}%</Descriptions.Item>
              <Descriptions.Item label="执行时间">{detailLog.created_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="进度日志">
                {detailLog.task_progress_message ? (
                  <pre style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f5f5f5',
                    color: theme === 'dark' ? '#e0e0e0' : '#333333',
                    padding: 8, borderRadius: 4, fontFamily: 'monospace',
                    fontSize: 12, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
                  }}>
                    {detailLog.task_progress_message}
                  </pre>
                ) : (
                  <span style={{ color: '#999' }}>暂无日志</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{detailLog.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{detailLog.task_end_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="耗时">{formatDurationSeconds(detailLog.task_duration)}</Descriptions.Item>
            </Descriptions>

            {/* 任务配置（来自后端常量） */}
            {detailLog.task_configs && Object.keys(detailLog.task_configs).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ marginBottom: 4, fontWeight: 600 }}>任务配置</div>
                <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, minWidth: 150 }}>
                  {Object.entries(detailLog.task_configs).map(([key, val]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof val === 'object'
                        ? <Typography.Text style={{ fontSize: 12 }}>{JSON.stringify(val)}</Typography.Text>
                        : String(val)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            )}

            {/* 执行结果（来自后端 task_output） */}
            {(() => {
              const outputFields = (detailLog.task_output || []).filter(
                f => f.value !== null && f.value !== undefined && f.value !== ''
              );
              if (outputFields.length === 0) return null;
              const { Text } = Typography;
              const handleDownload = async () => {
                try {
                  const { blob, fileName: backendName } = await taskCenterService.downloadTaskResult(detailLog.task_id);
                  const fileName = outputFields.find(f => f.name === 'result_file')?.value || backendName || 'result';
                  triggerBlobDownload(blob, String(fileName));
                } catch {
                  message.error('下载失败，文件可能已过期');
                }
              };
              const renderVal = (name: string, value: any) => {
                if (value === null || value === undefined || value === '') return <Text type="secondary">-</Text>;
                if (name === 'status') {
                  const isOk = value === 'success' || value === 'done';
                  return <Tag color={isOk ? 'success' : 'error'}>{String(value)}</Tag>;
                }
                if (name === 'result_file') {
                  return <Typography.Link onClick={handleDownload}>{String(value)}</Typography.Link>;
                }
                if (typeof value === 'object') {
                  return <Text style={{ fontSize: 12 }}>{JSON.stringify(value)}</Text>;
                }
                return <Text>{String(value)}</Text>;
              };
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ marginBottom: 4, fontWeight: 600 }}>执行结果</div>
                  <Descriptions column={1} size="small" bordered labelStyle={{ width: 150, minWidth: 150 }}>
                    {outputFields.map(f => (
                      <Descriptions.Item key={f.name} label={f.title}>
                        {renderVal(f.name, f.value)}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </div>
              );
            })()}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
        )}
      </Drawer>
    </div>
  );
};

export default TaskCenterLogPage;
