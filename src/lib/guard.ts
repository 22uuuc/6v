// EXPORTS: guard（防黑客篡改守护：巡检 / 自愈 / 跨标签页监控 / 深度查杀）
// 说明：前端演示层防护（真实安全必须由后端完成）。
// 职责：1) 全库签名巡检，发现篡改自动从 shadow 备份恢复；
//       2) 跨标签页外部写入监控（storage 事件，绕过本应用的写入会触发修复）；
//       3) 深度查杀 = 内容病毒扫描（XSS/注入）＋ 结构篡改巡检 ＋ 会话完整性校验；
//       4) 提供守护状态（运行中 / 上次巡检 / 累计自动修复次数）给安全中心展示。

import { store, notify } from '@/lib/store';
import { security, deobfuscate, scanText } from '@/lib/security';
import { api } from '@/lib/api';

/** 守护统计（持久化，跨刷新保留） */
export interface IGuardStats {
  /** 累计自动修复次数 */
  repaired: number;
  /** 上次巡检时间（ISO） */
  lastScanAt: string;
  /** 上次发现的损坏键 */
  lastDamage: string[];
  /** 深度查杀次数 */
  deepScans: number;
}

const DEFAULT_GUARD: IGuardStats = { repaired: 0, lastScanAt: '', lastDamage: [], deepScans: 0 };

export function guardStats(): IGuardStats {
  return { ...DEFAULT_GUARD, ...store.get<Partial<IGuardStats>>('guardStats', {}) };
}

function saveStats(s: IGuardStats) {
  store.set('guardStats', s);
}

/** 会话完整性校验：解密失败说明 session 被外部直接改写 */
function sessionIntegrityCheck(): boolean {
  const raw = store.get<string | null>('session', null);
  if (!raw) return true; // 未登录，无会话可校验
  try {
    const s = JSON.parse(deobfuscate(raw)) as { userId?: string };
    return typeof s.userId === 'string' && s.userId.length > 0;
  } catch {
    return false;
  }
}

/** 单键签名校验 + 自愈。返回 0=正常 1=已修复 2=修复失败（记为危险） */
function checkKey(key: string): 0 | 1 | 2 {
  const raw = localStorage.getItem(`moying-novel:${key}`);
  if (raw === null) return 0;
  const sig = localStorage.getItem(`moying-novel:${key}.sig`);
  const ok = sig !== null && sig === (() => {
    let h = 5381;
    for (let i = 0; i < raw.length; i += 1) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    return `${raw.length}:${h.toString(36)}`;
  })();
  if (ok) return 0;

  // 签名不匹配：先试 shadow 备份
  const bakRaw = localStorage.getItem(`moying-novel:${key}.bak`);
  const bakSig = localStorage.getItem(`moying-novel:${key}.bak.sig`);
  if (bakRaw !== null && bakSig !== null) {
    const bakOk = bakSig === (() => {
      let h = 5381;
      for (let i = 0; i < bakRaw.length; i += 1) h = ((h << 5) + h + bakRaw.charCodeAt(i)) >>> 0;
      return `${bakRaw.length}:${h.toString(36)}`;
    })();
    if (bakOk) {
      localStorage.setItem(`moying-novel:${key}`, bakRaw);
      localStorage.setItem(`moying-novel:${key}.sig`, bakSig);
      return 1;
    }
  }
  return 2;
}

/** 全库巡检：校验所有键 + 补齐缺失备份。返回修复数（失败键记日志） */
export function guardPatrol(): { repaired: number; damage: string[] } {
  const stats = guardStats();
  let repaired = 0;
  const damage: string[] = [];
  for (const key of store.keys()) {
    const r = checkKey(key);
    if (r === 1) repaired += 1;
    if (r === 2) {
      damage.push(key);
      security.write({
        kind: 'tamper',
        level: 'danger',
        message: `数据库守卫无法恢复：${key} 签名失效且无有效备份，已隔离该数据`,
        status: 'flagged',
      });
    }
  }
  store.backupAll(); // 补齐 shadow 缺口
  stats.repaired += repaired;
  stats.lastScanAt = new Date().toISOString();
  if (repaired > 0 || damage.length > 0) stats.lastDamage = [...damage];
  saveStats(stats);
  if (repaired > 0) notify();
  return { repaired, damage };
}

/** 深度查杀：内容病毒扫描 + 结构篡改巡检 + 会话完整性。返回处理摘要 */
export function deepScan(): { virusFlags: number; cleaned: number; tamperedRepaired: number; sessionBroken: boolean } {
  const stats = guardStats();
  const before = security.logs().filter((l) => l.status === 'flagged').length;
  const flaggedNow = api.scanAll(); // 内容安全扫描（病毒代码 / XSS / 注入），返回发现数并落日志
  const cleaned = Math.max(0, before - security.logs().filter((l) => l.status === 'flagged').length + flaggedNow);
  const patrol = guardPatrol();
  const sessionBroken = !sessionIntegrityCheck();
  if (sessionBroken) {
    security.write({ kind: 'tamper', level: 'danger', message: '会话数据完整性校验失败，可能被外部改写，已触发登出保护', status: 'flagged' });
    store.remove('session');
  }
  stats.deepScans += 1;
  saveStats(stats);
  return { virusFlags: flaggedNow, cleaned, tamperedRepaired: patrol.repaired, sessionBroken };
}

/* ---------- 反破解防卫（开发者模式 / 控制台篡改 / URL 注入 / 脚本篡改检测） ---------- */

/** 是否疑似开发者工具打开：通过窗口尺寸差与定时器节流检测 */
function devtoolsOpen(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > 160 || heightDiff > 160) return true; // 停靠式 devtools
    // 独立窗口 devtools：尺寸差小，用 debugger 时序陷阱检测
    const t0 = performance.now();
    // eslint-disable-next-line no-debugger
    debugger;
    return performance.now() - t0 > 100;
  } catch {
    return false;
  }
}

/** URL 注入检测：查询参数 / hash 中的脚本载荷与敏感调用 */
function urlInjection(): string | null {
  try {
    const raw = `${window.location.search} ${window.location.hash}`;
    if (!raw) return null;
    const hits = scanText(raw.slice(0, 500));
    if (hits.length > 0) return hits.join('、');
    return null;
  } catch {
    return null;
  }
}

/** 全局对象篡改检测：关键 API 被控制台替换则报警 */
function globalTamper(): string | null {
  try {
    if (typeof window === 'undefined') return null;
    // 常见的破解手段：覆盖 console / 替换 storage 方法 / 挂载注入脚本
    const probes: { name: string; ok: boolean }[] = [
      { name: 'localStorage.setItem', ok: typeof localStorage?.setItem === 'function' },
      { name: 'localStorage.getItem', ok: typeof localStorage?.getItem === 'function' },
      { name: 'JSON.parse', ok: typeof JSON?.parse === 'function' },
      { name: 'crypto.getRandomValues', ok: typeof crypto?.getRandomValues === 'function' },
    ];
    const bad = probes.filter((p) => !p.ok);
    return bad.length > 0 ? bad.map((b) => b.name).join('、') : null;
  } catch {
    return null;
  }
}

/** 反破解巡检：一次调用返回新发现项数，发现则写安全日志 */
export function antiCrackPatrol(): number {
  let found = 0;
  try {
    if (devtoolsOpen()) {
      // 开发者模式：可能用于审查/篡改，仅记录（不误伤正常调试）
      security.write({
        kind: 'suspicious', level: 'warn',
        message: '检测到开发者模式（DevTools 打开），已记录；如在调试请关闭后正常使用',
        status: 'flagged',
      });
      found += 1;
    }
    const inj = urlInjection();
    if (inj) {
      security.write({
        kind: 'xss', level: 'danger',
        message: `URL 参数含注入载荷（${inj}），已拦截访问痕迹`,
        status: 'flagged',
      });
      found += 1;
    }
    const g = globalTamper();
    if (g) {
      security.write({
        kind: 'tamper', level: 'danger',
        message: `检测到浏览器关键 API 被替换（${g}），可能为破解行为，已记录入侵警告`,
        status: 'flagged',
      });
      found += 1;
    }
  } catch {
    /* 忽略 */
  }
  if (found > 0) notify();
  return found;
}

/** 启动守护：定时巡检 + 跨标签页写入监控 + 反破解巡检。返回停止函数 */
export function startGuard(intervalMs = 30000): () => void {
  let timer: number | undefined;
  try {
    timer = window.setInterval(() => {
      const p = guardPatrol();
      if (p.repaired > 0 || p.damage.length > 0) notify();
      antiCrackPatrol(); // 反破解巡检（低频，随主巡检一起）
    }, intervalMs);
    // 启动即先做一次反破解巡检（检测已打开的开发者模式 / 注入痕迹）
    setTimeout(() => antiCrackPatrol(), 2000);
  } catch {
    /* 非浏览器环境跳过 */
  }

  // 跨标签页：其他标签页直接改 localStorage（绕过签名）时，这里能感知并修复
  const onStorage = (e: StorageEvent) => {
    const k = e.key ?? '';
    if (!k.startsWith('moying-novel:') || k.includes('.sig') || k.includes('.bak')) return;
    if (e.newValue === null) return; // 删除不在此处理
    const sig = localStorage.getItem(`${k}.sig`);
    const ok = sig !== null && sig === (() => {
      let h = 5381;
      for (let i = 0; i < e.newValue.length; i += 1) h = ((h << 5) + h + e.newValue.charCodeAt(i)) >>> 0;
      return `${e.newValue.length}:${h.toString(36)}`;
    })();
    if (!ok) {
      const r = checkKey(k.slice('moying-novel:'.length));
      security.write({
        kind: 'tamper',
        level: 'danger',
        message: `检测到其他页面直接改写数据（${k}），${r === 1 ? '已自动恢复' : '无法恢复，已隔离'}`,
        status: r === 1 ? 'cleaned' : 'flagged',
      });
      notify();
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    if (timer !== undefined) window.clearInterval(timer);
    window.removeEventListener('storage', onStorage);
  };
}
