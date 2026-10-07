// EXPORTS: store{get,set,remove}, subscribe(fn), notify(), getVersion()
// 加固：写入带签名校验（防篡改）＋ shadow 双写备份（自愈）；
// 读取校验失败 → 记录安全日志 → 尝试用 shadow 备份自动恢复（数据库护死）。

const NS = 'moying-novel';
const SIG = (k: string) => `${NS}:${k}.sig`;
const BAK = (k: string) => `${NS}:${k}.bak`;
const BAK_SIG = (k: string) => `${NS}:${k}.bak.sig`;

/** 简易哈希（校验用，非安全哈希） */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return `${s.length}:${h.toString(36)}`;
}

/** 记录篡改事件（不依赖 api，直接写安全日志键） */
function logTamper(key: string, why: string) {
  try {
    const logs = JSON.parse(localStorage.getItem(`${NS}:securityLogs`) ?? '[]') as unknown[];
    logs.unshift({
      id: `sl${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`,
      kind: 'tamper',
      level: 'danger',
      targetType: 'store',
      targetId: key,
      field: key,
      snippet: '',
      message: `数据被篡改或损坏：${key}（${why}），已触发数据库守卫`,
      status: 'flagged',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(`${NS}:securityLogs`, JSON.stringify(logs.slice(0, 200)));
  } catch {
    /* 忽略 */
  }
}

/** 尝试用 shadow 备份修复主键；成功返回 true */
function tryRepairFromShadow(key: string): boolean {
  try {
    const bakRaw = localStorage.getItem(BAK(key));
    const bakSig = localStorage.getItem(BAK_SIG(key));
    if (bakRaw === null || bakSig === null) return false;
    if (bakSig !== hashString(bakRaw)) return false; // 备份本身也坏了，不修
    localStorage.setItem(`${NS}:${key}`, bakRaw);
    localStorage.setItem(SIG(key), bakSig);
    return true;
  } catch {
    return false;
  }
}

/** 从主键复制一份 shadow 备份（供全库备份 / 自愈用） */
function shadowBackup(key: string, raw: string) {
  try {
    localStorage.setItem(BAK(key), raw);
    localStorage.setItem(BAK_SIG(key), hashString(raw));
  } catch {
    /* 忽略 */
  }
}

export const store = {
  get<T>(k: string, fb: T): T {
    try {
      const raw = localStorage.getItem(`${NS}:${k}`);
      if (raw === null) return fb;
      // 非空数据必须通过签名校验，否则视为被篡改 → 尝试自愈，失败则丢弃并记录
      const sig = localStorage.getItem(SIG(k));
      if (sig !== null && sig !== hashString(raw)) {
        if (tryRepairFromShadow(k)) {
          logTamper(k, '签名不匹配，已从备份自动恢复');
          const repaired = localStorage.getItem(`${NS}:${k}`);
          if (repaired !== null) return JSON.parse(repaired) as T;
        } else {
          logTamper(k, '签名不匹配且无可用备份');
          return fb;
        }
      }
      return JSON.parse(raw) as T;
    } catch {
      return fb;
    }
  },
  set(k: string, v: unknown) {
    try {
      const raw = JSON.stringify(v);
      localStorage.setItem(`${NS}:${k}`, raw);
      localStorage.setItem(SIG(k), hashString(raw));
      shadowBackup(k, raw); // 双写备份，篡改时可自愈
    } catch {
      /* 隐私模式静默降级 */
    }
  },
  remove(k: string) {
    try {
      localStorage.removeItem(`${NS}:${k}`);
      localStorage.removeItem(SIG(k));
      localStorage.removeItem(BAK(k));
      localStorage.removeItem(BAK_SIG(k));
    } catch {
      /* 忽略 */
    }
  },
  /** 全库保护键清单（用于巡检 / 备份覆盖率统计） */
  keys(): string[] {
    const out: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i);
        if (k && k.startsWith(`${NS}:`) && !k.includes('.sig') && !k.includes('.bak')) {
          out.push(k.slice(NS.length + 1));
        }
      }
    } catch {
      /* 忽略 */
    }
    return out;
  },
  /** 立即为全库重建 shadow 备份（巡检时调用，补齐缺口） */
  backupAll() {
    let n = 0;
    for (const k of this.keys()) {
      const raw = localStorage.getItem(`${NS}:${k}`);
      if (raw !== null) {
        shadowBackup(k, raw);
        n += 1;
      }
    }
    return n;
  },
};

/** 全局数据版本号：任何写操作后 +1，驱动 useSyncExternalStore 刷新 */
let version = 0;
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notify() {
  version += 1;
  listeners.forEach((fn) => fn());
}

export function getVersion() {
  return version;
}
