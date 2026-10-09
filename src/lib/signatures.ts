// EXPORTS: signatures
// 签名清单（仓库内版本化）：管理员评审后随 GitHub 固定渠道发布，前端只读加载。
// 设计原则：只检测并打标，不自动执行任何处置（处置权限归管理员，见 security.ts pushPendingRemedy）。
// 变更流程：本文件经管理员评审 → 提交到 GitHub 内容库 → 前端每次打开自动从固定渠道拉取生效。
// 严禁：基于外部抓取的「病毒代码」动态改写本清单或自身源码（供应链投毒入口）。

/** 签名清单版本（每次扩充递增，便于审计与回滚） */
export const SIGNATURES_VERSION = '1.0.0';

export type SignatureSeverity = 'info' | 'warn' | 'danger';

export type SignatureCategory =
  | 'encoding-bypass'
  | 'mutation-xss'
  | 'scriptless'
  | 'css-exfil'
  | 'polyglot'
  | 'data-payload'
  | 'prototype'
  | 'svg';

export interface Signature {
  /** 稳定 ID，用于审计日志去重与回滚 */
  id: string;
  category: SignatureCategory;
  severity: SignatureSeverity;
  /** 正则源码（字符串，便于跨会话持久化与审计；运行时用 new RegExp 编译） */
  pattern: string;
  flags: string;
  /** 人类可读描述（命中后展示） */
  description: string;
}

/** 管理员评审入库的签名（v1.0.0 首版） */
export const SIGNATURES: readonly Signature[] = [
  {
    id: 'SIG-001',
    category: 'encoding-bypass',
    severity: 'warn',
    pattern: '(?:&#x?0*(?:3c|60);|&lt;|\\u003c)\\s*script',
    flags: 'i',
    description: 'HTML 实体/Unicode 编码绕过后的 <script> 标签',
  },
  {
    id: 'SIG-002',
    category: 'encoding-bypass',
    severity: 'warn',
    pattern: '%3c[^a-z0-9%]*script',
    flags: 'i',
    description: 'URL 编码绕过的 <script> 标签',
  },
  {
    id: 'SIG-003',
    category: 'mutation-xss',
    severity: 'danger',
    pattern: '<svg[^>]*>\\s*<style',
    flags: 'i',
    description: 'SVG + style 变异 XSS（绕过朴素过滤器）',
  },
  {
    id: 'SIG-004',
    category: 'mutation-xss',
    severity: 'danger',
    pattern: '<math[^>]*>\\s*<mtext',
    flags: 'i',
    description: 'MathML <mtext> 变异 XSS 向量',
  },
  {
    id: 'SIG-005',
    category: 'scriptless',
    severity: 'warn',
    pattern: '<base\\s+href',
    flags: 'i',
    description: '<base href> 基址劫持（改写相对链接）',
  },
  {
    id: 'SIG-006',
    category: 'scriptless',
    severity: 'warn',
    pattern: '<meta\\s+charset',
    flags: 'i',
    description: '<meta charset> 字符集覆盖（乱码/绕过）',
  },
  {
    id: 'SIG-007',
    category: 'css-exfil',
    severity: 'warn',
    pattern: '@import\\s+',
    flags: 'i',
    description: 'CSS @import 外链（潜在数据外泄）',
  },
  {
    id: 'SIG-008',
    category: 'css-exfil',
    severity: 'danger',
    pattern: 'url\\(\\s*javascript\\s*:',
    flags: 'i',
    description: 'CSS url(javascript:) 执行向量',
  },
  {
    id: 'SIG-009',
    category: 'css-exfil',
    severity: 'danger',
    pattern: 'behavior\\s*:\\s*url',
    flags: 'i',
    description: 'IE behavior:url 行为绑定（遗留向量）',
  },
  {
    id: 'SIG-010',
    category: 'polyglot',
    severity: 'danger',
    pattern: "[\"']\\s*>\\s*<\\s*svg",
    flags: 'i',
    description: '引号闭合 + <svg> 多语种突破载荷',
  },
  {
    id: 'SIG-011',
    category: 'data-payload',
    severity: 'danger',
    pattern: 'data:(?:application/javascript|image/svg\\+xml|text/xml)',
    flags: 'i',
    description: 'data: 载荷（JS/SVG/XML 内联）',
  },
  {
    id: 'SIG-012',
    category: 'data-payload',
    severity: 'warn',
    pattern: 'data:text/html\\s*;[^\\s)>]*base64',
    flags: 'i',
    description: 'data:text/html;base64 编码 HTML 载荷',
  },
  {
    id: 'SIG-013',
    category: 'prototype',
    severity: 'danger',
    pattern: "constructor\\s*\\[\\s*['\"]prototype",
    flags: 'i',
    description: 'constructor["prototype"] 原型链污染',
  },
  {
    id: 'SIG-014',
    category: 'svg',
    severity: 'warn',
    pattern: '<use\\s+xlink:href',
    flags: 'i',
    description: '<use xlink:href> SVG 引用注入',
  },
  {
    id: 'SIG-015',
    category: 'svg',
    severity: 'danger',
    pattern: '<animate\\b[^>]*\\bon(?:begin|end|repeat)\\b',
    flags: 'i',
    description: '<animate onbegin/end/repeat> SVG 事件注入',
  },
  {
    id: 'SIG-016',
    category: 'svg',
    severity: 'danger',
    pattern: '<svg[^>]*\\bforeignObject[\\s>]',
    flags: 'i',
    description: '<svg foreignObject> 外部内容注入向量',
  },
];

export interface CompiledSignature {
  re: RegExp;
  /** 命中展示文本（含 ID + 描述） */
  label: string;
  severity: SignatureSeverity;
}

let _compiled: CompiledSignature[] | null = null;

/** 编译并缓存签名清单（正则编译开销摊销到首次调用） */
export function compiledSignatures(): CompiledSignature[] {
  if (_compiled) return _compiled;
  _compiled = SIGNATURES.map((s) => {
    let re: RegExp;
    try {
      re = new RegExp(s.pattern, s.flags);
    } catch {
      // 容错：清单中的非法正则不阻塞扫描，仅跳过（评审阶段应已发现）
      re = /(?!)/; // 永不命中
    }
    return { re, label: `${s.id} ${s.description}`, severity: s.severity };
  });
  return _compiled;
}

/** 重新编译签名清单（运行时更新清单后调用，强制丢弃缓存） */
export function reloadSignatures(): void {
  _compiled = null;
}
