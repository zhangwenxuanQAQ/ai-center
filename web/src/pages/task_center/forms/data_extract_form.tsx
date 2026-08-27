/**
 * 数据抽取任务新增/编辑弹窗（委托本体工作台任务）
 */

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Radio, Button, message, Tooltip } from 'antd';
import { taskCenterService, TaskInfo } from '../../../services/taskCenter';
import { datasourceService, Datasource } from '../../../services/datasource';
import { ontologyService, OntologyObject, ExportFormat } from '../../../services/ontology';

const { TextArea } = Input;

interface DataExtractFormProps {
  open: boolean;
  taskTypeLabel: string;
  editingTask: TaskInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const DataExtractForm: React.FC<DataExtractFormProps> = ({ open, taskTypeLabel, editingTask, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  // 抽取方式：object(本体对象) | sql(自定义SQL)
  const [extractType, setExtractType] = useState<'object' | 'sql'>('object');
  // 数据源与本体对象选项
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [objects, setObjects] = useState<OntologyObject[]>([]);
  const [exportFormats, setExportFormats] = useState<ExportFormat[]>([]);
  // 当前选中的本体对象（用于字段选择）
  const [selectedObject, setSelectedObject] = useState<OntologyObject | null>(null);

  // 打开弹窗时初始化/回填
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setSelectedObject(null);
    setObjects([]);
    setExtractType('object');
    if (editingTask) {
      const configs = editingTask.task_configs || {};
      const isSql = !!configs.custom_sql;
      setExtractType(isSql ? 'sql' : 'object');
      form.setFieldsValue({
        name: editingTask.name,
        description: editingTask.description,
        datasource_id: configs.datasource_id,
        ontology_object_id: configs.ontology_object_id,
        custom_sql: configs.custom_sql,
        columns: configs.columns,
        export_format: configs.export_format,
      });
      if (configs.datasource_id) {
        loadObjects(configs.datasource_id, configs.ontology_object_id, configs.columns);
      }
    }
    loadDatasources();
    loadExportFormats();
  }, [open, editingTask, form]);

  // 加载数据源（仅关系型数据库）
  const loadDatasources = async () => {
    try {
      const res = await datasourceService.getDatasources(undefined, 1, 100, undefined, undefined, 'mysql,postgresql,oracle,sql_server');
      setDatasources(res.data || []);
    } catch (e) {}
  };

  // 加载导出格式
  const loadExportFormats = async () => {
    try {
      const res = await ontologyService.getExportFormats();
      const formats = res.formats || [];
      setExportFormats(formats);
      if (formats.length > 0 && !form.getFieldValue('export_format')) {
        form.setFieldValue('export_format', formats[0].value);
      }
    } catch (e) {}
  };

  // 加载本体对象并回填选中对象与字段
  const loadObjects = async (dsId: string, objectId?: string, columns?: string[]) => {
    try {
      const res = await ontologyService.getObjects(dsId, 1, 100);
      const objList = res.data || [];
      setObjects(objList);
      const obj = objList.find(o => o.id === objectId) || null;
      setSelectedObject(obj);
      if (obj && !columns) {
        // 未指定字段时默认全选
        form.setFieldValue('columns', (obj.content?.columns || []).map(c => c.column_name));
      }
    } catch (e) {}
  };

  // 选择数据源后加载本体对象
  const handleDatasourceChange = (dsId: string) => {
    setSelectedObject(null);
    setObjects([]);
    form.setFieldsValue({ ontology_object_id: undefined, columns: undefined });
    if (!dsId) return;
    ontologyService.getObjects(dsId, 1, 100).then(res => {
      setObjects(res.data || []);
    }).catch(() => {});
  };

  // 选择本体对象：默认全选字段，任务名称为空时自动填充对象名称
  const handleObjectChange = (objectId: string) => {
    const obj = objects.find(o => o.id === objectId) || null;
    setSelectedObject(obj);
    const cols = (obj?.content?.columns || []).map(c => c.column_name);
    form.setFieldValue('columns', cols);
    if (obj && !editingTask) {
      const currentName = form.getFieldValue('name');
      if (!currentName || currentName.trim() === '') {
        form.setFieldValue('name', obj.name);
      }
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const configs: Record<string, any> = {
        datasource_id: values.datasource_id,
        export_format: values.export_format,
      };
      if (extractType === 'object') {
        configs.ontology_object_id = values.ontology_object_id;
        if (selectedObject) {
          const allCols = (selectedObject.content?.columns || []).map(c => c.column_name);
          const selectedCols = values.columns || [];
          if (selectedCols.length > 0 && selectedCols.length < allCols.length) {
            configs.columns = selectedCols;
          }
        }
      } else {
        configs.custom_sql = values.custom_sql?.trim();
      }

      setSubmitting(true);
      if (editingTask) {
        await taskCenterService.updateTask(editingTask.id, {
          name: values.name.trim(),
          description: values.description?.trim() || '',
          task_configs: configs,
        });
        message.success('任务更新成功');
      } else {
        await taskCenterService.createTask({
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          task_type: 'data_extract',
          task_configs: configs,
        });
        message.success('任务创建成功');
      }
      onSuccess();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败
      message.error(e.message || (editingTask ? '更新失败' : '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  // 数据抽取方式切换时清理互斥字段
  const handleExtractTypeChange = (type: 'object' | 'sql') => {
    setExtractType(type);
    if (type === 'sql') {
      form.setFieldsValue({ ontology_object_id: undefined, columns: undefined });
    } else {
      form.setFieldsValue({ custom_sql: undefined });
    }
  };

  const objectOptions = objects.map(o => ({
    value: o.id,
    label: o.title || o.name,
  }));
  const columnOptions = (selectedObject?.content?.columns || []).map(c => ({
    value: c.column_name,
    label: c.column_name_cn ? `${c.column_name}（${c.column_name_cn}）` : c.column_name,
  }));

  return (
    <Modal
      title={`${editingTask ? '编辑' : '新增'}任务（${taskTypeLabel}）`}
      open={open}
      onCancel={onCancel}
      width={640}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          {editingTask ? '保存' : '创建'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
          <Input placeholder="请输入任务名称" />
        </Form.Item>
        <Form.Item name="description" label="任务描述（可选）">
          <TextArea rows={2} placeholder="请输入任务描述" />
        </Form.Item>
        <Form.Item name="datasource_id" label="数据源" rules={[{ required: true, message: '请选择数据源' }]}>
          <Select
            placeholder="请选择数据源（仅关系型数据库）"
            showSearch
            optionFilterProp="label"
            onChange={handleDatasourceChange}
            options={datasources.map(d => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>
        <Form.Item label="抽取方式">
          <Radio.Group value={extractType} onChange={e => handleExtractTypeChange(e.target.value)}>
            <Radio.Button value="object">本体对象</Radio.Button>
            <Radio.Button value="sql">自定义SQL</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {extractType === 'object' ? (
          <>
            <Form.Item
              name="ontology_object_id"
              label="本体对象"
              rules={[{ required: true, message: '请选择本体对象' }]}
            >
              <Select
                placeholder="请选择本体对象"
                showSearch
                optionFilterProp="label"
                onChange={handleObjectChange}
                options={objectOptions}
              />
            </Form.Item>
            {selectedObject && columnOptions.length > 0 && (
              <Form.Item
                name="columns"
                label={
                  <Tooltip title="不选择时默认抽取全部字段">
                    <span>抽取字段（默认全选）</span>
                  </Tooltip>
                }
              >
                <Select
                  mode="multiple"
                  placeholder="请选择抽取字段"
                  showSearch
                  optionFilterProp="label"
                  options={columnOptions}
                />
              </Form.Item>
            )}
          </>
        ) : (
          <Form.Item
            name="custom_sql"
            label="自定义SQL"
            rules={[{ required: true, message: '请输入查询SQL' }]}
            extra="仅允许SELECT查询语句"
          >
            <TextArea rows={4} placeholder={'如：SELECT id, name FROM users'} />
          </Form.Item>
        )}
        <Form.Item
          name="export_format"
          label="导出格式"
          rules={[{ required: true, message: '请选择导出格式' }]}
        >
          <Select
            placeholder="请选择导出格式"
            options={exportFormats.map(f => ({ value: f.value, label: f.label }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DataExtractForm;
