/**
 * 接口调用任务新增/编辑弹窗
 *
 * 新增采用三步骤：
 *   第一步：选择服务和接口（含任务名称、任务描述）
 *   第二步：参数配置（单参数/多参数模式）+ 请求头行编辑
 *   第三步：导出格式选择（JSON/Excel/Markdown，配置导出内容）
 * 兼容旧版直接URL模式任务（无服务/接口关联），编辑时展示直接URL表单
 *
 * 步骤校验规则：
 *   - 点击"下一步"或步骤条跳转时，会校验当前步骤所有必填项
 *   - 校验失败则阻止跳转并提示用户
 */

import React, { useEffect, useState } from 'react';
import {
  Modal, Form, Input, Select, InputNumber, Button, message, Steps,
  Tag, Descriptions, Switch, Radio, Checkbox, Space, Row, Col, Tooltip,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { taskCenterService, TaskInfo } from '../../../services/taskCenter';
import {
  apiService, ApiServer, ApiInterface,
  HEADER_TYPE_OPTIONS, parseHeaders,
} from '../../../services/api_server';

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
  in: string;
  type: string;
  description?: string;
  value?: any;
}

/** 请求头定义 */
interface HeaderItem {
  key: string;
  value: string;
  type: string;
}

/** 导出格式选项（含样例） */
const EXPORT_FORMAT_OPTIONS = [
  {
    value: 'json', label: 'JSON',
    example: '[\n  {\n    "status": "success",\n    "error": null,\n    "path": "/api/data",\n    "params": {"id": "1"},\n    "response": {"code": 200}\n  },\n  {\n    "status": "fail",\n    "error": "Request failed with status code 404",\n    "path": "/api/data",\n    "params": {"id": "999"},\n    "response": null\n  }\n]',
  },
  {
    value: 'excel', label: 'Excel',
    example: '列：执行状态 | 错误消息 | 接口路径 | 参数 | 状态码 | 响应\n行：success | | /api/data | id=1 | 200 | {"code":200}\n行：fail | 404 Not Found | /api/data | id=999 | 404 | ',
  },
  {
    value: 'markdown', label: 'Markdown',
    example: '## 接口调用结果\n\n### 第1组参数 ✅\n- **状态**: success\n- **路径**: `/api/data`\n- **参数**: `{"id": "1"}`\n- **响应**:\n```json\n{"code": 200}\n```\n\n### 第2组参数 ❌\n- **状态**: fail\n- **错误**: Request failed with status code 404\n- **路径**: `/api/data`\n- **参数**: `{"id": "999"}`',
  },
];

/** 导出内容选项 */
const EXPORT_CONTENT_OPTIONS = [
  { value: 'path', label: '接口路径' },
  { value: 'params', label: '接口参数' },
  { value: 'response', label: '接口返回结果' },
];

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

/** 根据参数类型渲染对应的值输入组件 */
const renderValueInput = (value: any, type: string, onChange: (v: any) => void) => {
  if (type === 'boolean') {
    return <Switch checked={!!value} onChange={(checked: boolean) => onChange(checked)} />;
  }
  if (type === 'integer' || type === 'number') {
    return <Input type="number" value={value} placeholder="请输入数值" onChange={(e) => onChange(e.target.value)} />;
  }
  if (type === 'array' || type === 'object') {
    return (
      <TextArea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={type === 'array' ? '请输入JSON数组，如 [1, 2]' : '请输入JSON对象，如 {"key":"value"}'}
      />
    );
  }
  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="请输入值" />;
};

/** 统计多参数JSON中的参数组数量 */
const countParamGroups = (text: string): number => {
  try {
    const parsed = JSON.parse(text || '[]');
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'object' && !Array.isArray(item)).length;
    }
  } catch (e) {}
  return 0;
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
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<'linked' | 'direct'>('linked');
  const [paramMode, setParamMode] = useState<'single' | 'multi'>('single');
  const [servers, setServers] = useState<ApiServer[]>([]);
  const [interfaces, setInterfaces] = useState<ApiInterface[]>([]);
  const [interfacesLoading, setInterfacesLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ApiServer | null>(null);
  const [selectedApi, setSelectedApi] = useState<ApiInterface | null>(null);
  const [apiParams, setApiParams] = useState<ApiParam[]>([]);
  const [multiParamsText, setMultiParamsText] = useState('');
  const [multiParamsCount, setMultiParamsCount] = useState(0);
  const [exportFormat, setExportFormat] = useState('json');
  // 请求头行编辑状态
  const [headers, setHeaders] = useState<HeaderItem[]>([]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setCurrent(0);
    setMode('linked');
    setParamMode('single');
    setSelectedServer(null);
    setSelectedApi(null);
    setApiParams([]);
    setMultiParamsText('');
    setMultiParamsCount(0);
    setInterfaces([]);
    setHeaders([]);
    setExportFormat('json');
    loadServers();
    if (editingTask) {
      const configs = editingTask.task_configs || {};
      if (configs.server_id && configs.api_id) {
        form.setFieldsValue({
          name: editingTask.name,
          description: editingTask.description,
          timeout: configs.timeout ?? 30,
          export_format: configs.export_format || 'json',
          export_contents: configs.export_contents || ['path', 'params', 'response'],
        });
        setExportFormat(configs.export_format || 'json');
        setHeaders(parseHeaders(configs.headers));
        if (configs.param_mode === 'multi' || (Array.isArray(configs.parameters) && configs.parameters.length > 0 && Array.isArray(configs.parameters[0]))) {
          setParamMode('multi');
        }
        restoreLinkedTask(configs);
      } else {
        setMode('direct');
        form.setFieldsValue({
          name: editingTask.name,
          description: editingTask.description,
          url: configs.url,
          method: configs.method || 'GET',
          headers: configs.headers ? (typeof configs.headers === 'string' ? configs.headers : JSON.stringify(configs.headers, null, 2)) : undefined,
          body: configs.body ? (typeof configs.body === 'string' ? configs.body : JSON.stringify(configs.body, null, 2)) : undefined,
          timeout: configs.timeout ?? 30,
          export_format: configs.export_format || 'json',
          export_contents: configs.export_contents || ['path', 'params', 'response'],
        });
        setExportFormat(configs.export_format || 'json');
      }
    } else {
      form.setFieldsValue({
        timeout: 30,
        export_format: 'json',
        export_contents: ['path', 'params', 'response'],
      });
    }
  }, [open, editingTask, form]);

  const loadServers = async () => {
    try {
      const res = await apiService.getServers(1, 100, undefined, undefined, 'true');
      setServers(res.data || []);
    } catch (e) {}
  };

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
        if (configs.param_mode === 'multi' || (Array.isArray(configs.parameters) && configs.parameters.length > 0 && Array.isArray(configs.parameters[0]))) {
          initMultiParamsFromApi(api, configs.parameters);
        } else {
          initParamsFromApi(api, configs.parameters);
        }
      }
    } catch (e) {}
  };

  const loadInterfaces = async (serverId: string) => {
    setInterfacesLoading(true);
    try {
      const res = await apiService.getInterfaces(1, 200, serverId);
      setInterfaces(res.data || []);
    } catch (e) {}
    setInterfacesLoading(false);
  };

  const initParamsFromApi = (api: ApiInterface | null, savedParams?: any) => {
    const cfg = parseConfigs(api?.configs);
    const defs: ApiParam[] = (cfg.parameters || []).filter((p: any) => p.name && String(p.name).trim());
    const saved = Array.isArray(savedParams) ? savedParams : [];
    setApiParams(defs.map(d => {
      const s = saved.find((p: any) => p.name === d.name);
      const defaultValue = d.default !== undefined && d.default !== '' ? d.default : '';
      const savedValue = s?.value !== undefined && s?.value !== null && s?.value !== '' ? s.value : '';
      return { ...d, value: savedValue || defaultValue };
    }));
  };

  const initMultiParamsFromApi = (api: ApiInterface | null, savedParams?: any) => {
    const cfg = parseConfigs(api?.configs);
    const defs: ApiParam[] = (cfg.parameters || []).filter((p: any) => p.name && String(p.name).trim());
    let items: Record<string, any>[] = [];
    if (Array.isArray(savedParams) && savedParams.length > 0) {
      if (savedParams.every((p: any) => !Array.isArray(p))) {
        // 新格式：[{key: value}] 或 [{name, value}]
        items = savedParams.map((item: any) => {
          if (item.name !== undefined && item.value !== undefined) {
            // 旧格式 [{name, value}] -> 新格式 {name: value}
            return { [item.name]: item.value };
          }
          return { ...item };
        });
      } else {
        // 旧格式 [[{name, value}]] -> 新格式 [{key: value}]
        items = (savedParams as any[][]).map(group => {
          const obj: Record<string, any> = {};
          group.forEach((p: any) => {
            if (p.name) obj[p.name] = p.value;
          });
          return obj;
        });
      }
    } else if (defs.length > 0) {
      const obj: Record<string, any> = {};
      defs.forEach(d => {
        obj[d.name] = d.default !== undefined && d.default !== '' ? d.default : '';
      });
      items = [obj];
    }
    setMultiParamsText(JSON.stringify(items, null, 2));
    setMultiParamsCount(items.length);
  };

  const handleServerChange = async (serverId: string) => {
    setSelectedServer(servers.find(s => s.id === serverId) || null);
    setSelectedApi(null);
    setApiParams([]);
    setMultiParamsText('');
    setMultiParamsCount(0);
    form.setFieldsValue({ api_id: undefined });
    if (!serverId) {
      setInterfaces([]);
      return;
    }
    await loadInterfaces(serverId);
  };

  const handleApiChange = (apiId: string) => {
    const api = interfaces.find(i => i.id === apiId) || null;
    setSelectedApi(api);
    if (paramMode === 'single') {
      initParamsFromApi(api);
    } else {
      initMultiParamsFromApi(api);
    }
    if (api && !editingTask) {
      const currentName = form.getFieldValue('name');
      if (!currentName || currentName.trim() === '') {
        form.setFieldValue('name', api.title || api.name);
      }
    }
  };

  const updateParamValue = (index: number, value: any) => {
    setApiParams(prev => prev.map((p, i) => (i === index ? { ...p, value } : p)));
  };

  const handleParamModeChange = (modeVal: 'single' | 'multi') => {
    setParamMode(modeVal);
    if (!selectedApi) return;
    if (modeVal === 'single') {
      if (multiParamsText) {
        try {
          const parsed = JSON.parse(multiParamsText);
          if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && !Array.isArray(parsed[0])) {
            // 新格式 [{key: value}] -> 单参数 [{name, in, type, value}]
            const firstItem = parsed[0];
            const cfg = parseConfigs(selectedApi.configs);
            const defs: ApiParam[] = (cfg.parameters || []).filter((p: any) => p.name && String(p.name).trim());
            setApiParams(defs.map(d => ({
              name: d.name, in: d.in, type: d.type,
              value: firstItem[d.name] ?? (d.default !== undefined && d.default !== '' ? d.default : ''),
            })));
          }
        } catch (e) {
          initParamsFromApi(selectedApi);
        }
      } else {
        initParamsFromApi(selectedApi);
      }
    } else {
      const cfg = parseConfigs(selectedApi.configs);
      const defs: ApiParam[] = (cfg.parameters || []).filter((p: any) => p.name && String(p.name).trim());
      if (apiParams.length > 0) {
        const obj: Record<string, any> = {};
        apiParams.forEach(p => { obj[p.name] = p.value; });
        setMultiParamsText(JSON.stringify([obj], null, 2));
        setMultiParamsCount(1);
      } else if (defs.length > 0) {
        const obj: Record<string, any> = {};
        defs.forEach(d => { obj[d.name] = d.default !== undefined && d.default !== '' ? d.default : ''; });
        setMultiParamsText(JSON.stringify([obj], null, 2));
        setMultiParamsCount(1);
      } else {
        setMultiParamsText('[]');
        setMultiParamsCount(0);
      }
    }
  };

  // 请求头操作
  const updateHeaderValue = (index: number, value: any) => {
    setHeaders(prev => prev.map((h, i) => (i === index ? { ...h, value } : h)));
  };
  const updateHeaderKey = (index: number, key: string) => {
    setHeaders(prev => prev.map((h, i) => (i === index ? { ...h, key } : h)));
  };
  const updateHeaderType = (index: number, type: string) => {
    setHeaders(prev => prev.map((h, i) => (i === index ? { ...h, type } : h)));
  };
  const addHeader = () => {
    setHeaders(prev => [...prev, { key: '', value: '', type: 'string' }]);
  };
  const removeHeader = (index: number) => {
    setHeaders(prev => prev.filter((_, i) => i !== index));
  };

  /** 多参数JSON失焦时统计参数项 */
  const handleMultiParamsBlur = () => {
    const count = countParamGroups(multiParamsText);
    setMultiParamsCount(count);
  };

  /** 校验当前步骤，返回是否通过 */
  const validateCurrentStep = async (step: number): Promise<boolean> => {
    try {
      if (step === 0) {
        await form.validateFields(['name', 'server_id', 'api_id']);
      } else if (step === 1) {
        const emptyKeyHeader = headers.find(h => !h.key || !h.key.trim());
        if (emptyKeyHeader) {
          message.warning('请求头存在空的键名，请填写或删除空行');
          return false;
        }
        if (paramMode === 'multi') {
          try {
            const parsed = JSON.parse(multiParamsText || '[]');
            if (!Array.isArray(parsed)) {
              message.warning('多参数格式错误，必须为JSON数组');
              return false;
            }
            if (!parsed.every(item => typeof item === 'object' && !Array.isArray(item))) {
              message.warning('多参数格式错误，每项必须为对象，如 {"id": "1"}');
              return false;
            }
          } catch (e) {
            message.warning('多参数JSON格式错误');
            return false;
          }
        }
      } else if (step === 2) {
        await form.validateFields(['export_format', 'export_contents']);
      }
      return true;
    } catch (e) {
      message.warning('请完善当前步骤的必填项');
      return false;
    }
  };

  const handleStepChange = async (step: number) => {
    if (step === current) return;
    if (step > current) {
      const valid = await validateCurrentStep(current);
      if (!valid) return;
    }
    setCurrent(step);
  };

  const handleNext = async () => {
    const valid = await validateCurrentStep(current);
    if (!valid) return;
    setCurrent(current + 1);
  };

  const handlePrev = () => {
    setCurrent(current - 1);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const configs: Record<string, any> = {};

      if (mode === 'direct') {
        configs.url = values.url.trim();
        configs.method = values.method || 'GET';
        const headersObj = parseJsonText(values.headers);
        if (headersObj === null) {
          message.warning('请求头格式错误，请输入合法的JSON');
          return;
        }
        if (Object.keys(headersObj).length > 0) configs.headers = headersObj;
        const body = parseJsonText(values.body);
        if (body === null) {
          message.warning('请求体格式错误，请输入合法的JSON');
          return;
        }
        if (Object.keys(body).length > 0) configs.body = body;
        configs.timeout = values.timeout ?? 30;
        configs.export_format = values.export_format || 'json';
        configs.export_contents = values.export_contents || ['path', 'params', 'response'];
      } else {
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

        configs.param_mode = paramMode;
        if (paramMode === 'single') {
          const parameters = apiParams
            .filter(p => p.name && p.value !== '' && p.value !== undefined && p.value !== null)
            .map(p => ({ name: p.name, in: p.in, type: p.type, value: parseParamValue(p.value, p.type) }));
          if (parameters.length > 0) configs.parameters = parameters;
        } else {
          let parsedItems: any[] = [];
          try {
            parsedItems = JSON.parse(multiParamsText || '[]');
          } catch (e) {
            message.warning('多参数JSON格式错误');
            return;
          }
          if (Array.isArray(parsedItems)) {
            // 新格式：[{key: value}]，提交时直接保存
            // 兼容旧格式：[[{name, value}]]
            const normalized = parsedItems.map(item => {
              if (Array.isArray(item)) {
                // 旧格式 -> 新格式
                const obj: Record<string, any> = {};
                item.forEach((p: any) => { if (p.name) obj[p.name] = p.value; });
                return obj;
              }
              if (typeof item === 'object' && item !== null) {
                return item;
              }
              return null;
            }).filter(item => item !== null && Object.keys(item).length > 0);
            configs.parameters = normalized;
          }
        }

        const validHeaders = headers
          .filter(h => h.key && h.key.trim())
          .map(h => ({ key: h.key.trim(), value: h.value, type: h.type }));
        if (validHeaders.length > 0) configs.headers = validHeaders;
        configs.timeout = values.timeout ?? 30;
        configs.export_format = values.export_format || 'json';
        configs.export_contents = values.export_contents || ['path', 'params', 'response'];
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
    if (current === 1) {
      return [
        <Button key="prev" onClick={handlePrev}>上一步</Button>,
        <Button key="next" type="primary" onClick={handleNext}>下一步</Button>,
      ];
    }
    return [
      <Button key="prev" onClick={handlePrev}>上一步</Button>,
      <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
        {editingTask ? '保存' : '创建'}
      </Button>,
    ];
  };

  const selectedApiCfg = parseConfigs(selectedApi?.configs);

  const interfaceOptions = interfaces.map(i => {
    const cfg = parseConfigs(i.configs);
    return {
      value: i.id,
      label: `${cfg.method || 'GET'} ${cfg.path || ''} - ${i.title || i.name}`,
    };
  });

  const serverOptions = servers.map(s => ({
    value: s.id,
    label: (
      <Space size={8}>
        <span>{s.name}</span>
        {s.description && (
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 400 }}>
            {s.description}
          </span>
        )}
      </Space>
    ),
  }));

  const currentExportExample = EXPORT_FORMAT_OPTIONS.find(o => o.value === exportFormat)?.example || '';

  return (
    <Modal
      title={`${editingTask ? '编辑' : '新增'}任务（${taskTypeLabel}）`}
      open={open}
      onCancel={onCancel}
      width={800}
      footer={renderFooter()}
    >
      {mode === 'direct' ? (
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
          <Form.Item name="export_format" label="导出格式">
            <Select options={EXPORT_FORMAT_OPTIONS} />
          </Form.Item>
          <Form.Item name="export_contents" label="导出内容">
            <Checkbox.Group options={EXPORT_CONTENT_OPTIONS} />
          </Form.Item>
        </Form>
      ) : (
        <>
          <Steps
            current={current}
            items={[
              { title: '选择服务和接口' },
              { title: '参数配置' },
              { title: '导出格式' },
            ]}
            onChange={handleStepChange}
            style={{ marginBottom: 24 }}
          />
          <Form form={form} layout="vertical" initialValues={{ timeout: 30, export_format: 'json', export_contents: ['path', 'params', 'response'] }}>
            {/* 第一步：选择服务和接口 + 任务信息 */}
            <div style={{ display: current === 0 ? 'block' : 'none' }}>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="请输入任务名称" />
              </Form.Item>
              <Form.Item name="description" label="任务描述（可选）">
                <TextArea rows={2} placeholder="请输入任务描述" />
              </Form.Item>
              <Form.Item name="server_id" label="API服务" rules={[{ required: true, message: '请选择API服务' }]}>
                <Select
                  placeholder="请选择API服务"
                  showSearch
                  optionFilterProp="label"
                  onChange={handleServerChange}
                  options={serverOptions}
                  optionRender={(option) => option.data.label}
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
                <Descriptions size="small" column={1} bordered style={{ marginTop: 8 }}>
                  <Descriptions.Item label="请求方式">
                    <Tag color={{ GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'purple' }[selectedApiCfg.method] || 'default'}>
                      {selectedApiCfg.method || 'GET'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="接口路径">{selectedApiCfg.path || '/'}</Descriptions.Item>
                  {selectedApi.title && <Descriptions.Item label="接口标题">{selectedApi.title}</Descriptions.Item>}
                  {selectedApi.description && <Descriptions.Item label="接口说明">{selectedApi.description}</Descriptions.Item>}
                </Descriptions>
              )}
            </div>

            {/* 第二步：参数配置 */}
            <div style={{ display: current === 1 ? 'block' : 'none' }}>
              {/* 请求URL展示 */}
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontWeight: 600 }}>请求URL：</span>
                <Tag color="blue">{selectedServer?.url || ''}</Tag>
                <Tag color="green">{selectedApiCfg.method || 'GET'}</Tag>
                <Tag>{selectedApiCfg.path || '/'}</Tag>
              </div>

              <Form.Item label="参数模式">
                <Radio.Group value={paramMode} onChange={(e) => handleParamModeChange(e.target.value)}>
                  <Radio.Button value="single">单参数</Radio.Button>
                  <Radio.Button value="multi">多参数</Radio.Button>
                </Radio.Group>
                {paramMode === 'multi' && (
                  <Tooltip title="数组每一项会单独调用接口">
                    <EyeOutlined style={{ marginLeft: 8, color: '#1677ff', cursor: 'pointer' }} />
                  </Tooltip>
                )}
              </Form.Item>

              {paramMode === 'single' ? (
                <>
                  {apiParams.length > 0 ? (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 8, fontWeight: 600 }}>请求参数</div>
                      {apiParams.map((param, idx) => (
                        <Row key={`${param.in}-${param.name}-${idx}`} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                          <Col span={5}>
                            <span>{param.name}</span>
                          </Col>
                          <Col span={4}>
                            <Tag>{param.in}</Tag>
                          </Col>
                          <Col span={4}>
                            <Tag color="blue">{param.type}</Tag>
                          </Col>
                          <Col span={10}>
                            {renderValueInput(param.value, param.type, (v) => updateParamValue(idx, v))}
                          </Col>
                          <Col span={1}>
                            {param.description && (
                              <Tooltip title={param.description}>
                                <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: 12 }}>ⓘ</span>
                              </Tooltip>
                            )}
                          </Col>
                        </Row>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginBottom: 16, color: 'rgba(0,0,0,0.45)' }}>该接口无请求参数</div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600 }}>多参数JSON</div>
                  <TextArea
                    rows={6}
                    value={multiParamsText}
                    onChange={(e) => setMultiParamsText(e.target.value)}
                    onBlur={handleMultiParamsBlur}
                    placeholder={'请输入JSON数组，如：\n[\n  {"id": "1"},\n  {"id": "2", "name": "test"}\n]'}                  />
                  {multiParamsCount > 0 && (
                    <div style={{ marginTop: 4, color: '#1677ff', fontSize: 13 }}>
                      检测到 <strong>{multiParamsCount}</strong> 组参数，将分别调用接口
                    </div>
                  )}
                </>
              )}

              {/* 请求头 - 行编辑模式 */}
              <Form.Item label="请求头（可选）" extra="覆盖服务级与接口级请求头">
                {headers.length > 0 ? (
                  headers.map((h, idx) => (
                    <Row key={idx} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                      <Col span={7}>
                        <Input
                          value={h.key}
                          onChange={(e) => updateHeaderKey(idx, e.target.value)}
                          placeholder="请求头名"
                        />
                      </Col>
                      <Col span={4}>
                        <Select
                          value={h.type}
                          onChange={(v) => updateHeaderType(idx, v)}
                          options={HEADER_TYPE_OPTIONS}
                          placeholder="类型"
                        />
                      </Col>
                      <Col span={11}>
                        {renderValueInput(h.value, h.type, (v) => updateHeaderValue(idx, v))}
                      </Col>
                      <Col span={2} style={{ textAlign: 'center' }}>
                        <MinusCircleOutlined onClick={() => removeHeader(idx)} style={{ color: '#ff4d4f' }} />
                      </Col>
                    </Row>
                  ))
                ) : (
                  <div style={{ color: 'rgba(0,0,0,0.45)', marginBottom: 8 }}>无请求头</div>
                )}
                <Button type="dashed" onClick={addHeader} icon={<PlusOutlined />} block style={{ marginTop: 4 }}>
                  添加请求头
                </Button>
              </Form.Item>

              <Form.Item name="timeout" label="超时时间（秒，可选）">
                <InputNumber min={1} max={300} placeholder="默认30秒" style={{ width: 160 }} />
              </Form.Item>
            </div>

            {/* 第三步：导出格式 */}
            <div style={{ display: current === 2 ? 'block' : 'none' }}>
              <Form.Item name="export_format" label="导出格式" rules={[{ required: true, message: '请选择导出格式' }]}>
                <Radio.Group
                  value={exportFormat}
                  onChange={(e) => {
                    setExportFormat(e.target.value);
                    form.setFieldValue('export_format', e.target.value);
                  }}
                >
                  {EXPORT_FORMAT_OPTIONS.map(opt => (
                    <Radio.Button key={opt.value} value={opt.value}>{opt.label}</Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>

              <div style={{ marginTop: -8, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>导出样例（{EXPORT_FORMAT_OPTIONS.find(o => o.value === exportFormat)?.label}）</div>
                <pre style={{
                  background: '#f5f5f5', borderRadius: 6, padding: 12,
                  fontSize: 12, color: 'rgba(0,0,0,0.75)', margin: 0,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  maxHeight: 200, overflow: 'auto',
                }}>
                  {currentExportExample}
                </pre>
              </div>

              <Form.Item name="export_contents" label="导出内容" rules={[{ required: true, message: '请选择导出内容' }]}>
                <Checkbox.Group options={EXPORT_CONTENT_OPTIONS} />
              </Form.Item>
            </div>
          </Form>
        </>
      )}
    </Modal>
  );
};

export default ApiTaskForm;
