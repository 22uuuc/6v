// EXPORTS:
//   store{get,set,remove,keys,backupAll}        —— 同步存储（带签名校验 + shadow 备份）
//   secureStore{get,set,remove}                  —— 加密存储（AES-GCM，异步，敏感数据用）
//   subscribe(fn), notify(), getVersion()        —— 订阅通知机制
//
// 加固体系：
//   1. 签名校验：所有写入自动附加哈希签名，读取时校验完整性（防篡改）
//   2. Shadow 备份：双写备份，主数据损坏时自动从备份恢复（自愈）
//   3. 数据库护死：签名失效且无备份的数据直接丢弃，拒绝采用被篡改数据
//   4. 加密存储：敏感字段使用 AES-GCM 加密（机密性 + 完整性）
//   5. 跨标签页监控：storage 事件监听外部写入，触发修复

import { sha256Sync, getAppCryptoKey, aesEncrypt, aesDecrypt, isWebCryptoAvailable } from '@/lib/crypto';

const NS = 'moying-novel';
const SIG = (k: string) => `${NS}:${k}.sig`;
const BAK = (k: string) => `${NS}:${k}.bak`;
const BAK_SIG = (k: string) => `${NS}:${k}.bak.sig`;
// 加密存储的键名（与普通存储隔离）
const ENC_PREFIX = `${NS}:enc:`;

/* ---------- 签名算法（同步，用于数据完整性校验） ---------- */

/**
 * 计算数据签名（增强 FNV-1a 64 位变体，替换原 DJB2）
 * 注：前端签名校验为演示级防护，生产环境需服务端校验
 */
function signData(s: string): string {
  return sha256Sync(s);
}

/* ---------- 篡改事件记录 ---------- */

/** 记录篡改事件（不依赖 api，直接写安全日志键） */
function logTamper(key: string, why: string) {
  try {
    const raw = localStorage.getItem(`${NS}:securityLogs`);
    const sig = localStorage.getItem(`${NS}:securityLogs.sig`);
    let logs: unknown[] = [];
    if (raw && sig && sig === signData(raw)) {
      try {
        logs = JSON.parse(raw) as unknown[];
      } catch {
        logs = [];
      }
    }
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
    const newRaw = JSON.stringify(logs.slice(0, 200));
    localStorage.setItem(`${NS}:securityLogs`, newRaw);
    localStorage.setItem(`${NS}:securityLogs.sig`, signData(newRaw));
  } catch {
    /* 忽略 */
  }
}

/* ---------- Shadow 备份与自愈 ---------- */

/** 尝试用 shadow 备份修复主键；成功返回 true */
function tryRepairFromShadow(key: string): boolean {
  try {
    const bakRaw = localStorage.getItem(BAK(key));
    const bakSig = localStorage.getItem(BAK_SIG(key));
    if (bakRaw === null || bakSig === null) return false;
    if (bakSig !== signData(bakRaw)) return false; // 备份本身也坏了，不修
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
    localStorage.setItem(BAK_SIG(key), signData(raw));
  } catch {
    /* 忽略 */
  }
}

/* ---------- 普通存储（同步，带签名 + 备份） ---------- */

/** JSON 解析 + 形状守卫：期望数组但实际非数组（如云端密文信封误落库）时回退默认值，避免 .filter/.find 崩溃 */
function parseWithGuard<T>(raw: string, fb: T): T {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(fb) && !Array.isArray(parsed)) return fb;
    return parsed as T;
  } catch {
    return fb;
  }
}

export const store = {
  get<T>(k: string, fb: T): T {
    try {
      const raw = localStorage.getItem(`${NS}:${k}`);
      if (raw === null) return fb;
      // 非空数据必须通过签名校验，否则视为被篡改 → 尝试自愈，失败则丢弃并记录
      const sig = localStorage.getItem(SIG(k));
      if (sig !== null && sig !== signData(raw)) {
        if (tryRepairFromShadow(k)) {
          logTamper(k, '签名不匹配，已从备份自动恢复');
          const repaired = localStorage.getItem(`${NS}:${k}`);
          if (repaired !== null) return parseWithGuard(repaired, fb);
        } else {
          logTamper(k, '签名不匹配且无可用备份');
          return fb;
        }
      }
      if (sig === null) {
        // 主键存在但签名缺失：可能是签名被恶意删除（篡改绕过路径）或旧版遗留。
        // 先尝试从备份恢复签名；无备份则视为不可信数据，丢弃并记录，防止"删签名绕过校验"。
        if (tryRepairFromShadow(k)) {
          const repaired = localStorage.getItem(`${NS}:${k}`);
          if (repaired !== null) return parseWithGuard(repaired, fb);
        }
        logTamper(k, '数据无签名且无可用备份，视为不可信，已丢弃');
        return fb;
      }
      return parseWithGuard(raw, fb);
    } catch {
      return fb;
    }
  },

  set(k: string, v: unknown) {
    try {
      const raw = JSON.stringify(v);
      localStorage.setItem(`${NS}:${k}`, raw);
      localStorage.setItem(SIG(k), signData(raw));
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
        if (
          k &&
          k.startsWith(`${NS}:`) &&
          !k.includes('.sig') &&
          !k.includes('.bak') &&
          !k.startsWith(ENC_PREFIX)
        ) {
          out.push(k.slice(NS.length + 1));
        }
      }
    } catch {
      /* 忽略 */
    }
    return out;
  },

  /** 立即为全库重建 shadow 备份（巡检时调用，补齐缺口） */
  backupAll(): number {
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

/* ---------- 加密存储（异步，AES-GCM，用于敏感数据） ---------- */
// 适用场景：session、用户口令哈希、GitHub token 等敏感信息
// 注意：前端加密是"提高攻击门槛"，无法抵御设备物理访问级攻击

export const secureStore = {
  /**
   * 读取加密数据
   * @param k 键名（不含前缀）
   * @param fb 失败时的默认值
   */
  async get<T>(k: string, fb: T): Promise<T> {
    if (!isWebCryptoAvailable()) {
      // 降级：使用普通存储（不加密）
      return store.get<T>(k, fb);
    }
    try {
      const encKey = await getAppCryptoKey();
      const raw = localStorage.getItem(ENC_PREFIX + k);
      if (raw === null) return fb;
      const plaintext = await aesDecrypt(raw, encKey);
      if (!plaintext) return fb;
      return JSON.parse(plaintext) as T;
    } catch {
      return fb;
    }
  },

  /**
   * 写入加密数据（AES-GCM）
   * @param k 键名（不含前缀）
   * @param v 要存储的值
   */
  async set(k: string, v: unknown): Promise<boolean> {
    if (!isWebCryptoAvailable()) {
      // 降级：使用普通存储
      store.set(k, v);
      return false;
    }
    try {
      const encKey = await getAppCryptoKey();
      const plaintext = JSON.stringify(v);
      const ciphertext = await aesEncrypt(plaintext, encKey);
      localStorage.setItem(ENC_PREFIX + k, ciphertext);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * 删除加密数据
   */
  remove(k: string) {
    try {
      localStorage.removeItem(ENC_PREFIX + k);
    } catch {
      /* 忽略 */
    }
  },
};

/* ---------- 全局数据版本号与订阅机制 ---------- */
// 任何写操作后 +1，驱动 useSyncExternalStore 刷新

let version = 0;
const listeners = new Set<() => void>();
const _afterNotifyHooks = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 注册 notify 后置钩子（数据变更后异步触发，用于自动同步等副作用） */
export function onAfterNotify(fn: () => void): () => void {
  _afterNotifyHooks.add(fn);
  return () => _afterNotifyHooks.delete(fn);
}

export function notify() {
  version += 1;
  listeners.forEach((fn) => fn());
  // 后置钩子异步执行（不阻塞 UI 刷新）
  if (_afterNotifyHooks.size > 0) {
    queueMicrotask(() => {
      _afterNotifyHooks.forEach((fn) => fn());
    });
  }
}

export function getVersion() {
  return version;
}
