// EXPORTS: cloud
// GitHub 仓库作为「内容库数据库」：
//  - 写入：管理员配置 GitHub 令牌 + 云端加密口令后推送（AES-GCM 加密 + HMAC-SHA256 签名，密文落库）
//  - 读取：配置令牌时走 API 带令牌读取（支持私有仓库）；未配置时匿名拉取公开仓库
//  - 防篡改：拉取内容先验 HMAC 签名（失败即拒收并记录安全日志）→ 解密 → 内容查杀扫描
// 内容库键（与 api.ts 数据层一致）：books / chapters / visualScripts / comicChapters / comicPages
import { store, notify } from '@/lib/store';
import { security, obfuscate, deobfuscate, scanText } from '@/lib/security';

const REPO_OWNER = '22uuuc';
const REPO_NAME = '6v';
const BRANCH = 'main';
const DB_DIR = 'db';

// 用户数据仓库（与内容/代码仓库分离）：注册用户、余额、流水、收益、提现等用户信息数据
const USER_REPO_OWNER = '22uuuc';
const USER_REPO_NAME = 'fantastic-rotary-phone';

export const CLOUD_FILES = [
  { key: 'books', path: `${DB_DIR}/books.json` },
  { key: 'chapters', path: `${DB_DIR}/chapters.json` },
  { key: 'visualScripts', path: `${DB_DIR}/visual-scripts.json` },
  { key: 'comicChapters', path: `${DB_DIR}/comic-chapters.json` },
  { key: 'comicPages', path: `${DB_DIR}/comic-pages.json` },
] as const;

/** 用户数据文件（独立仓库存储，与内容/代码仓库分离；仅管理员可推拉，加密落库） */
export const USER_DATA_FILES = [
  { key: 'users', path: `${DB_DIR}/users.json` },
  { key: 'txs', path: `${DB_DIR}/txs.json` },
  { key: 'settlements', path: `${DB_DIR}/settlements.json` },
  { key: 'withdrawals', path: `${DB_DIR}/withdrawals.json` },
  { key: 'reviews', path: `${DB_DIR}/reviews.json` },
  { key: 'payProviders', path: `${DB_DIR}/pay-providers.json` },
  { key: 'applicants', path: `${DB_DIR}/applicants.json` },
] as const;

// 平台设置与认证会话仓库（第三库）：存放全站排版风格/字体设置（settings）与登录设备会话（authSessions）
// 与内容库、用户库三仓分离，独立加密盐；凭证复用用户库令牌/口令（管理员统一配置）
const SETTINGS_REPO_NAME = 'moying-settings';

/** 平台设置仓文件：settings（全站设置+排版风格，管理员后台可替换） / authSessions（登录设备会话，身份认证） */
export const SETTINGS_FILES = [
  { key: 'settings', path: `${DB_DIR}/settings.json` },
  { key: 'loginSessions', path: `${DB_DIR}/auth-sessions.json` },
] as const;

/** 设置仓本地存储键（与 store 键一致，推送/拉取共用；认证会话实际存储键为 session） */
export const SETTINGS_STORE_KEYS: Record<string, string> = {
  settings: 'settings',
  loginSessions: 'session',
};

const TOKEN_KEY = 'cloud-token';
const META_KEY = 'cloud-meta';
const AUTO_KEY = 'cloud-auto';
const PASS_KEY = 'cloud-pass';

const USER_TOKEN_KEY = 'user-cloud-token';
const USER_PASS_KEY = 'user-cloud-pass';
const USER_META_KEY = 'user-cloud-meta';

interface CloudMeta {
  lastPullAt?: string;
  lastPushAt?: string;
  repo: string;
  branch: string;
}

interface SyncResult {
  ok: boolean;
  pulled?: string[];
  pushed?: string[];
  failed?: string[];
  msg?: string;
}

/** 内容/代码仓库 */
const rawUrl = (p: string) => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${p}`;
const apiUrl = (p: string) => `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${p}`;
/** 用户数据仓库 */
const userApiUrl = (p: string) => `https://api.github.com/repos/${USER_REPO_OWNER}/${USER_REPO_NAME}/contents/${p}`;
/** 平台设置仓 */
const settingsApiUrl = (p: string) => `https://api.github.com/repos/${REPO_OWNER}/${SETTINGS_REPO_NAME}/contents/${p}`;

function saveToken(t: string) {
  store.set(TOKEN_KEY, t.trim() ? obfuscate(t.trim()) : null);
}
function getToken(): string {
  const raw = store.get<string | null>(TOKEN_KEY, null);
  if (!raw) return '';
  try {
    return deobfuscate(raw);
  } catch {
    return '';
  }
}

function savePass(p: string) {
  store.set(PASS_KEY, p.trim() ? obfuscate(p.trim()) : null);
}
function getPass(): string {
  const raw = store.get<string | null>(PASS_KEY, null);
  if (!raw) return '';
  try {
    return deobfuscate(raw);
  } catch {
    return '';
  }
}

function saveUserToken(t: string) {
  store.set(USER_TOKEN_KEY, t.trim() ? obfuscate(t.trim()) : null);
}
function getUserToken(): string {
  const raw = store.get<string | null>(USER_TOKEN_KEY, null);
  if (!raw) return '';
  try {
    return deobfuscate(raw);
  } catch {
    return '';
  }
}

function saveUserPass(p: string) {
  store.set(USER_PASS_KEY, p.trim() ? obfuscate(p.trim()) : null);
}
function getUserPass(): string {
  const raw = store.get<string | null>(USER_PASS_KEY, null);
  if (!raw) return '';
  try {
    return deobfuscate(raw);
  } catch {
    return '';
  }
}

/** 分块 UTF-8 → Base64（btoa 不支持 Unicode，TextEncoder 后逐块转） */
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function decodeBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 由加密口令派生 AES-GCM / HMAC 密钥（PBKDF2，固定盐保证跨会话可解；口令仅存本机浏览器）。saltKey 区分仓库：内容库与用户库各自独立盐与口令 */
/** 派生双密钥：encKey 用于 AES-GCM 加解密，macKey 用于 HMAC-SHA256 签名/验签（同一口令独立盐派生，互不混用） */
interface CloudKeys {
  encKey: CryptoKey;
  macKey: CryptoKey;
}
async function deriveKeys(pass: string, saltKey: string): Promise<CloudKeys> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
  const encKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(`moying-cloud-${saltKey}`), iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const macKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(`moying-cloud-mac-${saltKey}`), iterations: 10000, hash: 'SHA-256' },
    baseKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return { encKey, macKey };
}

/** 加密 + 签名：{"enc":true,"v":1,"iv","data","sig"}（AES-GCM 加密，HMAC-SHA256 防篡改，签名只依赖密文与 iv） */
async function sealJson(jsonStr: string, keys: CloudKeys): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(jsonStr);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keys.encKey, data);
  const ivB64 = encodeBase64(String.fromCharCode(...Array.from(iv)));
  const dataB64 = encodeBase64(String.fromCharCode(...new Uint8Array(cipher)));
  const sigBuf = await crypto.subtle.sign(
    { name: 'HMAC', hash: 'SHA-256' },
    keys.macKey,
    new TextEncoder().encode(`${ivB64}:${dataB64}`),
  );
  return JSON.stringify({
    enc: true,
    v: 1,
    iv: ivB64,
    data: dataB64,
    sig: bytesToHex(sigBuf),
  });
}

/** 验签 + 解密；验签失败返回 null（上层拒收并记安全日志） */
async function unsealJson(text: string, keys: CloudKeys): Promise<string | null> {
  let obj: { enc?: boolean; v?: number; iv?: string; data?: string; sig?: string };
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj.enc || !obj.iv || !obj.data || !obj.sig) return null;
  try {
    // 先验 HMAC 签名（不依赖解密），防止仓库数据被恶意篡改
    const expected = bytesToHex(
      await crypto.subtle.sign(
        { name: 'HMAC', hash: 'SHA-256' },
        keys.macKey,
        new TextEncoder().encode(`${obj.iv}:${obj.data}`),
      ),
    );
    if (expected.toLowerCase() !== obj.sig.toLowerCase()) return null;
    const iv = decodeBase64(obj.iv);
    const cipher = decodeBase64(obj.data);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keys.encKey, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

async function fetchRaw(path: string): Promise<string> {
  const res = await fetch(rawUrl(path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchAuth(path: string, token: string): Promise<string> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { content?: string; encoding?: string };
  if (!j.content) throw new Error('内容为空');
  return new TextDecoder().decode(decodeBase64(j.content));
}

async function fetchSha(path: string, token: string): Promise<string | null> {
  const res = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`查询 ${path} 失败 HTTP ${res.status}`);
  const j = (await res.json()) as { sha?: string };
  return j.sha ?? null;
}

/** 用户数据仓库：带令牌读文件内容 */
async function fetchUserFile(path: string, token: string): Promise<string> {
  const res = await fetch(userApiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { content?: string; encoding?: string };
  if (!j.content) throw new Error('内容为空');
  return new TextDecoder().decode(decodeBase64(j.content));
}

/** 用户数据仓库：查询文件 sha */
async function fetchUserSha(path: string, token: string): Promise<string | null> {
  const res = await fetch(userApiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`查询 ${path} 失败 HTTP ${res.status}`);
  const j = (await res.json()) as { sha?: string };
  return j.sha ?? null;
}

/** 用户数据仓库：推送（PUT） */
async function putUserFile(path: string, content: string, token: string, sha: string | null) {
  const res = await fetch(userApiUrl(path), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `墨影书城：用户数据仓库同步 ${path}`,
      content: encodeBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`推送 ${path} 失败 HTTP ${res.status}`);
  return res.json();
}

async function putFile(path: string, content: string, token: string, sha: string | null) {
  const res = await fetch(apiUrl(path), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `墨影书城：云端内容库同步 ${path}`,
      content: encodeBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`推送 ${path} 失败 HTTP ${res.status}`);
  return res.json();
}

/* ---------- 平台设置仓（第三库：设置/排版 + 认证会话） ---------- */

async function fetchSettingsFile(path: string, token: string): Promise<string> {
  const res = await fetch(settingsApiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { content?: string; encoding?: string };
  if (!j.content) throw new Error('内容为空');
  return new TextDecoder().decode(decodeBase64(j.content));
}

async function fetchSettingsSha(path: string, token: string): Promise<string | null> {
  const res = await fetch(settingsApiUrl(path), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`查询 ${path} 失败 HTTP ${res.status}`);
  const j = (await res.json()) as { sha?: string };
  return j.sha ?? null;
}

async function putSettingsFile(path: string, content: string, token: string, sha: string | null) {
  const res = await fetch(settingsApiUrl(path), {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `墨影书城：平台设置仓同步 ${path}`,
      content: encodeBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`推送 ${path} 失败 HTTP ${res.status}`);
  return res.json();
}

function meta(): CloudMeta {
  return store.get<CloudMeta>(META_KEY, { repo: `${REPO_OWNER}/${REPO_NAME}`, branch: BRANCH });
}

export const cloud = {
  repo() {
    return { owner: REPO_OWNER, name: REPO_NAME, branch: BRANCH };
  },
  files(): { key: string; path: string }[] {
    return CLOUD_FILES.map((f) => ({ key: f.key, path: f.path }));
  },
  meta,
  tokenSaved(): boolean {
    return getToken().length > 0;
  },
  saveToken(t: string) {
    saveToken(t);
  },
  clearToken() {
    saveToken('');
  },
  passSaved(): boolean {
    return getPass().length > 0;
  },
  savePass(p: string) {
    savePass(p);
  },

  /** 读取一个内容文件：带令牌走 API（支持私有仓库），否则匿名拉取公开仓库 */
  async readFile(path: string, token: string): Promise<string> {
    if (token) return fetchAuth(path, token);
    return fetchRaw(path);
  },

  /** 解密并校验云端文件内容：加密文件验签失败返回 null（篡改/口令不符，拒收）；旧明文 JSON 兼容读取（迁移） */
  async openFile(text: string): Promise<unknown | null> {
    const pass = getPass();
    if (pass) {
      let obj: { enc?: boolean } | null = null;
      try {
        obj = JSON.parse(text);
      } catch {
        return null;
      }
      if (obj && obj.enc === true) {
        const keys = await deriveKeys(pass, `${REPO_OWNER}/${REPO_NAME}`);
        const jsonStr = await unsealJson(text, keys);
        if (jsonStr === null) {
          // 加密文件验签失败：仓库数据被篡改或口令不符，拒收并记安全日志
          security.recordAttack('云端加密内容验签失败已拒收（仓库数据疑似被篡改或口令不符）');
          return null;
        }
        try {
          return JSON.parse(jsonStr);
        } catch {
          return null;
        }
      }
      // 旧明文数据：无签名保护，仅内容查杀兜底，建议重新加密推送迁移
      return obj;
    }
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  },

  /** 从云端拉取内容库（私有仓库需配置令牌；每文件独立验签解密 + 内容查杀，单文件失败不阻塞） */
  async pullFromCloud(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getToken();
    const pulled: string[] = [];
    const failed: string[] = [];
    for (const f of CLOUD_FILES) {
      try {
        const text = await this.readFile(f.path, tk);
        const json = await this.openFile(text);
        if (json === null) {
          // 验签失败 = 仓库内容被篡改或口令不符
          security.recordAttack(`云端内容验签失败已拒收（${f.key}）`);
          failed.push(`${f.key}(验签失败/口令不符)`);
          continue;
        }
        // 内容查杀：解密后的云端数据同样过扫描，命中危险载荷拒收
        const flat = JSON.stringify(json);
        if (scanText(flat).length > 0) {
          failed.push(`${f.key}(危险载荷)`);
          continue;
        }
        store.set(f.key, json);
        pulled.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pulled.length > 0) {
      store.set(META_KEY, { ...meta(), lastPullAt: new Date().toISOString() });
    }
    notify();
    return pulled.length > 0
      ? { ok: true, pulled, failed, msg: `已从云端拉取 ${pulled.length}/${CLOUD_FILES.length} 个内容文件` }
      : { ok: false, failed, msg: '云端内容拉取失败，已保留本地数据（私有仓库请先配置令牌）' };
  },

  /** 推送本地内容库到云端：AES-GCM 加密 + HMAC 签名后落库（需令牌 + 加密口令） */
  async pushToCloud(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getToken();
    if (!tk) return { ok: false, msg: '请先配置 GitHub 令牌（后台云同步面板可填写）' };
    const pass = getPass();
    if (!pass) return { ok: false, msg: '请先设置云端加密口令（未设口令不允许推送，防止明文入库）' };
    try {
      const me = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json' },
      });
      if (!me.ok) return { ok: false, msg: '令牌无效或已过期，请检查 GitHub 令牌（需要 repo 写入权限）' };
    } catch {
      return { ok: false, msg: '无法连接 GitHub，请检查网络后重试' };
    }
    const keys = await deriveKeys(pass, `${REPO_OWNER}/${REPO_NAME}`);
    const pushed: string[] = [];
    const failed: string[] = [];
    for (const f of CLOUD_FILES) {
      const data = store.get(f.key, null);
      if (data === null) {
        failed.push(`${f.key}(本地无数据)`);
        continue;
      }
      try {
        const sealed = await sealJson(JSON.stringify(data), keys);
        const sha = await fetchSha(f.path, tk);
        await putFile(f.path, sealed, tk, sha);
        pushed.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pushed.length > 0) {
      store.set(META_KEY, { ...meta(), lastPushAt: new Date().toISOString() });
    }
    notify();
    return pushed.length > 0
      ? { ok: true, pushed, failed, msg: `已加密推送 ${pushed.length}/${CLOUD_FILES.length} 个内容文件到云端` }
      : { ok: false, pushed, failed, msg: '推送失败，请检查令牌权限与网络' };
  },

  /** 首次启动自动拉取（每浏览器仅一次；私有仓库未配令牌时静默失败，保留本地种子兜底） */
  async initAutoPull(): Promise<void> {
    if (store.get<string>(AUTO_KEY, '') === '1') return;
    const r = await cloud.pullFromCloud();
    if (r.ok) {
      store.set(AUTO_KEY, '1');
    }
  },

  /* ================= 用户数据仓库（与内容/代码仓库分离） ================= */

  userRepo() {
    return { owner: USER_REPO_OWNER, name: USER_REPO_NAME, branch: BRANCH };
  },
  userFiles(): { key: string; path: string }[] {
    return USER_DATA_FILES.map((f) => ({ key: f.key, path: f.path }));
  },
  userMeta(): CloudMeta {
    return store.get<CloudMeta>(USER_META_KEY, { repo: `${USER_REPO_OWNER}/${USER_REPO_NAME}`, branch: BRANCH });
  },
  userTokenSaved(): boolean {
    return getUserToken().length > 0;
  },
  saveUserToken(t: string) {
    saveUserToken(t);
  },
  clearUserToken() {
    saveUserToken('');
  },
  userPassSaved(): boolean {
    return getUserPass().length > 0;
  },
  saveUserPass(p: string) {
    saveUserPass(p);
  },

  /** 解密并校验用户数据仓库文件：只接受加密文件（明文用户数据属隐私泄露拒收），验签失败拒收 */
  async openUserFile(text: string): Promise<unknown | null> {
    const pass = getUserPass();
    if (!pass) return null;
    let obj: { enc?: boolean } | null = null;
    try {
      obj = JSON.parse(text);
    } catch {
      return null;
    }
    if (!obj || obj.enc !== true) {
      security.recordAttack('云端用户数据非加密文件已拒收（用户数据仓库必须加密落库）');
      return null;
    }
    const keys = await deriveKeys(pass, `${USER_REPO_OWNER}/${USER_REPO_NAME}`);
    const jsonStr = await unsealJson(text, keys);
    if (jsonStr === null) {
      security.recordAttack('云端用户数据验签失败已拒收（用户仓库疑似被篡改或口令不符）');
      return null;
    }
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  },

  /** 从用户数据仓库拉取并覆盖本地（需令牌 + 用户库口令；仅管理员在后台操作） */
  async pullUserData(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getUserToken();
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌' };
    if (!getUserPass()) return { ok: false, msg: '请先设置用户数据仓库加密口令' };
    const pulled: string[] = [];
    const failed: string[] = [];
    for (const f of USER_DATA_FILES) {
      try {
        const text = await fetchUserFile(f.path, tk);
        const json = await this.openUserFile(text);
        if (json === null) {
          failed.push(`${f.key}(验签失败/口令不符)`);
          continue;
        }
        const flat = JSON.stringify(json);
        if (scanText(flat).length > 0) {
          failed.push(`${f.key}(危险载荷)`);
          continue;
        }
        store.set(f.key, json);
        pulled.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pulled.length > 0) {
      store.set(USER_META_KEY, { ...this.userMeta(), lastPullAt: new Date().toISOString() });
    }
    notify();
    return pulled.length > 0
      ? { ok: true, pulled, failed, msg: `已从用户数据仓库拉取 ${pulled.length}/${USER_DATA_FILES.length} 个数据文件` }
      : { ok: false, failed, msg: '用户数据拉取失败，已保留本地数据（私有仓库请先配置令牌）' };
  },

  /** 推送本地用户数据到用户数据仓库（AES-GCM 加密 + HMAC 签名；需令牌 + 口令；仅管理员操作） */
  async pushUserData(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getUserToken();
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌' };
    const pass = getUserPass();
    if (!pass) return { ok: false, msg: '请先设置用户数据仓库加密口令（未设口令不允许推送，防止用户数据明文入库）' };
    try {
      const me = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json' },
      });
      if (!me.ok) return { ok: false, msg: '令牌无效或已过期，请检查用户数据仓库令牌（需要 repo 写入权限）' };
    } catch {
      return { ok: false, msg: '无法连接 GitHub，请检查网络后重试' };
    }
    const keys = await deriveKeys(pass, `${USER_REPO_OWNER}/${USER_REPO_NAME}`);
    const pushed: string[] = [];
    const failed: string[] = [];
    for (const f of USER_DATA_FILES) {
      const data = store.get(f.key, null);
      if (data === null) {
        failed.push(`${f.key}(本地无数据)`);
        continue;
      }
      try {
        const sealed = await sealJson(JSON.stringify(data), keys);
        const sha = await fetchUserSha(f.path, tk);
        await putUserFile(f.path, sealed, tk, sha);
        pushed.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pushed.length > 0) {
      store.set(USER_META_KEY, { ...this.userMeta(), lastPushAt: new Date().toISOString() });
    }
    notify();
    return pushed.length > 0
      ? { ok: true, pushed, failed, msg: `已加密推送 ${pushed.length}/${USER_DATA_FILES.length} 个用户数据文件到用户数据仓库` }
      : { ok: false, pushed, failed, msg: '用户数据推送失败，请检查令牌权限与网络' };
  },

  /* ================= 平台设置仓（第三库：全站设置/排版风格 + 认证会话） ================= */

  settingsRepo() {
    return { owner: REPO_OWNER, name: SETTINGS_REPO_NAME, branch: BRANCH };
  },
  settingsFiles(): { key: string; path: string }[] {
    return SETTINGS_FILES.map((f) => ({ key: f.key, path: f.path }));
  },
  settingsTokenSaved(): boolean {
    return getUserToken().length > 0;
  },

  /** 解密并校验设置仓文件：只接受加密文件（设置含平台配置与设备会话，禁止明文入库），验签失败拒收 */
  async openSettingsFile(text: string): Promise<unknown | null> {
    const pass = getUserPass();
    if (!pass) return null;
    let obj: { enc?: boolean } | null = null;
    try {
      obj = JSON.parse(text);
    } catch {
      return null;
    }
    if (!obj || obj.enc !== true) {
      security.recordAttack('云端设置仓非加密文件已拒收（平台设置/会话必须加密落库）');
      return null;
    }
    const keys = await deriveKeys(pass, `${REPO_OWNER}/${SETTINGS_REPO_NAME}`);
    const jsonStr = await unsealJson(text, keys);
    if (jsonStr === null) {
      security.recordAttack('云端设置仓验签失败已拒收（设置仓疑似被篡改或口令不符）');
      return null;
    }
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  },

  /** 从设置仓拉取全站设置与认证会话（需令牌 + 口令；仅管理员在后台操作） */
  async pullSettings(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getUserToken();
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌（设置仓共用同一令牌）' };
    if (!getUserPass()) return { ok: false, msg: '请先设置用户数据仓库加密口令' };
    const pulled: string[] = [];
    const failed: string[] = [];
    for (const f of SETTINGS_FILES) {
      try {
        const text = await fetchSettingsFile(f.path, tk);
        const json = await this.openSettingsFile(text);
        if (json === null) {
          failed.push(`${f.key}(验签失败/口令不符)`);
          continue;
        }
        const flat = JSON.stringify(json);
        if (scanText(flat).length > 0) {
          failed.push(`${f.key}(危险载荷)`);
          continue;
        }
        store.set(SETTINGS_STORE_KEYS[f.key] ?? f.key, json);
        pulled.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pulled.length > 0) {
      store.set(USER_META_KEY, { ...this.userMeta(), lastPullAt: new Date().toISOString() });
    }
    notify();
    return pulled.length > 0
      ? { ok: true, pulled, failed, msg: `已从设置仓拉取 ${pulled.length}/${SETTINGS_FILES.length} 个文件（全站设置/排版风格已恢复）` }
      : { ok: false, failed, msg: '设置仓拉取失败，已保留本地数据' };
  },

  /** 推送全站设置与认证会话到设置仓（AES-GCM 加密 + HMAC 签名；需令牌 + 口令；仅管理员操作） */
  async pushSettings(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || getUserToken();
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌（设置仓共用同一令牌）' };
    const pass = getUserPass();
    if (!pass) return { ok: false, msg: '请先设置用户数据仓库加密口令（未设口令不允许推送）' };
    try {
      const me = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tk}`, Accept: 'application/vnd.github+json' },
      });
      if (!me.ok) return { ok: false, msg: '令牌无效或已过期，请检查令牌（需要 repo 写入权限）' };
    } catch {
      return { ok: false, msg: '无法连接 GitHub，请检查网络后重试' };
    }
    const keys = await deriveKeys(pass, `${REPO_OWNER}/${SETTINGS_REPO_NAME}`);
    const pushed: string[] = [];
    const failed: string[] = [];
    for (const f of SETTINGS_FILES) {
      const data = store.get(SETTINGS_STORE_KEYS[f.key] ?? f.key, null);
      if (data === null) {
        failed.push(`${f.key}(本地无数据)`);
        continue;
      }
      try {
        const sealed = await sealJson(JSON.stringify(data), keys);
        const sha = await fetchSettingsSha(f.path, tk);
        await putSettingsFile(f.path, sealed, tk, sha);
        pushed.push(f.key);
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pushed.length > 0) {
      store.set(USER_META_KEY, { ...this.userMeta(), lastPushAt: new Date().toISOString() });
    }
    notify();
    return pushed.length > 0
      ? { ok: true, pushed, failed, msg: `已加密推送 ${pushed.length}/${SETTINGS_FILES.length} 个文件到设置仓（排版风格/认证会话已入库）` }
      : { ok: false, pushed, failed, msg: '设置仓推送失败，请检查令牌权限与网络' };
  },

  /** 一键修改全部加密口令：换新口令并自动用新口令重新加密推送三仓（内容库/用户库/设置仓）。本地数据为明文，直接重加密即可，无需先拉旧密文。 */
  async rotateAllPasswords(
    newPass: string,
  ): Promise<{ ok: boolean; results: { repo: string; ok: boolean; msg: string }[]; msg: string }> {
    const p = (newPass ?? '').trim();
    if (p.length < 6) return { ok: false, results: [], msg: '新口令至少 6 位' };
    // 先落新口令：后续三个推送内部读取新口令派生新密钥（内容库 cloud-pass、用户库/设置仓 user-cloud-pass 统一更换）
    savePass(p);
    saveUserPass(p);
    const results: { repo: string; ok: boolean; msg: string }[] = [];
    const r1 = await this.pushToCloud();
    results.push({ repo: '内容库 22uuuc/6v', ok: r1.ok, msg: r1.msg ?? (r1.failed ?? []).join('、') });
    const r2 = await this.pushUserData();
    results.push({ repo: '用户库 22uuuc/fantastic-rotary-phone', ok: r2.ok, msg: r2.msg ?? (r2.failed ?? []).join('、') });
    const r3 = await this.pushSettings();
    results.push({ repo: '设置仓 22uuuc/moying-settings', ok: r3.ok, msg: r3.msg ?? (r3.failed ?? []).join('、') });
    const allOk = results.every((r) => r.ok);
    return {
      ok: allOk,
      results,
      msg: allOk
        ? '口令已更新，三仓已全部用新口令重新加密推送（旧密文已覆盖）'
        : '口令已更新，但部分仓库推送失败，请检查令牌与网络后重试',
    };
  },
};
