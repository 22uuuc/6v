// 服务端危险内容扫描（与前端 security.ts 的 DANGER_PATTERNS 同源）。
// 服务端为写入权威：载荷入库前必须通过；签名清单/学习特征为前端体验层，不阻塞入库。
const DANGER_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /<\s*script[\s\S]*?<\s*\/\s*script\s*>/i, label: 'script 标签注入' },
  { re: /javascript\s*:/i, label: 'javascript: 协议' },
  { re: /<\s*(iframe|frame|object|embed)\b/i, label: 'iframe/object 嵌入' },
  { re: /\bon\w+\s*=\s*/i, label: '事件属性注入 (on*=)' },
  { re: /<\s*img[^>]*\bsrc\s*=\s*["']?x[^>]*onerror/i, label: 'img onerror 注入' },
  { re: /<svg[^>]*onload/i, label: 'svg onload 注入' },
  { re: /document\.(cookie|location|write)/i, label: '敏感 API 调用' },
  { re: /(?:eval|new\s+Function|setTimeout)\s*\(\s*["'`]/i, label: '动态执行代码' },
  { re: /localStorage|sessionStorage|indexedDB/i, label: '存储探测' },
  { re: /\.innerHTML\s*=|\.outerHTML\s*=/i, label: 'DOM 直写' },
  { re: /data:\s*text\/html/i, label: 'data: HTML 载荷' },
  { re: /(?:&#x?0*(?:3c|60);|&lt;|\u003c)\s*script/i, label: '编码绕过的 script 标签' },
  { re: /<\s*base\s+href/i, label: 'base 标签劫持 (base href)' },
  { re: /<\s*meta\s+http-equiv/i, label: 'meta 刷新/跳转 (http-equiv)' },
  { re: /expression\s*\(/i, label: 'IE CSS expression 执行' },
  { re: /__proto__\b/, label: '原型链污染 (__proto__)' },
];

/** 返回命中的风险标签列表（空数组 = 通过） */
export function scanText(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const p of DANGER_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  return hits;
}

/** 多字段聚合扫描，命中返回首个字段名；通过返回 null */
export function scanFields(fields: { field: string; text: string }[]): { field: string; hits: string[] } | null {
  for (const f of fields) {
    const hits = scanText(f.text);
    if (hits.length > 0) return { field: f.field, hits };
  }
  return null;
}
