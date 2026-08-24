import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Drawer, Input, message, Modal, Space, Tag, Steps,
  Form, Select, Radio, Checkbox, Descriptions, Typography, Progress, Empty, Pagination, Tooltip
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined,
  ReloadOutlined, EyeOutlined, RedoOutlined, EditOutlined
} from '@ant-design/icons';
import { ontologyService, OntologyTask, OntologyObject, ExportFormat, TaskResult } from '../../services/ontology';
import { datasourceService, Datasource } from '../../services/datasource';

const { Text } = Typography;
const { TextArea } = Input;

const statusColorMap: Record<string, string> = {
  pending: 'default', waiting: 'warning', running: 'processing',
  cancel: 'default', done: 'success', fail: 'error', schedule: 'purple',
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

  // 打开创建/编辑弹窗
  const handleOpenCreate = async (task?: OntologyTask) => {
    setCreateStep(0);
    setSelectedObject(null);
    setSelectedColumns([]);
    createForm.resetFields();
    if (task) {
      // 编辑模式
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

  // 编辑任务（仅未运行/未结束状态可编辑）
  const handleEditTask = (record: OntologyTask) => {
    if (record.status === 'running' || record.status === 'done'
      || record.status === 'fail' || record.status === 'cancel') {
      message.warning('当前任务状态不可编辑');
      return;
    }
    handleOpenCreate(record);
  };

  // 选择数据源后加载本体对象
  const handleDatasourceChange = async (dsId: string) => {
    setSelectedObject(null);
    setSelectedColumns([]);
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
  };

  // 步骤条点击跳转
  const handleStepChange = (step: number) => {
    setCreateStep(step);
  };

  const handleNextStep = () => {
    setCreateStep(1);
  };

  // 保存时校验全部必填参数（步骤条可跳转，需跨步骤校验）
  const validateAllFields = (): boolean => {
    const values = createForm.getFieldsValue(true);
    // 第1步必填项
    if (!values.name?.trim()) {
      message.warning('请输入任务名称');
      setCreateStep(0);
      return false;
    }
    if (!values.datasource_id) {
      message.warning('请选择数据源');
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
    // 第2步必填项
    if (!values.export_format) {
      message.warning('请选择导出格式');
      setCreateStep(1);
      return false;
    }
    return true;
  };

  const handleCreateTask = async () => {
    if (!validateAllFields()) return;
    try {
      // 步骤条可跳转，validateFields 只返回当前步骤已挂载字段，需用 getFieldsValue(true) 取全部字段值
      const values = createForm.getFieldsValue(true);
      const configs: Record<string, any> = {
        export_format: values.export_format,
      };
      if (taskType === 'object') {
        configs.ontology_object_id = values.ontology_object_id;
        if (selectedObject) {
          const allCols = (selectedObject.content?.columns || []).map(c => c.column_name);
          // 传入选中的字段，未选中任何字段时不传
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
      message.warning('请先勾选要删除的任务');
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
      title: '操作', key: 'actions', width: 200, fixed: 'right',
      render: (_: any, record: OntologyTask) => (
        <Space size={4}>
          {(record.status === 'pending' || record.status === 'waiting') && (
            <Tooltip title="开始">
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleStart(record)} />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="停止">
              <Button type="primary" danger size="small" icon={<PauseCircleOutlined />} onClick={() => handleStop(record)} />
            </Tooltip>
          )}
          {(record.status === 'done' || record.status === 'fail' || record.status === 'cancel') && (
            <Tooltip title="重新执行">
              <Button size="small" icon={<RedoOutlined />} onClick={() => handleRerun(record)} />
            </Tooltip>
          )}
          <Tooltip title="结果">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewResult(record)} />
          </Tooltip>
          {(record.status === 'pending' || record.status === 'waiting') && (
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
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>创建任务</Button>
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
        title={editingTask ? '编辑数据抽取任务' : '创建数据抽取任务'}
        open={createVisible}
        onCancel={() => setCreateVisible(false)}
        width={650}
        footer={[
          <Button key="cancel" onClick={() => setCreateVisible(false)}>取消</Button>,
          createStep === 0 && <Button key="next" type="primary" onClick={handleNextStep}>下一步</Button>,
          createStep === 1 && <Button key="back" onClick={() => setCreateStep(0)}>上一步</Button>,
          createStep === 1 && <Button key="submit" type="primary" onClick={handleCreateTask}>{editingTask ? '保存' : '创建'}</Button>,
        ]}
      >
        <Steps
          current={createStep}
          size="small"
          style={{ marginBottom: 24 }}
          onChange={handleStepChange}
          items={[
            { title: '选择数据源与对象' },
            { title: '选择导出格式' },
          ]}
        />

        <Form form={createForm} layout="vertical">
          {createStep === 0 && (
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
                  <div key={fmt.value} style={{ display: exportFormatValue === fmt.value ? 'block' : 'none' }}>
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
