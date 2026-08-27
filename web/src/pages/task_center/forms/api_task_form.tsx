/**
 * 接口调用任务新增/编辑弹窗
 *
 * 新增采用两步骤：
 *   第一步：选择API服务与接口
 *   第二步：参数配置（任务信息 + 接口参数值 + 请求头/超时）
 * 兼容旧版直接URL模式任务（无服务/接口关联），编辑时展示直接URL表单
 */

import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, Button, message, Steps, Tag, Descriptions, Switch } from 'antd';
import { taskCenterService, TaskInfo } from '../../../services/taskCenter';
import { apiService, ApiServer, ApiInterface } from '../../../services/api_server';

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

/** 解析接口configs（JSON字符串或对象） */
const parseConfigs = (configs: any): Record<string, any> => {
  if (!configs) return {};
  if (typeof configs === 'string') {
    try {
      return JSON.parse(configs);
    } catch (e) {
      return {};
    }
  }
  return configs;
};

/** 接口参数定义 */
interface ApiParam {
  name: string;
  in: string; // query | path | body
  type: string;
  description?: string;
  value?: any;
}

/** 参数定位显示名称 */
const PARAM_IN_LABEL: Record<string, string> = {
  query: '查询参数',
  path: '路径参数',
  body: '请求体参数',
};

/** 根据参数类型解析提交值 */
const parseParamValue = (value: any, type: string) => {
  try {
    if (type === 'integer' || type === 'number') return Number(value);
    if (type === 'boolean') return value === true || value === 'true';
    if (type === 'array' || type === 'object') {
      return typeof value === 'string' ? JSON.parse(value) : value;
    }
  } catch (e) {
    return value;
  }
  return value;
};

interface ApiTaskFormProps {
  open: boolean;
  taskTypeLabel: string;
  editingTask: TaskInfo | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ApiTaskForm: React.FC<ApiTaskFormProps> = ({ open, taskTypeLabel, editingTask, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = React.useState(false);
  // 当前步骤：0=选择服务和接口 1=参数配置
  const [current, setCurrent] = useState(0);
  // 表单模式：linked=服务/接口关联模式（两步骤） direct=直接URL模式（兼容旧任务编辑）
  const [mode, setMode] = useState<'linked' | 'direct'>('linked');
  // 服务与接口选项
  const [servers, setServers] = useState<ApiServer[]>([]);
  const [interfaces, setInterfaces] = useState<ApiInterface[]>([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ApiServer | null>(null);
  const [selectedApi, setSelectedApi] = useState<ApiInterface | null>(null);
  // 选中接口的参数定义（含填写值）
  const [apiParams, setApiParams] = useState<ApiParam[]>([]);

  // 打开弹窗时初始化/回填
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setCurrent(0);
    setMode('linked');
    setSelectedServer(null);
    setSelectedApi(null);
    setApiParams([]);
    setInterfaces([]);
    loadServers();
    if (editingTask) {
      const configs = editingTask.task_configs || {};
      if (configs.server_id && configs.api_id) {
        // 关联模式：回填服务/接口及参数值
        form.setFieldsValue({
          name: editingTask.name,
          description: editingTask.description,
          headers: configs.headers ? JSON.stringify(configs.headers, null, 2) : undefined,
          timeout: configs.timeout,
        });
        restoreLinkedTask(configs);
      } else {
        // 旧版直接URL模式任务：展示直接URL表单
        setMode('direct');
        form.setFieldsValue({
          name: editingTask.name,
          description: editingTask.description,
          url: configs.url,
          method: configs.method || 'GET',
          headers: configs.headers ? JSON.stringify(configs.headers, null, 2) : undefined,
          body: configs.body ? JSON.stringify(configs.body, null, 2) : undefined,
          timeout: configs.timeout,
        });
      }
    } else {
      form.setFieldsValue({ method: 'GET' });
    }
  }, [open, editingTask, form]);

  // 加载API服务列表（仅启用的服务）
  const loadServers = async () => {
    try {
      const res = await apiService.getServers(1, 100, undefined, undefined, 'true');
      setServers(res.data || []);
    } catch (e) {}
  };

  // 编辑关联模式任务时回填服务/接口与参数值
  const restoreLinkedTask = async (configs: Record<string, any>) => {
    try {
      const [server, api] = await Promise.all([
        apiService.getServer(configs.server_id).catch(() => null),
        apiService.getInterface(configs.api_id).catch(() => null),
      ]);
      if (server) {
        setSelectedServer(server);
        await loadInterfaces(server.id);
        form.setFieldsValue({ server_id: server.id });
      }
      if (api) {
        setSelectedApi(api);
        form.setFieldsValue({ api_id: api.id });
        initParamsFromApi(api, configs.parameters);
      }
    } catch (e) {}
  };

  // 加载指定服务下的接口列表
  const loadInterfaces = async (serverId: string) => {
    setInterfacesLoading(true);
    try {
      const res = await apiService.getInterfaces(1, 200, serverId);
      setInterfaces(res.data || []);
    } catch (e) {}
    setInterfacesLoading(false);
  };

  // 根据接口配置初始化参数定义（优先使用已保存值，其次默认值）
  const initParamsFromApi = (api: ApiInterface | null, savedParams?: Array<{ name: string; value: any }>) => {
    const cfg = parseConfigs(api?.configs);
    const defs: ApiParam[] = (cfg.parameters || []).filter((p: any) => p.name && String(p.name).trim());
    const saved = Array.isArray(savedParams) ? savedParams : (form.getFieldValue('parameters') || []);
    setApiParams(defs.map(d => {
      const s = saved.find((p: any) => p.name === d.name);
      const defaultValue = d.default !== undefined && d.default !== '' ? d.default : '';
      const savedValue = s?.value !== undefined && s?.value !== null && s?.value !== '' ? s.value : '';
      return { ...d, value: savedValue || defaultValue };
    }));
  };

  // 选择服务：重置接口选择并加载接口列表
  const handleServerChange = async (serverId: string) => {
    setSelectedServer(servers.find(s => s.id === serverId) || null);
    setSelectedApi(null);
    setApiParams([]);
    form.setFieldsValue({ api_id: undefined });
    if (!serverId) {
      setInterfaces([]);
      return;
    }
    await loadInterfaces(serverId);
  };

  // 选择接口：初始化参数定义，任务名称为空时自动填充接口标题
  const handleApiChange = (apiId: string) => {
    const api = interfaces.find(i => i.id === apiId) || null;
    setSelectedApi(api);
    initParamsFromApi(api);
    if (api && !editingTask) {
      const currentName = form.getFieldValue('name');
      if (!currentName || currentName.trim() === '') {
        form.setFieldValue('name', api.title || api.name);
      }
    }
  };

  // 更新参数值
  const updateParamValue = (index: number, value: any) => {
    setApiParams(prev => prev.map((p, i) => (i === index ? { ...p, value } : p)));
  };

  // 第一步下一步：校验服务与接口已选择
  const handleNext = async () => {
    try {
      await form.validateFields(['server_id', 'api_id']);
      setCurrent(1);
    } catch (e) {}
  };

  // 根据参数类型渲染值输入组件
  const renderParamInput = (param: ApiParam, index: number) => {
    const value = param.value ?? '';
    if (param.type === 'boolean') {
      return <Switch checked={!!value} onChange={checked => updateParamValue(index, checked)} />;
    }
    if (param.type === 'integer' || param.type === 'number') {
      return <Input type="number" value={value} placeholder="请输入数值" onChange={e => updateParamValue(index, e.target.value)} />;
    }
    if (param.type === 'array' || param.type === 'object') {
      return (
        <TextArea
          rows={2}
          value={value}
          placeholder={param.type === 'array' ? '请输入JSON数组，如 [1, 2]' : '请输入JSON对象，如 {"key":"value"}'}
          onChange={e => updateParamValue(index, e.target.value)}
        />
      );
    }
    return <Input value={value} placeholder="请输入值" onChange={e => updateParamValue(index, e.target.value)} />;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const configs: Record<string, any> = {};

      if (mode === 'direct') {
        // 直接URL模式（兼容旧任务）
        configs.url = values.url.trim();
        configs.method = values.method || 'GET';
        const headers = parseJsonText(values.headers);
        if (headers === null) {
          message.warning('请求头格式错误，请输入合法的JSON');
          return;
        }
        if (Object.keys(headers).length > 0) configs.headers = headers;
        const body = parseJsonText(values.body);
        if (body === null) {
          message.warning('请求体格式错误，请输入合法的JSON');
          return;
        }
        if (Object.keys(body).length > 0) configs.body = body;
        if (values.timeout) configs.timeout = values.timeout;
      } else {
        // 服务/接口关联模式
        if (!selectedServer || !selectedApi) {
          message.warning('请先选择服务和接口');
          setCurrent(0);
          return;
        }
        const cfg = parseConfigs(selectedApi.configs);
        configs.server_id = selectedServer.id;
        configs.server_name = selectedServer.name;
        configs.api_id = selectedApi.id;
        configs.url = selectedServer.url || '';
        configs.method = String(cfg.method || 'GET').toUpperCase();
        if (cfg.path) configs.path = cfg.path;
        // 参数值：过滤空值并按类型解析
        const parameters = apiParams
          .filter(p => p.name && p.value !== '' && p.value !== undefined && p.value !== null)
          .map(p => ({ name: p.name, in: p.in, type: p.type, value: parseParamValue(p.value, p.type) }));
        if (parameters.length > 0) configs.parameters = parameters;
        // 任务级请求头覆盖（服务级+接口级请求头在执行时自动合并）
        const headers = parseJsonText(values.headers);
        if (headers === null) {
          message.warning('请求头格式错误，请输入合法的JSON');
          return;
        }
        if (Object.keys(headers).length > 0) configs.headers = headers;
        if (values.timeout) configs.timeout = values.timeout;
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
          task_type: 'api',
          task_configs: configs,
        });
        message.success('任务创建成功');
      }
      onSuccess();
    } catch (e: any) {
      if (e?.errorFields) {
        // 校验失败：若失败字段在第一步则回到第一步
        if (mode === 'linked' && current === 1 && e.errorFields.some((f: any) => ['server_id', 'api_id'].includes(f.name?.[0]))) {
          setCurrent(0);
        }
        return;
      }
      message.error(e.message || (editingTask ? '更新失败' : '创建失败'));
    } finally {
      setSubmitting(false);
    }
  };

  // 弹窗底部按钮（按步骤/模式区分）
  const renderFooter = () => {
    if (mode === 'direct') {
      return [
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          {editingTask ? '保存' : '创建'}
        </Button>,
      ];
    }
    if (current === 0) {
      return [
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button key="next" type="primary" onClick={handleNext}>下一步</Button>,
      ];
    }
    return [
      <Button key="prev" onClick={() => setCurrent(0)}>上一步</Button>,
      <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
        {editingTask ? '保存' : '创建'}
      </Button>,
    ];
  };

  // 选中接口的配置信息
  const selectedApiCfg = parseConfigs(selectedApi?.configs);

  // 接口下拉选项（展示请求方式与路径）
  const interfaceOptions = interfaces.map(i => {
    const cfg = parseConfigs(i.configs);
    return {
      value: i.id,
      label: `${cfg.method || 'GET'} ${cfg.path || ''} - ${i.title || i.name}`,
    };
  });

  return (
    <Modal
      title={`${editingTask ? '编辑' : '新增'}任务（${taskTypeLabel}）`}
      open={open}
      onCancel={onCancel}
      width={720}
      footer={renderFooter()}
    >
      {mode === 'direct' ? (
        /* 直接URL模式（兼容旧任务编辑） */
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="description" label="任务描述（可选）">
            <TextArea rows={2} placeholder="请输入任务描述" />
          </Form.Item>
          <Form.Item name="url" label="请求URL" rules={[{ required: true, message: '请输入请求URL' }]}>
            <Input placeholder="如：https://api.example.com/data" />
          </Form.Item>
          <Form.Item name="method" label="请求方式" rules={[{ required: true, message: '请选择请求方式' }]}>
            <Select options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="headers" label="请求头（JSON，可选）">
            <TextArea rows={3} placeholder={'如：{"Authorization": "Bearer xxx"}'} />
          </Form.Item>
          <Form.Item name="body" label="请求体（JSON，可选）">
            <TextArea rows={3} placeholder={'如：{"key": "value"}'} />
          </Form.Item>
          <Form.Item name="timeout" label="超时时间（秒，可选）">
            <InputNumber min={1} max={300} placeholder="默认30秒" style={{ width: 160 }} />
          </Form.Item>
        </Form>
      ) : (
        <>
          <Steps
            current={current}
            items={[{ title: '选择服务和接口' }, { title: '参数配置' }]}
            style={{ marginBottom: 24 }}
          />
          <Form form={form} layout="vertical">
            {/* 第一步：选择服务和接口 */}
            <div style={{ display: current === 0 ? 'block' : 'none' }}>
              <Form.Item name="server_id" label="API服务" rules={[{ required: true, message: '请选择API服务' }]}>
                <Select
                  placeholder="请选择API服务"
                  showSearch
                  optionFilterProp="label"
                  onChange={handleServerChange}
                  options={servers.map(s => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>
              <Form.Item
                name="api_id"
                label="接口"
                rules={[{ required: true, message: '请选择接口' }]}
                extra={selectedServer && !interfacesLoading && interfaces.length === 0 ? '该服务下暂无接口' : undefined}
              >
                <Select
                  placeholder={selectedServer ? '请选择接口' : '请先选择API服务'}
                  showSearch
                  optionFilterProp="label"
                  disabled={!selectedServer}
                  loading={interfacesLoading}
                  onChange={handleApiChange}
                  options={interfaceOptions}
                />
              </Form.Item>
              {selectedApi && (
                <Descriptions
                  size="small"
                  column={1}
                  bordered
                  style={{ marginTop: 8 }}
                >
                  <Descriptions.Item label="请求方式">
                    <Tag color={{ GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'purple' }[selectedApiCfg.method] || 'default'}>
                      {selectedApiCfg.method || 'GET'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="接口路径">{selectedApiCfg.path || '/'}</Descriptions.Item>
                  {selectedApi.title && (
                    <Descriptions.Item label="接口标题">{selectedApi.title}</Descriptions.Item>
                  )}
                  {selectedApi.description && (
                    <Descriptions.Item label="接口说明">{selectedApi.description}</Descriptions.Item>
                  )}
                </Descriptions>
              )}
            </div>

            {/* 第二步：参数配置 */}
            <div style={{ display: current === 1 ? 'block' : 'none' }}>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="请输入任务名称" />
              </Form.Item>
              <Form.Item name="description" label="任务描述（可选）">
                <TextArea rows={2} placeholder="请输入任务描述" />
              </Form.Item>
              {apiParams.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>接口参数</div>
                  {apiParams.map((param, idx) => (
                    <Form.Item
                      key={`${param.in}-${param.name}`}
                      label={
                        <span>
                          {param.name}
                          <Tag style={{ marginLeft: 8 }}>{PARAM_IN_LABEL[param.in] || param.in}</Tag>
                          {param.description && <span style={{ color: 'rgba(0,0,0,0.45)', fontWeight: 400 }}>（{param.description}）</span>}
                        </span>
                      }
                      style={{ marginBottom: 12 }}
                    >
                      {renderParamInput(param, idx)}
                    </Form.Item>
                  ))}
                </div>
              )}
              <Form.Item
                name="headers"
                label="请求头（JSON，可选）"
                extra="覆盖服务级与接口级请求头"
              >
                <TextArea rows={3} placeholder={'如：{"Authorization": "Bearer xxx"}'} />
              </Form.Item>
              <Form.Item name="timeout" label="超时时间（秒，可选）">
                <InputNumber min={1} max={300} placeholder="默认30秒" style={{ width: 160 }} />
              </Form.Item>
            </div>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default ApiTaskForm;
