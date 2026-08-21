import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Drawer, Input, message, Modal, Space, Tag, Steps,
  Form, Select, Radio, Descriptions, Typography, Progress
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  ReloadOutlined, EyeOutlined, RedoOutlined, SearchOutlined
} from '@ant-design/icons';
import { ontologyService, OntologyTask, ExportFormat, TaskResult } from '../../services/ontology';
import { datasourceService, Datasource } from '../../services/datasource';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const statusColorMap: Record<string, string> = {
  pending: 'default', waiting: 'warning', running: 'processing',
  cancel: 'default', done: 'success', fail: 'error', schedule: 'purple',
};

const OntologyTaskPage: React.FC = () => {
  const [tasks, setTasks] = useState<OntologyTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [searchName, setSearchName] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const pageSize = 20;

  // 创建任务弹窗
  const [createVisible, setCreateVisible] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createForm] = Form.useForm();
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [objects, setObjects] = useState<any[]>([]);
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  const [taskType, setTaskType] = useState<'object' | 'sql'>('object');

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
  }, [searchName, page]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // 打开创建弹窗
  const handleOpenCreate = async () => {
    setCreateStep(0);
    setTaskType('object');
    createForm.resetFields();
    setCreateVisible(true);

    // 加载数据源
    try {
      const res = await datasourceService.getDatasources(undefined, 1, 100);
      setDatasources(res.data || []);
    } catch (e) {}

    // 加载导出格式
    try {
      const res = await ontologyService.getExportFormats();
      setExportFormats(res.formats || []);
    } catch (e) {}
  };

  // 选择数据源后加载本体对象
  const handleDatasourceChange = async (dsId: string) => {
    try {
      const res = await ontologyService.getObjects(dsId, 1, 100);
      setObjects(res.data || []);
    } catch (e) {}
  };

  const handleNextStep = () => {
    if (createStep === 0) {
      const values = createForm.getFieldsValue();
      if (!values.datasource_id) {
        message.warning('请选择数据源');
        return;
      }
      if (taskType === 'object' && !values.ontology_object_id) {
        message.warning('请选择本体对象');
        return;
      }
      if (taskType === 'sql' && !values.custom_sql) {
        message.warning('请输入自定义SQL');
        return;
      }
      setCreateStep(1);
    }
  };

  const handleCreateTask = async () => {
    try {
      const values = await createForm.validateFields();
      const configs: Record<string, any> = {
        export_format: values.export_format,
      };
      if (taskType === 'object') {
        configs.ontology_object_id = values.ontology_object_id;
      } else {
        configs.custom_sql = values.custom_sql;
      }
      await ontologyService.createTask({
        name: values.name,
        datasource_id: values.datasource_id,
        configs,
      });
      message.success('任务创建成功');
      setCreateVisible(false);
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '创建失败');
    }
  };

  // 启动任务
  const handleStart = async (record: OntologyTask) => {
    try {
      await ontologyService.startTask(record.id);
      message.success('任务已启动');
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
      message.success('任务已重新执行');
      loadTasks();
    } catch (e: any) {
      message.error(e.message || '操作失败');
    }
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
      message.warning('请选择要删除的任务');
      return;
    }
    Modal.confirm({
      title: '批量删除',
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
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (status: string, record: OntologyTask) => (
        <Tag color={statusColorMap[status] || 'default'}>{record.status_label}</Tag>
      ),
    },
    {
      title: '进度', key: 'progress', width: 160,
      render: (_: any, record: OntologyTask) => (
        <div style={{ minWidth: 120 }}>
          <Progress
            percent={Math.round((record.task_progress || 0) * 100)}
            size="small"
            status={record.status === 'fail' ? 'exception' : record.status === 'done' ? 'success' : 'active'}
            format={(p) => `${p}%`}
          />
          {record.task_progress_message && (
            <Text type="secondary" style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.task_progress_message}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '操作', key: 'actions', width: 280,
      render: (_: any, record: OntologyTask) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'waiting') && (
            <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(record)}>开始</Button>
          )}
          {record.status === 'running' && (
            <Button type="link" size="small" icon={<PauseCircleOutlined />} danger onClick={() => handleStop(record)}>停止</Button>
          )}
          {(record.status === 'done' || record.status === 'fail' || record.status === 'cancel') && (
            <Button type="link" size="small" icon={<RedoOutlined />} onClick={() => handleRerun(record)}>重新执行</Button>
          )}
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewResult(record)}>结果</Button>
          {record.status !== 'running' && (
            <Button type="link" size="small" icon={<DeleteOutlined />} danger onClick={() => handleDelete(record)}>删除</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶部操作栏 */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>数据抽取任务</div>
        <Space>
          <Input.Search
            placeholder="搜索任务名称"
            value={searchName}
            onChange={e => { setSearchName(e.target.value); setPage(1); }}
            onSearch={loadTasks}
            style={{ width: 220 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadTasks}>刷新</Button>
          <Button danger onClick={handleBatchDelete} disabled={selectedRowKeys.length === 0}>批量删除</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>创建任务</Button>
        </Space>
      </div>

      <Table
        dataSource={tasks}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        pagination={{
          current: page, pageSize, total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 条`,
        }}
        style={{ flex: 1 }}
      />

      {/* 创建任务弹窗 */}
      <Modal
        title="创建数据抽取任务"
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        width={650}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>取消</Button>,
          createStep === 0 && <Button key="next" type="primary" onClick={handleNextStep}>下一步</Button>,
          createStep === 1 && <Button key="back" onClick={() => setCreateStep(0)}>上一步</Button>,
          createStep === 1 && <Button key="submit" type="primary" onClick={handleCreateTask}>创建</Button>,
        ]}
      >
        <Steps current={createStep} size="small" style={{ marginBottom: 24 }}>
          <Steps.Step title="选择数据源与对象" />
          <Steps.Step title="选择导出格式" />
        </Steps>

        <Form form={createForm} layout="vertical">
          {createStep === 0 && (
            <>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="请输入任务名称" />
              </Form.Item>
              <Form.Item name="datasource_id" label="数据源" rules={[{ required: true, message: '请选择数据源' }]}>
                <Select
                  placeholder="请选择数据源"
                  onChange={handleDatasourceChange}
                  options={datasources.map(ds => ({ label: ds.name, value: ds.id }))}
                />
              </Form.Item>
              <div style={{ marginBottom: 16 }}>
                <Radio.Group value={taskType} onChange={e => setTaskType(e.target.value)}>
                  <Radio.Button value="object">选择本体对象</Radio.Button>
                  <Radio.Button value="sql">自定义SQL</Radio.Button>
                </Radio.Group>
              </div>
              {taskType === 'object' ? (
                <Form.Item name="ontology_object_id" label="本体对象" rules={[{ required: true, message: '请选择本体对象' }]}>
                  <Select
                    placeholder="请选择本体对象"
                    options={objects.map((obj: any) => ({
                      label: `${obj.title ? obj.title + ' / ' : ''}${obj.name}`,
                      value: obj.id,
                    }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item name="custom_sql" label="自定义SQL" rules={[{ required: true, message: '请输入SQL语句' }]}>
                  <TextArea rows={4} placeholder="SELECT * FROM table_name" />
                </Form.Item>
              )}
            </>
          )}

          {createStep === 1 && (
            <>
              <Form.Item name="export_format" label="导出格式" rules={[{ required: true, message: '请选择导出格式' }]}>
                <Radio.Group>
                  {exportFormats.map(fmt => (
                    <Radio.Button key={fmt.value} value={fmt.value}>{fmt.label}</Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>格式样例：</div>
                {exportFormats.map(fmt => (
                  <div key={fmt.value} style={{ display: createForm.getFieldValue('export_format') === fmt.value ? 'block' : 'none' }}>
                    <pre style={{
                      background: '#f5f5f5', padding: 12, borderRadius: 6,
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
      >
        {resultData ? (
          <div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="任务状态">
                <Tag color={statusColorMap[resultData.status] || 'default'}>{resultData.status_label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">{resultData.task_begin_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{resultData.task_end_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="耗时(ms)">{resultData.task_duration ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="执行时间">{resultData.executed_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="数据行数">{resultData.row_count ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="文件格式">{resultData.format || '-'}</Descriptions.Item>
              <Descriptions.Item label="文件名">{resultData.file_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="链接过期时间">
                <Text type="warning">{resultData.expire_at || '-'}</Text>
              </Descriptions.Item>
            </Descriptions>
            {resultData.has_result && (
              <div style={{ marginTop: 16 }}>
                <Button type="primary" icon={<EyeOutlined />} onClick={handleDownloadResult}>
                  下载结果文件
                </Button>
              </div>
            )}
            {!resultData.has_result && (
              <div style={{ marginTop: 16, color: '#999' }}>
                {resultData.message || '暂无结果'}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>
        )}
      </Drawer>
    </div>
  );
};

export default OntologyTaskPage;