/**
 * SKILL.md YAML Frontmatter 解析与生成工具
 *
 * 约定格式（项目专用，按行缩进层级表达嵌套 mapping）：
 * ```
 * ---
 * name: skill_name
 * description: >-
 *   多行
 *   文本
 * metadata:
 *   install:
 *     - method: github
 *       url: https://...
 * text: |
 *   ```
 *   # 代码块
 *   ```
 * ---
 * <body>
 * ```
 */

export interface FrontmatterResult {
  /** 顶层 scalar 字段（name / description / text 等；多行块会拼成单行） */
  flat: Record<string, string>;
  /**
   * 嵌套 mapping 块的行文本（保留原始缩进），用于展示/编辑 metadata。
   * metadata 这类 key 的值从这里取。
   */
  blocks: Record<string, string>;
  /** 正文（frontmatter 之后的所有文本，含结尾换行） */
  body: string;
}

/** 拆分 SKILL.md 为 {frontmatter, body}（与后端 _split_frontmatter_md 对齐） */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  if (!raw || !raw.trim().startsWith('---')) {
    return { frontmatter: '', body: raw || '' };
  }
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end < 0) return { frontmatter: '', body: raw };
  const frontmatter = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n');
  return { frontmatter, body };
}

/**
 * 解析 frontmatter 文本，返回 {flat, blocks, body}：
 * - flat: 顶层标量 key -> 拼接后的字符串值
 * - blocks: 顶层块 key（嵌套 mapping / 多行 list）-> 原始行文本（保留缩进）
 *
 * 规则：
 * - 顶层行：`key: value`（value 空 => 进入 block 模式，直到下一个顶层 key 或 ---）
 * - block 模式下，所有后续缩进行或空行归入该 block，直到遇到下一个 indent=0 的 "key:" 行
 * - 顶层 `key: value`（value 非空，含 `>-` / `|` 等）=> 进入 multi-line scalar 模式，
 *   把后续缩进行全部追加到 flat[key] 直到下一个顶层 key
 */
export function parseFrontmatter(frontmatter: string): { flat: Record<string, string>; blocks: Record<string, string> } {
  const flat: Record<string, string> = {};
  const blocks: Record<string, string> = {};
  if (!frontmatter) return { flat, blocks };
  const lines = frontmatter.split('\n');
  let curKey: string | null = null;
  let curLines: string[] = [];
  let curIsBlock = true;

  const flush = () => {
    if (curKey == null) return;
    const text = curLines.join('\n').trim();
    if (curIsBlock) {
      if (text) blocks[curKey] = text;
    } else {
      // 多行 scalar：拼接为单行，保留内部换行可后续处理
      flat[curKey] = text;
    }
    curKey = null;
    curLines = [];
  };

  for (const raw of lines) {
    if (!raw.trim()) { curLines.push(''); continue; }
    const indent = lenIndent(raw);
    const content = raw.trim();
    if (indent === 0 && /^[A-Za-z0-9_\-\s]+$/.test(content.split(':')[0].trim()) && content.includes(':')) {
      flush();
      const idx = content.indexOf(':');
      const key = content.slice(0, idx).trim().replace(/^["']|["']$/g, '');
      const value = content.slice(idx + 1).trim();
      curKey = key;
      if (value === '' || value === '>' || value === '|' || value === '>-' || value === '|-') {
        curIsBlock = true;
        if (value !== '' && value !== '|-' && value !== '>-') {
          curLines.push(value);
        }
      } else {
        curIsBlock = false;
        curLines.push(stripQuotes(value));
      }
    } else {
      // 缩进行 / 块内容
      curLines.push(raw);
    }
  }
  flush();
  return { flat, blocks };
}

/** 序列化为标准 frontmatter 文本（可直接写入 SKILL.md） */
export function serializeFrontmatter(
  flat: Record<string, string>,
  blocks: Record<string, string>,
): string {
  const out: string[] = [];
  for (const [key, value] of Object.entries(flat)) {
    if (value == null || value === '') continue;
    out.push(`${key}: ${value}`);
  }
  for (const [key, value] of Object.entries(blocks)) {
    if (!value) { continue; }
    out.push(`${key}: ${value}`);
  }
  return out.join('\n');
}

/** 去掉字符串两侧引号 */
export function stripQuotes(s: string): string {
  const v = (s || '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function lenIndent(s: string): number {
  let i = 0;
  while (i < s.length && (s[i] === ' ' || s[i] === '\t')) i++;
  return i;
}
