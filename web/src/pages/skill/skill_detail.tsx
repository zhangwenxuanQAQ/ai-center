import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, message, Spin, Tag, Segmented as AntSegmented, Form, Row, Col,
  Input, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, FolderOpenOutlined, FileTextOutlined,
  UndoOutlined, DownloadOutlined, PlusOutlined, MinusCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { skillService, Skill } from '../../services/skill';
import { splitFrontmatter, serializeFrontmatter } from '../../utils/skillFrontmatter';
import SkillFileManager from './skill_file_manager';
import '../../styles/common.css';
import './skill.less';

/**
 * 技能详情页
 * - 路由: /skill/setting/:id
 * - 顶部：返回 + 居中 Segment 切换（技能内容 / 文件目录）+ 占位
 * - 技能内容 Tab：拆分字段展示与编辑（名称 / 描述 / 元数据 / 内容）
 * - 文件目录 Tab：内嵌文件浏览器，点击文件弹出抽屉编辑器
 */
const SkillDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // 技能（含 skill_md_content）
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'content' | 'files'>('content');

  // 技能内容字段编辑
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [metadataRows, setMetadataRows] = useState<{ key: string; value: string }[]>([]);
  const [hasNestBlock, setHasNestBlock] = useState(false);
  const [body, setBody] = useState('');
  const KEY_RE = /^[A-Za-z0-9_-]+$/;
  // MDEditor 需要固定高度（preview 模式依赖容器高度渲染内容）：
  // 按内容行数动态估算高度（行高约21px + toolbar约50px + 边距），限制在 [300, 视口-270] 区间
  const editorHeight = Math.min(
    Math.max(body.split('\n').length * 21 + 120, 300),
    Math.max(window.innerHeight - 270, 300),
  );
  // 生成 SKILL.md frontmatter 内的 metadata 部分：
  // - hasNestBlock=true  => "  key: value" 缩进，作为 "metadata:" 嵌套块的后半段
  // - hasNestBlock=false => 顶层 "key: value"（与后端 build_skill_md 输出格式一致）
  const metadataText = metadataRows
    .filter(r => r.key.trim() && r.value.trim())
    .map(r => {
      const k = r.key.trim();
      const v = r.value.trim().replace(/^["']|["']$/g, '');
      return hasNestBlock ? `  ${k}: ${v}` : `${k}: ${v}`;
    })
    .join('\n');

  // 保存相关
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [initialMd, setInitialMd] = useState('');
  // 脏检测基线（字段级快照）：加载/保存成功后记录，后续用当前字段值与基线比较。
  // 不再比较重新序列化的 md 文本（前端序列化格式与后端 build_skill_md 输出格式存在差异，会导致误报）
  const [baseline, setBaseline] = useState<{
    name: string;
    description: string;
    rows: { key: string; value: string }[];
    body: string;
  } | null>(null);

  // 主题
  useEffect(() => {
    const applyTheme = () => {
      setTheme((document.body.getAttribute('data-theme') as 'light' | 'dark') || 'light');
    };
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  /** 把 SKILL.md 解析为字段集合（供 applyMdToState / 基线快照共用） */
  const parseMdToFields = (md: string) => {
    const { flat, blocks, topLevelFlat, body: realBody } = splitToFields(md);
    // metadata：优先用 "metadata:" 嵌套块；否则回退到 frontmatter 内所有扁平顶层 key（name/description 除外）
    //   —— 与后端 build_skill_md 的扁平输出格式保持一致
    const metaFromBlock = flattenMetadataToRows(blocks.metadata);
    const fromBlock = metaFromBlock.length > 0;
    const rows = fromBlock
      ? metaFromBlock
      : Object.entries(topLevelFlat)
        .map(([k, v]) => ({ key: k, value: v == null ? '' : String(v) }))
        .filter(r => r.key && r.key !== 'name' && r.key !== 'description');
    return {
      name: flat.name ?? '',
      description: flat.description ?? '',
      rows,
      hasNestBlock: fromBlock,
      body: (realBody ?? '').trim(),
    };
  };

  const applyMdToState = (md: string) => {
    const f = parseMdToFields(md);
    setName(f.name);
    setDescription(f.description);
    setMetadataRows(f.rows);
    setHasNestBlock(f.hasNestBlock);
    setBody(f.body);
  };

  /** 记录脏检测基线（字段级快照） */
  const setBaselineFromMd = (md: string) => {
    const f = parseMdToFields(md);
    setBaseline({ name: f.name, description: f.description, rows: f.rows, body: f.body });
  };

  const fetchSkill = async (skillId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await skillService.getSkill(skillId, true);
      setSkill(data);
      const md = data.skill_md_content ?? '';
      setInitialMd(md);
      applyMdToState(md);
      setBaselineFromMd(md);
      setShowDiff(false);
    } catch (e: any) {
      message.error(e && e.message || '加载技能详情失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (id) fetchSkill(id); }, [id]);

  const serializeCurrentMd = (): string => {
    // 与后端 build_skill_md 输出格式完全一致（含 --- 分隔符），
    // 保证"解析 → 重新序列化"能还原出与文件相同的内容，恢复后不再误报有变动
    const fmLines = [`name: ${name}`, `description: ${description}`];
    if (metadataText) {
      if (hasNestBlock) fmLines.push('metadata:');
      fmLines.push(...metadataText.split('\n'));
    }
    const b = (body || '').trim();
    const head = `---\n${fmLines.join('\n')}\n---\n`;
    return b ? `${head}\n\n${b}\n` : `${head}\n`;
  };

  const currentMd = (() => serializeCurrentMd())();

  // 脏检测：当前字段值与基线快照逐字段比较（rows 顺序无关，排序后比较）
  const hasChanges = (() => {
    if (!baseline) return false;
    const curRows = metadataRows.map(r => ({ key: r.key.trim(), value: r.value.trim() }))
      .filter(r => r.key && r.value)
      .sort((a, b) => a.key.localeCompare(b.key));
    const baseRows = baseline.rows.map(r => ({ key: r.key.trim(), value: r.value.trim() }))
      .filter(r => r.key && r.value)
      .sort((a, b) => a.key.localeCompare(b.key));
    return name.trim() !== baseline.name.trim()
      || description.trim() !== baseline.description.trim()
      || (body || '').trim() !== baseline.body
      || JSON.stringify(curRows) !== JSON.stringify(baseRows);
  })();

  // 监听卸载 / 浏览器关闭前的脏提示（可选）
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasChanges]);

  /**
   * 把 SKILL.md 拆成 {
   *   flat:         {name, description}（用于"名称/描述"两个输入框）
   *   blocks:       {metadata: 原始 metadata 块文本}（"  key: value" 缩进行）
   *   topLevelFlat: 所有顶层 flat key（除 name/description 之外）— 后端 build_skill_md 扁平输出
   *   body:         正文
   * }
   */
  const splitToFields = (rawMd: string) => {
    const { frontmatter, body: mdBody } = splitFrontmatter(rawMd);
    const { flat, blocks } = parseFlatAndBlocks(frontmatter);
    const sub: Record<string, string> = {};
    const topLevelFlat: Record<string, string> = {};
    for (const [k, v] of Object.entries(flat)) {
      if (k === 'name' || k === 'description') sub[k] = v;
      else topLevelFlat[k] = v;
    }
    return {
      flat: sub,
      blocks: { metadata: blocks.metadata ?? '' },
      topLevelFlat,
      body: mdBody,
    };
  };

  const handleSave = async () => {
    if (!skill || !name.trim()) {
      message.error('名称不能为空');
      return;
    }
    // 校验 metadata key 合法性
    for (const row of metadataRows) {
      const k = row.key.trim();
      const v = row.value.trim();
      if (!k || !v) continue;
      if (KEY_RE.test(k)) continue;
      if (/[\r\n\t]/.test(k)) {
        message.error(`元数据参数名 "${k}" 包含空白字符`);
        return;
      }
      message.error(`元数据参数名 "${k}" 只能由英文字母 / 数字 / 下划线 / 横杠组成`);
      return;
    }
    setSaving(true);
    try {
      // 构建元数据 dict（过滤空行）
      const metaDict: Record<string, string> = {};
      for (const row of metadataRows) {
        const k = row.key.trim();
        const v = row.value.trim();
        if (k && v) metaDict[k] = v;
      }
      // 一次性调用 updateSkill，分开传 name/description/metadata/content
      await skillService.updateSkill(skill.id, {
        name: name.trim(),
        title: name.trim(),
        description: description.trim(),
        metadata: Object.keys(metaDict).length > 0 ? metaDict : null,
        content: body,
      } as any);
      // 拉取最新详情并重置基线
      const updated = await skillService.getSkill(skill.id, true);
      setSkill(updated);
      const updatedMd = updated.skill_md_content ?? '';
      setInitialMd(updatedMd);
      setBaselineFromMd(updatedMd);
      message.success('保存成功');
    } catch (e: any) {
      message.error(e && e.message || '保存失败');
    } finally { setSaving(false); }
  };

  const handleRestore = () => {
    applyMdToState(initialMd);
    setShowDiff(false);
  };

  const handleDownload = () => {
    const blob = new Blob([currentMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const goHome = () => {
    // 固定返回 /skills，确保落回"SKILL管理"页
    navigate('/skills');
  };

  if (loading || !skill) {
    return (
      <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 留作未使用的占位（旧版 table 渲染已弃用）

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶栏：返回 ｜ 居中 Segment ｜ 右侧 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '10px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e8e8e8'}`,
        gap: 12,
        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" icon={<ArrowLeftOutlined />}
            onClick={goHome}>返回</Button>
          <FileTextOutlined style={{ fontSize: 18, color: '#1677ff' }} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {name || skill.title || skill.name}
          </span>
          <Tag color={skill.status ? 'green' : 'red'}>{skill.status ? '启用' : '停用'}</Tag>
        </div>

        {/* 居中 Tab 切换 */}
        <AntSegmented
          value={tab}
          onChange={(v) => setTab(v as 'content' | 'files')}
          options={[
            { label: '技能内容', value: 'content', icon: <FileTextOutlined /> },
            { label: '文件目录', value: 'files', icon: <FolderOpenOutlined /> },
          ]}
        />

        {/* 右侧占位（保持居中） */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ color: theme === 'dark' ? '#888' : '#999', fontSize: 12 }}>
            {skill.updated_at ? `更新于 ${formatAbsTime(skill.updated_at)}` : ''}
          </span>
        </div>
      </div>

      {/* 主体 */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 16,
        background: theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
      }}>
        {tab === 'content' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* 操作按钮区 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Button icon={<SaveOutlined />} loading={saving}
                disabled={!hasChanges} onClick={handleSave}>保存</Button>
              <Button type="text" icon={<UndoOutlined />}
                disabled={!hasChanges} onClick={handleRestore}>恢复</Button>
              <Button type="text" icon={<DownloadOutlined />} onClick={handleDownload}>下载</Button>
              {hasChanges && (
                <>
                  <span style={{ color: '#faad14', fontSize: 12 }}>• 有未保存的变动</span>
                  <Button size="small" type={showDiff ? 'primary' : 'default'}
                    onClick={() => setShowDiff(v => !v)}>
                    {showDiff ? '返回编辑' : '比对（查看改动）'}
                  </Button>
                </>
              )}
            </div>

            {/* 主体内容（仿照技能新增弹窗的 Form 风格） */}
            {showDiff ? (
              <div style={{ flex: 1, overflow: 'auto', background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : '#fafafa', padding: 12, borderRadius: 8 }}>
                {renderDiffView(initialMd, currentMd, theme)}
              </div>
            ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}
              className="skill-content-form">
              <Form
                key={skill.id}
                layout="horizontal"
                labelCol={{ flex: 'none' }}
                wrapperCol={{ flex: '1 1 auto' }}
                colon
                labelAlign="right"
              >
                <Form.Item label={<span>名称 <Tooltip title="技能唯一标识，修改后目录名同步变更"><QuestionCircleOutlined /></Tooltip></span>} required
                  rules={[
                    { required: true, message: '请输入名称' },
                    { pattern: /^\S+$/, message: '名称不能包含空格' },
                  ]}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="为技能填写名称，将作为技能所属目录名称"
                  />
                </Form.Item>

                <Form.Item label={<span>描述 <Tooltip title="技能功能说明，用于智能体判断何时激活此技能"><QuestionCircleOutlined /></Tooltip></span>} required rules={[{ required: true, message: '请输入描述' }]}>
                  <Input.TextArea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="技能是什么，应该在何时使用。"
                  />
                </Form.Item>

                <Form.Item label="元数据"
                  tooltip="参数名只能由英文字母 / 数字 / 下划线 / 横杠组成，不能包含空格；参数值同样不能包含空格">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {metadataRows.map((row, idx) => {
                      const kInvalid = !!row.key.trim() && !KEY_RE.test(row.key.trim());
                      const vInvalid = !!row.value.trim() && /\s/.test(row.value);
                      return (
                        <Row key={idx} gutter={8} align="middle">
                          <Col span={10}>
                            <Input
                              placeholder="参数名"
                              value={row.key}
                              status={kInvalid ? 'error' : undefined}
                              onChange={(e) => {
                                const next = [...metadataRows];
                                next[idx] = { ...row, key: e.target.value };
                                setMetadataRows(next);
                              }}
                            />
                          </Col>
                          <Col span={12}>
                            <Input
                              placeholder="参数值"
                              value={row.value}
                              status={vInvalid ? 'error' : undefined}
                              onChange={(e) => {
                                const next = [...metadataRows];
                                next[idx] = { ...row, value: e.target.value };
                                setMetadataRows(next);
                              }}
                            />
                          </Col>
                          <Col span={2} style={{ textAlign: 'center' }}>
                            <MinusCircleOutlined
                              onClick={() => {
                                const next = [...metadataRows];
                                next.splice(idx, 1);
                                setMetadataRows(next);
                              }}
                              style={{ color: '#ff4d4f' }}
                            />
                          </Col>
                        </Row>
                      );
                    })}
                    <Button type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => setMetadataRows([...metadataRows, { key: '', value: '' }])}
                      style={{ width: '100%' }}>
                      添加
                    </Button>
                  </div>
                </Form.Item>

                <Form.Item label="内容" required
                  style={{ marginBottom: 0 }}
                  tooltip="Markdown，对应 SKILL.md 正文">
                  <div className="editor-body"
                    style={{ width: '100%', maxWidth: '100%', border: '1px solid rgba(128,128,128,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                    <MDEditor
                      value={body}
                      height={editorHeight}
                      preview="edit"
                      data-color-mode={theme === 'dark' ? 'dark' : 'light'}
                      textareaProps={{ spellCheck: false, placeholder: '请详细填写技能指令' }}
                      onChange={setBody}
                    />
                  </div>
                </Form.Item>
              </Form>
            </div>
            )}
          </div>
        ) : (
          /* 文件目录 Tab：内部面板自带背景和边框，容器保持透明 */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <SkillFileManager skill={skill} theme={theme}
              onFileSaved={() => { fetchSkill(skill.id, true); }} />
          </div>
        )}
      </div>
    </div>
  );
};

/* ============== 内联工具 ============== */

/** 把 metadata 块（"  key: value" 行格式）解析成 rows */
function flattenMetadataToRows(metadata: string): { key: string; value: string }[] {
  if (!metadata || !metadata.trim()) {
    return [];
  }
  const rows: { key: string; value: string }[] = [];
  for (const raw of metadata.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf(':');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim().replace(/^["']|["']$/g, '');
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!key) continue;
    rows.push({ key, value });
  }
  return rows;
}

/** 复刻前端侧的 frontmatter 解析（与 utils/skillFrontmatter.ts 一致，但简化为只取 name/description/metadata/body） */
function parseFlatAndBlocks(frontmatter: string): { flat: Record<string, string>; blocks: Record<string, string> } {
  const flat: Record<string, string> = {};
  const blocks: Record<string, string> = {};
  if (!frontmatter) return { flat, blocks };
  const lines = frontmatter.split('\n');
  let curKey: string | null = null;
  let curLines: string[] = [];
  let curIsBlock = false;
  const flush = () => {
    if (curKey == null) return;
    const text = curLines.join('\n').trim();
    if (curIsBlock) {
      if (text) blocks[curKey] = text;
    } else {
      flat[curKey] = text;
    }
    curKey = null;
    curLines = [];
  };
  for (const raw of lines) {
    if (!raw.trim()) { curLines.push(''); continue; }
    const indent = leadingSpaces(raw);
    const content = raw.trim();
    if (indent === 0 && content.includes(':')) {
      flush();
      const idx = content.indexOf(':');
      const key = content.slice(0, idx).trim().replace(/^["']|["']$/g, '');
      const value = content.slice(idx + 1).trim();
      curKey = key;
      curIsBlock = value === '' || ['>', '|', '>-', '|-'].includes(value);
      if (value && value !== '|-' && value !== '>-' && value !== '|' && value !== '>') {
        curLines.push(value.replace(/^["']|["']$/g, ''));
      }
    } else {
      curLines.push(raw);
    }
  }
  flush();
  return { flat, blocks };
}

function leadingSpaces(s: string): number {
  let i = 0;
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return i;
}

/** 行级 diff（与 skill_file_manager 同款） */
type DiffLine = { type: 'add' | 'del' | 'same'; oldLine?: number; newLine?: number; text: string };

const computeDiffLines = (oldText: string, newText: string): DiffLine[] => {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const MAX = 4000;
  let o = oldLines, n = newLines;
  let oTrim = 0, nTrim = 0;
  if (o.length > MAX + n.length) { o = o.slice(0, MAX); oTrim = oldLines.length - o.length; }
  if (n.length > MAX + o.length) { n = n.slice(0, MAX); nTrim = newLines.length - n.length; }
  const len1 = o.length, len2 = n.length;
  const dp: number[][] = Array.from({ length: len1 + 1 }, () => new Array(len2 + 1).fill(0));
  for (let i = len1 - 1; i >= 0; i--) {
    for (let j = len2 - 1; j >= 0; j--) {
      dp[i][j] = o[i] === n[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const seq: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < len1 && j < len2) {
    if (o[i] === n[j]) {
      seq.push({ type: 'same', oldLine: i + 1, newLine: j + 1, text: o[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      seq.push({ type: 'del', oldLine: i + 1, text: o[i] });
      i++;
    } else {
      seq.push({ type: 'add', newLine: j + 1, text: n[j] });
      j++;
    }
  }
  while (i < len1) { seq.push({ type: 'del', oldLine: i + 1, text: o[i] }); i++; }
  while (j < len2) { seq.push({ type: 'add', newLine: j + 1, text: n[j] }); j++; }
  if (oTrim > 0 || nTrim > 0) {
    seq.push({ type: 'same', text: `…（已省略 ${Math.max(oTrim, nTrim)} 行，仅显示前 ${MAX} 行）` });
  }
  return seq;
};

const renderDiffView = (oldText: string, newText: string, theme: 'light' | 'dark') => {
  const lines = computeDiffLines(oldText, newText);
  return (
    <div style={{ fontFamily: 'Consolas, Monaco, monospace', fontSize: 13, lineHeight: 1.5 }}>
      {lines.map((line, idx) => {
        const bg = line.type === 'add' ? (theme === 'dark' ? 'rgba(46,160,67,0.2)' : '#e6ffec')
          : line.type === 'del' ? (theme === 'dark' ? 'rgba(248,81,73,0.2)' : '#ffebe9')
          : 'transparent';
        const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
        const num = line.type === 'del' ? line.oldLine : line.type === 'add' ? line.newLine : line.oldLine ?? line.newLine;
        return (
          <div key={idx} style={{ display: 'flex', background: bg, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingRight: 8, opacity: 0.5, userSelect: 'none', borderRight: '1px solid rgba(128,128,128,0.2)' }}>{num ?? ''}</span>
            <span style={{ width: 16, flexShrink: 0, textAlign: 'center', userSelect: 'none', opacity: 0.7 }}>{prefix}</span>
            <span style={{ padding: '0 8px', flex: 1 }}>{line.text}</span>
          </div>
        );
      })}
    </div>
  );
};

const formatAbsTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default SkillDetailPage;
