/**
 * 文档切片任务新增/编辑弹窗（委托知识库文档）
 */

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, message } from 'antd';
import { taskCenterService, TaskInfo } from '../../../services/taskCenter';
import { knowledgebaseService, Knowledgebase } from '../../../services/knowledgebase';

const { TextArea } = Input;

/** 解析JSON文本，失败返回null */
const parseJsonText = (text?: string): Record<string, any> | null => {
  if (!text || !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

interface DocChunkFormProps {
  open: boolean;
  taskTypeLabel: string;
  editingTask: TaskInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const DocChunkForm: React.FC<DocChunkFormProps> = ({ open, taskTypeLabel, editingTask, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  // 知识库与切片方法选项
  const [kbs, setKbs] = useState<Knowledgebase[]>([]);
  const [chunkMethods, setChunkMethods] = useState<Array<{ key: string; label: string }>>([]);

  // 打开弹窗时初始化/回填
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (editingTask) {
      const configs = editingTask.task_configs || {};
      const chunkConfig = configs.chunk_config;
      form.setFieldsValue({
        name: editingTask.name,
        description: editingTask.description,
        kb_id: configs.kb_id,
        chunk_method: configs.chunk_method,
        chunk_config: chunkConfig
          ? (typeof chunkConfig === 'string' ? chunkConfig : JSON.stringify(chunkConfig, null, 2))
          : undefined,
        file_name: configs.file_name,
        tags: configs.tags,
      });
    }
    loadKnowledgebases();
    loadChunkMethods();
  }, [open, editingTask, form]);

  // 加载知识库列表
  const loadKnowledgebases = async () => {
    try {
      const res = await knowledgebaseService.getKnowledgebases(1, 100);
      setKbs(res.data || []);
    } catch (e) {}
  };

  // 加载可用切片方法
  const loadChunkMethods = async () => {
    try {
      const res = await knowledgebaseService.getAvailableChunkMethods();
      const methods = res.available_methods || [];
      setChunkMethods(methods);
      if (methods.length > 0 && !form.getFieldValue('chunk_method')) {
        form.setFieldValue('chunk_method', res.default_method || methods[0].key);
      }
    } catch (e) {}
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const configs: Record<string, any> = {
        kb_id: values.kb_id,
        title: values.name.trim(),
        chunk_method: values.chunk_method,
      };
      const chunkConfig = parseJsonText(values.chunk_config);
      if (chunkConfig === null) {
        message.warning('切片配置格式错误，请输入合法的JSON');
        return;
      }
      if (Object.keys(chunkConfig).length > 0) configs.chunk_config = chunkConfig;
      if (values.file_name?.trim()) configs.file_name = values.file_name.trim();
      if (values.tags?.trim()) {
        configs.tags = values.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
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
          task_type: 'doc_chunk',
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

  return (
    <Modal
      title={`${editingTask ? '编辑' : '新增'}任务（${taskTypeLabel}）`}
      open={open}
      onCancel={onCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          {editingTask ? '保存' : '创建'}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="知识标题" rules={[{ required: true, message: '请输入知识标题' }]}>
          <Input placeholder="请输入知识标题" />
        </Form.Item>
        <Form.Item name="description" label="任务描述（可选）">
          <TextArea rows={2} placeholder="请输入任务描述" />
        </Form.Item>
        <Form.Item name="kb_id" label="所属知识库" rules={[{ required: true, message: '请选择所属知识库' }]}>
          <Select
            placeholder="请选择所属知识库"
            showSearch
            optionFilterProp="label"
            disabled={!!editingTask}
            options={kbs.map(kb => ({ value: kb.id, label: kb.name }))}
          />
        </Form.Item>
        <Form.Item name="chunk_method" label="切片方法" rules={[{ required: true, message: '请选择切片方法' }]}>
          <Select
            placeholder="请选择切片方法"
            options={chunkMethods.map(m => ({ value: m.key, label: m.label }))}
          />
        </Form.Item>
        <Form.Item name="chunk_config" label="切片配置（JSON，可选）">
          <TextArea rows={3} placeholder={'如：{"delimiter": "\\n\\n"}'} />
        </Form.Item>
        <Form.Item name="file_name" label="文件名（可选）">
          <Input placeholder="请输入文档文件名" />
        </Form.Item>
        <Form.Item name="tags" label="标签（逗号分隔，可选）">
          <Input placeholder="如：标签1,标签2" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default DocChunkForm;
