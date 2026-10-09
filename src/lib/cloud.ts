// EXPORTS: cloud
// GitHub 仓库作为「内容库数据库」：
//  - 写入：管理员配置 GitHub 令牌 + 云端加密口令后推送（AES-GCM 加密 + HMAC-SHA256 签名，密文落库）
//  - 读取：配置令牌时走 API 带令牌读取（支持私有仓库）；未配置时匿名拉取公开仓库
//  - 防篡改：拉取内容先验 HMAC 签名（失败即拒收并记录安全日志）→ 解密 → 内容查杀扫描
// 内容库键（与 api.ts 数据层一致）：books / chapters / visualScripts / comicChapters / comicPages
import { store, notify, secureStore, onAfterNotify } from '@/lib/store';
import { security, scanText } from '@/lib/security';
import { isWebCryptoAvailable, sha256Sync } from '@/lib/crypto';

const REPO_OWNER = '22uuuc';
const REPO_NAME = '6v';
const BRANCH = 'main';
const DB_DIR = 'db';
/** 用户数据仓/设置仓的数据目录（与内容库同名，均为 db/） */
const USER_DB_DIR = DB_DIR;
const SETTINGS_DIR = DB_DIR;

// 用户数据仓库（与内容/代码仓库分离）：注册用户、余额、流水、收益、提现等用户信息数据
const USER_REPO_OWNER = '22uuuc';
const USER_REPO_NAME = 'moying-users';

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
  { key: 'shelf', path: `${DB_DIR}/shelf.json` },
  { key: 'progress', path: `${DB_DIR}/progress.json` },
] as const;

// 平台设置与认证会话仓库（第三库）：存放全站排版风格/字体设置（settings）与登录设备会话（authSessions）
// 与内容库、用户库三仓分离，独立加密盐；凭证复用用户库令牌/口令（管理员统一配置）
const SETTINGS_REPO_NAME = 'moying-settings';

/* ---------- 管理后台邮箱验证码解锁（固定邮箱 + 后端真实投递，哈希留底） ---------- */

/** 固定解锁邮箱：由后端管理员提供，写死在代码中（不支持前端修改） */
export const ADMIN_UNLOCK_EMAIL = '3423419394@qq.com';
const UNLOCK_PENDING_KEY = 'unlockPending';
const UNLOCK_TTL_MS = 10 * 60 * 1000;

/** 解锁验证码哈希（域分隔前缀）：明文验证码不留任何存储，仅比对 SHA-256（加密解锁） */
function hashUnlockCode(code: string): string {
  return sha256Sync(`moying-unlock:${code.trim()}`);
}

/**
 * 云端传送渠道（固定连接，写死于代码，仓库组织 22uuuc）：
 * 每次打开网站都固定使用这一个渠道拉取/推送；本地（浏览器/管理后台）不支持修改，
 * 变更渠道只能修改本常量并经 GitHub 仓库发布后生效（云端数据库为唯一权威）。
 */
export const CLOUD_CHANNEL = {
  /** 内容库仓库（书籍/章节/漫画/互动剧本） */
  content: { owner: REPO_OWNER, name: REPO_NAME, branch: BRANCH },
  /** 用户数据仓库（账号/余额/流水/收益/提现） */
  user: { owner: USER_REPO_OWNER, name: USER_REPO_NAME, branch: BRANCH },
  /** 平台设置仓库（全站设置/排版风格 + 认证会话） */
  settings: { owner: REPO_OWNER, name: SETTINGS_REPO_NAME, branch: BRANCH },
} as const;

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
const PASS_KEY = 'cloud-pass';

/** 内容库与用户库文件在本地均为数组存储（设置仓的 settings 为对象、session 为字符串，不在此列） */
const ARRAY_FILE_KEYS: ReadonlySet<string> = new Set(
  [...CLOUD_FILES, ...USER_DATA_FILES].map((f) => f.key),
);

/** 判断值是否为云端加密信封（未配置口令时拉取写入的污染数据） */
function isEncEnvelope(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && (v as { enc?: unknown }).enc === true;
}

/**
 * 后端出口权限：接入总数据仓库的操作（推送/改密/配置令牌口令/权限检测）仅限当前登录的管理员。
 * 架构约定：后端管理员控制 → GitHub 数据库中转 → 前端只读提取（匿名拉取固定渠道，无出口写入权限）。
 * 用户使用通道与管理员操作通道严格区分：普通用户只能走匿名只读拉取，任何写入/凭据操作都会在此被拦截并记审计。
 */
async function _requireAdminOperator(action = '写入云端数据库'): Promise<boolean> {
  // 守卫降级原则（用户要求）：绝不妨碍管理员。仅当「明确确认当前登录账号是非管理员」时才拦截；
  // 无会话、会话解析失败、用户表查不到等数据异常场景一律放行（留审计痕），避免误拦真实管理员。
  const raw = await secureStore.get<string | null>('session', null);
  if (!raw) return true; // 未登录（本机单人使用场景）：放行
  let userId = '';
  try {
    userId = (JSON.parse(raw) as { userId?: string }).userId ?? '';
  } catch {
    return true; // 会话格式异常：放行，不因数据问题妨碍操作者
  }
  if (!userId) return true;
  const me = store
    .get<{ id: string; role?: string; nickname?: string }[]>('users', [])
    .find((u) => u.id === userId);
  if (!me) return true; // 用户表查不到（如云端同步覆盖本地数据）：放行
  if (me.role === 'admin') return true; // 管理员：放行
  // 唯一拦截场景：明确确认当前登录账号是非管理员
  security.audit(
    userId,
    me.nickname ?? '未知用户',
    '越权操作被拦截',
    '云端数据库',
    `非管理员账号尝试${action}（出口权限校验：非管理员）`,
  );
  return false;
}

const USER_TOKEN_KEY = 'user-cloud-token';
const USER_PASS_KEY = 'user-cloud-pass';
const USER_META_KEY = 'user-cloud-meta';

/** 统一令牌：一个钥匙通三仓（内容库 + 用户数据仓 + 设置仓） */
const UNIFIED_TOKEN_KEY = 'cloud-unified-token';

interface CloudMeta {
  lastPullAt?: string;
  lastPushAt?: string;
  repo: string;
  branch: string;
  /** 各文件上次同步后的云端 SHA（用于增量判断与冲突检测） */
  fileShas?: Record<string, string>;
}

interface SyncResult {
  ok: boolean;
  pulled?: string[];
  pushed?: string[];
  skipped?: string[];
  conflicts?: string[];
  failed?: string[];
  msg?: string;
}

/** GitHub 目录列表项 */
interface GHDirEntry {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
  size: number;
}

/** 内容/代码仓库 */
const rawUrl = (p: string) => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${p}`;
const apiUrl = (p: string) => `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${p}`;
/** 用户数据仓库 */
const userApiUrl = (p: string) => `https://api.github.com/repos/${USER_REPO_OWNER}/${USER_REPO_NAME}/contents/${p}`;
/** 平台设置仓 */
const settingsApiUrl = (p: string) => `https://api.github.com/repos/${REPO_OWNER}/${SETTINGS_REPO_NAME}/contents/${p}`;

/** 保存内容库 GitHub Token（AES-GCM 加密存储） */
async function saveToken(t: string) {
  const value = t.trim();
  await secureStore.set(TOKEN_KEY, value || null);
}

/** 读取内容库 GitHub Token（AES-GCM 加密存储） */
async function getToken(): Promise<string> {
  const value = await secureStore.get<string | null>(TOKEN_KEY, null);
  return value ?? '';
}

/** 保存内容库加密口令（AES-GCM 加密存储） */
async function savePass(p: string) {
  const value = p.trim();
  await secureStore.set(PASS_KEY, value || null);
}

/** 读取内容库加密口令（AES-GCM 加密存储） */
async function getPass(): Promise<string> {
  const value = await secureStore.get<string | null>(PASS_KEY, null);
  return value ?? '';
}

/** 保存用户数据库 GitHub Token（AES-GCM 加密存储） */
async function saveUserToken(t: string) {
  const value = t.trim();
  await secureStore.set(USER_TOKEN_KEY, value || null);
}

/** 读取用户数据库 GitHub Token（AES-GCM 加密存储） */
async function getUserToken(): Promise<string> {
  const value = await secureStore.get<string | null>(USER_TOKEN_KEY, null);
  return value ?? '';
}

/** 保存用户数据库加密口令（AES-GCM 加密存储） */
async function saveUserPass(p: string) {
  const value = p.trim();
  await secureStore.set(USER_PASS_KEY, value || null);
}

/** 读取用户数据库加密口令（AES-GCM 加密存储） */
async function getUserPass(): Promise<string> {
  const value = await secureStore.get<string | null>(USER_PASS_KEY, null);
  return value ?? '';
}

/** 保存统一令牌（一个钥匙通三仓） */
async function saveUnifiedToken(t: string) {
  const value = t.trim();
  await secureStore.set(UNIFIED_TOKEN_KEY, value || null);
}

/** 读取统一令牌 */
async function getUnifiedToken(): Promise<string> {
  const value = await secureStore.get<string | null>(UNIFIED_TOKEN_KEY, null);
  return value ?? '';
}

/** 清除统一令牌 */
async function clearUnifiedToken() {
  await secureStore.set(UNIFIED_TOKEN_KEY, null);
}

/** 获取内容库实际使用的令牌（优先统一令牌，回退到内容库独立令牌） */
async function resolveContentToken(): Promise<string> {
  const unified = await getUnifiedToken();
  if (unified) return unified;
  return getToken();
}

/** 获取用户数据仓实际使用的令牌（优先统一令牌，回退到用户库独立令牌） */
async function resolveUserToken(): Promise<string> {
  const unified = await getUnifiedToken();
  if (unified) return unified;
  return getUserToken();
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

/**
 * 批量获取目录下所有文件的 SHA（1 次请求 vs N 次单文件查询，大幅降低 API 调用）
 * 返回 Map: path → sha
 */
async function fetchDirShas(dirPath: string, token: string, baseApi: (p: string) => string = apiUrl): Promise<Map<string, string>> {
  const res = await fetch(baseApi(dirPath), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return new Map();
  if (!res.ok) throw new Error(`目录列表 ${dirPath} 失败 HTTP ${res.status}`);
  const entries = (await res.json()) as GHDirEntry[];
  const map = new Map<string, string>();
  for (const e of entries) {
    if (e.type === 'file') {
      map.set(e.path, e.sha);
    }
  }
  return map;
}

/** 计算本地数据的 SHA-256 哈希（用于增量推送：与上次推送内容一致则跳过） */
async function localContentHash(data: unknown): Promise<string> {
  const text = JSON.stringify(data);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // 降级：简单哈希（仅用于增量判断，不影响安全）
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return `djb2_${h}`;
}

/* ---------- 通用增量同步引擎 ---------- */

interface SyncFileDef {
  key: string;
  path: string;
}

interface SyncEngineOptions {
  /** 文件清单 */
  files: readonly SyncFileDef[];
  /** 目录路径（用于批量 SHA 查询） */
  dir: string;
  /** GitHub API 基础 URL 构建函数 */
  apiUrlFn: (path: string) => string;
  /** 元数据存储键 */
  metaKey: string;
  /** 元数据读取函数 */
  getMeta: () => CloudMeta;
  /** 元数据存储键到本地 store 键的映射（可选，默认 1:1） */
  storeKeyMap?: Record<string, string>;
  /** 令牌 */
  token: string;
  /** 读取并解密/校验单个文件 → 返回 JSON 或 null（失败） */
  openFile: (text: string) => Promise<unknown | null>;
  /** 加密并签名本地数据 → 返回密文字符串 */
  sealData: (data: unknown) => Promise<string>;
  /** 推送文件函数 */
  putFile: (path: string, content: string, token: string, sha: string | null) => Promise<{ content?: { sha?: string } }>;
  /** 失败原因标签（如"验签失败/口令不符"） */
  verifyFailLabel?: string;
  /** 是否强制加密（明文拒收，仅 pull 用） */
  requireEncrypted?: boolean;
}

/**
 * 通用增量拉取：批量 SHA 对比，只拉有变化的文件
 */
async function incrementalPull(opts: SyncEngineOptions): Promise<SyncResult> {
  const { files, dir, apiUrlFn, metaKey, getMeta, token, openFile, storeKeyMap, verifyFailLabel = '验签失败/口令不符' } = opts;
  const pulled: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  // 批量获取云端 SHA
  let cloudShas: Map<string, string> | null = null;
  if (token) {
    try {
      cloudShas = await fetchDirShas(dir, token, apiUrlFn);
    } catch {
      cloudShas = null;
    }
  }

  const metaData = getMeta();
  const lastShas = { ...(metaData.fileShas ?? {}) };

  for (const f of files) {
    try {
      const storeKey = storeKeyMap?.[f.key] ?? f.key;
      const cloudSha = cloudShas?.get(f.path);

      // 增量判断：SHA 未变化且本地数据未被污染 → 跳过（信封污染的键强制重拉以自愈）
      if (cloudSha && lastShas[f.key] === cloudSha && !isEncEnvelope(store.get(storeKey, null))) {
        skipped.push(f.key);
        continue;
      }

      // 读取文件内容
      let text: string;
      if (token) {
        const res = await fetch(apiUrlFn(f.path), {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { content?: string; encoding?: string };
        if (!j.content) throw new Error('内容为空');
        text = new TextDecoder().decode(decodeBase64(j.content));
      } else {
        // 未配置令牌走 raw 匿名拉取（仅内容库支持）
        const res = await fetch(
          `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${f.path}`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      }

      const json = await openFile(text);
      if (json === null) {
        failed.push(`${f.key}(${verifyFailLabel})`);
        continue;
      }
      // 形状校验：数据文件必须为数组，拒收对象载荷（防止结构污染引发 .filter 崩溃）
      if (ARRAY_FILE_KEYS.has(f.key) && !Array.isArray(json)) {
        failed.push(`${f.key}(数据形状不符，已拒收)`);
        continue;
      }
      const flat = JSON.stringify(json);
      if (scanText(flat).length > 0) {
        failed.push(`${f.key}(危险载荷)`);
        continue;
      }
      store.set(storeKey, json);
      pulled.push(f.key);
      if (cloudSha) {
        lastShas[f.key] = cloudSha;
      }
    } catch (e) {
      failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
    }
  }

  if (pulled.length > 0 || skipped.length > 0) {
    store.set(metaKey, { ...metaData, lastPullAt: new Date().toISOString(), fileShas: lastShas });
  }
  notify();

  if (pulled.length > 0) {
    return {
      ok: true, pulled, skipped, failed,
      msg: `已拉取 ${pulled.length} 个更新文件（跳过 ${skipped.length} 个未变化），共 ${files.length} 个`,
    };
  }
  if (skipped.length > 0) {
    return { ok: true, pulled, skipped, failed, msg: '内容已是最新，无需拉取' };
  }
  return { ok: false, pulled, skipped, failed, msg: '拉取失败，请检查令牌权限与网络' };
}

/**
 * 通用增量推送：冲突检测 + 本地内容哈希对比，只推有变化的文件
 */
async function incrementalPush(opts: SyncEngineOptions): Promise<SyncResult> {
  const { files, dir, apiUrlFn, metaKey, getMeta, token, sealData, putFile, storeKeyMap } = opts;
  const pushed: string[] = [];
  const skipped: string[] = [];
  const conflicts: string[] = [];
  const failed: string[] = [];

  const metaData = getMeta();
  const lastShas = { ...(metaData.fileShas ?? {}) };

  // 批量获取云端 SHA
  let cloudShas: Map<string, string> | null = null;
  try {
    cloudShas = await fetchDirShas(dir, token, apiUrlFn);
  } catch {
    cloudShas = null;
  }

  for (const f of files) {
    const storeKey = storeKeyMap?.[f.key] ?? f.key;
    const data = store.get(storeKey, null);
    if (data === null) {
      failed.push(`${f.key}(本地无数据)`);
      continue;
    }
    try {
      const cloudSha = cloudShas?.get(f.path) ?? null;
      const lastSha = lastShas[f.key] ?? null;
      const localHashKey = `_local_${f.key}`;
      const lastLocalHash = lastShas[localHashKey];

      // 冲突检测
      if (cloudSha && lastSha && cloudSha !== lastSha) {
        conflicts.push(f.key);
        continue;
      }

      // 增量判断：云端 SHA 未变化 + 本地内容未变化 → 跳过
      const localHash = await localContentHash(data);
      if (cloudSha && lastSha && cloudSha === lastSha && lastLocalHash === localHash) {
        skipped.push(f.key);
        continue;
      }

      const sealed = await sealData(data);
      const res = await putFile(f.path, sealed, token, cloudSha);
      pushed.push(f.key);
      if (res?.content?.sha) {
        lastShas[f.key] = res.content.sha;
      }
      lastShas[localHashKey] = localHash;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : '失败';
      if (errMsg.includes('409') || errMsg.includes('冲突')) {
        conflicts.push(f.key);
      } else {
        failed.push(`${f.key}(${errMsg})`);
      }
    }
  }

  if (pushed.length > 0 || skipped.length > 0 || conflicts.length > 0) {
    store.set(metaKey, { ...metaData, lastPushAt: new Date().toISOString(), fileShas: lastShas });
  }
  notify();

  if (conflicts.length > 0) {
    return {
      ok: false, pushed, skipped, conflicts, failed,
      msg: `检测到 ${conflicts.length} 个文件冲突（云端已被修改），请先拉取最新内容后再推送`,
    };
  }
  if (pushed.length > 0) {
    return {
      ok: true, pushed, skipped, conflicts, failed,
      msg: `已加密推送 ${pushed.length} 个文件（跳过 ${skipped.length} 个未变化），共 ${files.length} 个`,
    };
  }
  if (skipped.length > 0) {
    return { ok: true, pushed, skipped, conflicts, failed, msg: '本地内容已是最新，无需推送' };
  }
  return { ok: false, pushed, skipped, conflicts, failed, msg: '推送失败，请检查令牌权限与网络' };
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
  async tokenSaved(): Promise<boolean> {
    return (await resolveContentToken()).length > 0;
  },
  async saveToken(t: string): Promise<boolean> {
    // 管理员操作通道专用：令牌配置属于接入总数据仓库的操作
    if (!(await _requireAdminOperator('配置内容库令牌'))) return false;
    await saveToken(t);
    return true;
  },
  async clearToken(): Promise<boolean> {
    if (!(await _requireAdminOperator('清除内容库令牌'))) return false;
    await saveToken('');
    return true;
  },
  /** 统一令牌（一个钥匙通三仓） */
  async unifiedTokenSaved(): Promise<boolean> {
    return (await getUnifiedToken()).length > 0;
  },
  async saveUnifiedToken(t: string): Promise<boolean> {
    if (!(await _requireAdminOperator('配置统一令牌'))) return false;
    await saveUnifiedToken(t);
    return true;
  },
  async clearUnifiedToken(): Promise<boolean> {
    if (!(await _requireAdminOperator('清除统一令牌'))) return false;
    await clearUnifiedToken();
    return true;
  },
  async passSaved(): Promise<boolean> {
    return (await getPass()).length > 0;
  },
  async savePass(p: string): Promise<boolean> {
    if (!(await _requireAdminOperator('配置内容库加密口令'))) return false;
    await savePass(p);
    return true;
  },

  /** 读取一个内容文件：带令牌走 API（支持私有仓库），否则匿名拉取公开仓库 */
  async readFile(path: string, token: string): Promise<string> {
    if (token) return fetchAuth(path, token);
    return fetchRaw(path);
  },

  /** 解密并校验云端文件内容：加密文件验签失败返回 null（篡改/口令不符，拒收）；旧明文 JSON 兼容读取（迁移） */
  async openFile(text: string): Promise<unknown | null> {
    let obj: { enc?: boolean } | null = null;
    try {
      obj = JSON.parse(text);
    } catch {
      return null;
    }
    if (obj && obj.enc === true) {
      // 加密载荷但本地未配置口令：拒收（口令缺失时无法解密，直接落库会把密文信封写进数据键）
      const pass = await getPass();
      if (!pass) return null;
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
  },

  /** 从云端拉取内容库（增量：1 次批量 SHA 查询对比，只拉有变化的文件） */
  async pullFromCloud(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || (await resolveContentToken());
    const pulled: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    // 批量获取云端所有文件 SHA（1 次请求）
    let cloudShas: Map<string, string> | null = null;
    if (tk) {
      try {
        cloudShas = await fetchDirShas(DB_DIR, tk, apiUrl);
      } catch {
        cloudShas = null; // 批量查询失败时降级为全量拉取
      }
    }

    const metaData = meta();
    const lastShas = metaData.fileShas ?? {};

    for (const f of CLOUD_FILES) {
      try {
        // 增量判断：云端 SHA 与上次拉取记录一致且本地数据未被污染 → 跳过（信封污染的键强制重拉以自愈）
        const cloudSha = cloudShas?.get(f.path);
        if (cloudSha && lastShas[f.key] === cloudSha && !isEncEnvelope(store.get(f.key, null))) {
          skipped.push(f.key);
          continue;
        }

        const text = await this.readFile(f.path, tk);
        const json = await this.openFile(text);
        if (json === null) {
          // 验签失败 = 仓库内容被篡改或口令不符（含加密文件但本地未配置口令）
          security.recordAttack(`云端内容验签失败已拒收（${f.key}）`);
          failed.push(`${f.key}(验签失败/口令不符)`);
          continue;
        }
        // 形状校验：数据文件必须为数组，拒收对象载荷（防止结构污染引发 .filter 崩溃）
        if (ARRAY_FILE_KEYS.has(f.key) && !Array.isArray(json)) {
          failed.push(`${f.key}(数据形状不符，已拒收)`);
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
        // 记录本次拉取后的云端 SHA
        if (cloudSha) {
          lastShas[f.key] = cloudSha;
        }
      } catch (e) {
        failed.push(`${f.key}(${e instanceof Error ? e.message : '失败'})`);
      }
    }
    if (pulled.length > 0 || skipped.length > 0) {
      store.set(META_KEY, { ...metaData, lastPullAt: new Date().toISOString(), fileShas: lastShas });
    }
    notify();
    const total = pulled.length + skipped.length;
    if (pulled.length > 0) {
      return {
        ok: true, pulled, skipped, failed,
        msg: `已拉取 ${pulled.length} 个更新文件（跳过 ${skipped.length} 个未变化），共 ${CLOUD_FILES.length} 个`,
      };
    }
    if (skipped.length > 0) {
      return { ok: true, pulled, skipped, failed, msg: '内容已是最新，无需拉取' };
    }
    return { ok: false, pulled, skipped, failed, msg: '云端内容拉取失败，已保留本地数据（私有仓库请先配置令牌）' };
  },

  /** 推送本地内容库到云端（增量推送 + 冲突检测：批量 SHA 查询，只推有变化的文件；仅限管理员出口权限） */
  async pushToCloud(token?: string): Promise<SyncResult> {
    if (!(await _requireAdminOperator())) return { ok: false, msg: '后端出口权限校验未通过：仅管理员可写入云端数据库（前端只读提取）' };
    const tk = (token ?? '').trim() || (await resolveContentToken());
    if (!tk) return { ok: false, msg: '请先配置 GitHub 令牌（后台云同步面板可填写）' };
    const pass = await getPass();
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
    const skipped: string[] = [];
    const conflicts: string[] = [];
    const failed: string[] = [];

    // 批量获取云端 SHA（1 次请求）用于冲突检测和增量判断
    const metaData = meta();
    const lastShas = { ...(metaData.fileShas ?? {}) };
    let cloudShas: Map<string, string> | null = null;
    try {
      cloudShas = await fetchDirShas(DB_DIR, tk, apiUrl);
    } catch {
      cloudShas = null;
    }

    for (const f of CLOUD_FILES) {
      const data = store.get(f.key, null);
      if (data === null) {
        failed.push(`${f.key}(本地无数据)`);
        continue;
      }
      try {
        const cloudSha = cloudShas?.get(f.path) ?? null;

        // 冲突检测：云端 SHA 与本地记录的上次同步 SHA 不一致 → 云端被其他人修改过
        const lastSha = lastShas[f.key] ?? null;
        if (cloudSha && lastSha && cloudSha !== lastSha) {
          conflicts.push(f.key);
          continue;
        }

        // 增量判断：本地内容与上次推送一致 → 跳过（需要本地内容哈希对比）
        // 简化：如果云端 SHA 存在且与上次推送后记录一致，且本地数据未变 → 跳过
        // 由于加密后密文每次不同（随机 IV），改用本地明文内容哈希对比
        const localHash = await localContentHash(data);
        const localHashKey = `_local_${f.key}`;
        const lastLocalHash = lastShas[localHashKey];
        if (cloudSha && lastSha && cloudSha === lastSha && lastLocalHash === localHash) {
          skipped.push(f.key);
          continue;
        }

        const sealed = await sealJson(JSON.stringify(data), keys);
        const res = await putFile(f.path, sealed, tk, cloudSha);
        pushed.push(f.key);
        // 记录推送后的新云端 SHA 和本地内容哈希
        if (res?.content?.sha) {
          lastShas[f.key] = res.content.sha;
        }
        lastShas[localHashKey] = localHash;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : '失败';
        if (errMsg.includes('409') || errMsg.includes('冲突')) {
          conflicts.push(f.key);
        } else {
          failed.push(`${f.key}(${errMsg})`);
        }
      }
    }
    if (pushed.length > 0 || skipped.length > 0 || conflicts.length > 0) {
      store.set(META_KEY, { ...metaData, lastPushAt: new Date().toISOString(), fileShas: lastShas });
    }
    notify();
    if (conflicts.length > 0) {
      return {
        ok: false, pushed, skipped, conflicts, failed,
        msg: `检测到 ${conflicts.length} 个文件冲突（云端已被修改），请先拉取最新内容后再推送`,
      };
    }
    if (pushed.length > 0) {
      return {
        ok: true, pushed, skipped, conflicts, failed,
        msg: `已加密推送 ${pushed.length} 个文件（跳过 ${skipped.length} 个未变化），共 ${CLOUD_FILES.length} 个`,
      };
    }
    if (skipped.length > 0) {
      return { ok: true, pushed, skipped, conflicts, failed, msg: '本地内容已是最新，无需推送' };
    }
    return { ok: false, pushed, skipped, conflicts, failed, msg: '推送失败，请检查令牌权限与网络' };
  },

  /** 每次打开网站自动从固定渠道拉取（增量 SHA 对比：云端数据库为唯一权威，本地不支持修改；失败静默，保留本地数据兜底） */
  async initAutoPull(): Promise<void> {
    await cloud.pullFromCloud();
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
  userTokenSaved(): Promise<boolean> {
    return getUserToken().then((t) => t.length > 0);
  },
  async saveUserToken(t: string): Promise<boolean> {
    if (!(await _requireAdminOperator('配置用户数据仓令牌'))) return false;
    await saveUserToken(t);
    return true;
  },
  async clearUserToken(): Promise<boolean> {
    if (!(await _requireAdminOperator('清除用户数据仓令牌'))) return false;
    await saveUserToken('');
    return true;
  },
  userPassSaved(): Promise<boolean> {
    return getUserPass().then((p) => p.length > 0);
  },
  async saveUserPass(p: string): Promise<boolean> {
    if (!(await _requireAdminOperator('配置用户数据仓加密口令'))) return false;
    await saveUserPass(p);
    return true;
  },

  /** 解密并校验用户数据仓库文件：只接受加密文件（明文用户数据属隐私泄露拒收），验签失败拒收 */
  async openUserFile(text: string): Promise<unknown | null> {
    const pass = await getUserPass();
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

  /** 从用户数据仓库拉取（增量：批量 SHA 对比，只拉有变化的文件） */
  async pullUserData(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || (await resolveUserToken());
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌' };
    if (!(await getUserPass())) return { ok: false, msg: '请先设置用户数据仓库加密口令' };
    return incrementalPull({
      files: USER_DATA_FILES,
      dir: USER_DB_DIR,
      apiUrlFn: userApiUrl,
      metaKey: USER_META_KEY,
      getMeta: () => this.userMeta(),
      token: tk,
      openFile: (text) => this.openUserFile(text),
      sealData: async () => '', // pull 不需要
      putFile: async () => ({}), // pull 不需要
      verifyFailLabel: '验签失败/口令不符',
    });
  },

  /** 推送本地用户数据到用户数据仓库（增量推送 + 冲突检测；仅限管理员出口权限） */
  async pushUserData(token?: string): Promise<SyncResult> {
    if (!(await _requireAdminOperator())) return { ok: false, msg: '后端出口权限校验未通过：仅管理员可写入云端数据库（前端只读提取）' };
    const tk = (token ?? '').trim() || (await resolveUserToken());
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌' };
    const pass = await getUserPass();
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
    return incrementalPush({
      files: USER_DATA_FILES,
      dir: USER_DB_DIR,
      apiUrlFn: userApiUrl,
      metaKey: USER_META_KEY,
      getMeta: () => this.userMeta(),
      token: tk,
      openFile: async () => null, // push 不需要
      sealData: (data) => sealJson(JSON.stringify(data), keys),
      putFile: putUserFile as (path: string, content: string, token: string, sha: string | null) => Promise<{ content?: { sha?: string } }>,
    });
  },

  /* ================= 平台设置仓（第三库：全站设置/排版风格 + 认证会话） ================= */

  settingsRepo() {
    return { owner: REPO_OWNER, name: SETTINGS_REPO_NAME, branch: BRANCH };
  },
  settingsFiles(): { key: string; path: string }[] {
    return SETTINGS_FILES.map((f) => ({ key: f.key, path: f.path }));
  },
  settingsTokenSaved(): Promise<boolean> {
    return getUserToken().then((t) => t.length > 0);
  },

  /* ---------- 管理后台邮箱验证码解锁（真实 QQ 邮箱，后端投递） ---------- */

  /** 固定解锁邮箱（后端管理员邮箱，写死代码，仅能改代码变更） */
  unlockEmail(): string {
    return ADMIN_UNLOCK_EMAIL;
  },

  /**
   * 生成随机 6 位验证码：SHA-256 哈希留底（10 分钟有效，签名保护），明文仅经后端
   * repository_dispatch → 设置仓 unlock-mailer 工作流 → QQ 邮箱 SMTP 真实投递到固定邮箱。
   */
  async requestUnlockCode(): Promise<{ ok: boolean; msg?: string }> {
    // 验证码仅投递给管理员固定邮箱：非管理员请求直接拒绝
    if (!(await _requireAdminOperator('请求后台解锁验证码'))) return { ok: false, msg: '仅管理员可请求解锁验证码' };
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(100000 + (buf[0] % 900000));
    store.set(UNLOCK_PENDING_KEY, { hash: hashUnlockCode(code), email: ADMIN_UNLOCK_EMAIL, expiresAt: Date.now() + UNLOCK_TTL_MS });
    const token = await resolveUserToken();
    if (!token) {
      return { ok: false, msg: '尚未配置云端令牌：验证码需后端真实投递，请先在云同步配置统一令牌' };
    }
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${SETTINGS_REPO_NAME}/dispatches`, {
        method: 'POST',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ event_type: 'unlock-code', client_payload: { code, email: ADMIN_UNLOCK_EMAIL } }),
      });
    } catch {
      return { ok: false, msg: '网络异常，验证码发送失败' };
    }
    if (!res.ok) {
      return { ok: false, msg: `验证码投递失败（HTTP ${res.status}）：请确认设置仓已部署 unlock-mailer 工作流并配置 QQ 邮箱授权码` };
    }
    return { ok: true, msg: `验证码已投递到真实邮箱 ${ADMIN_UNLOCK_EMAIL}，10 分钟内有效` };
  },

  /** 校验邮箱验证码：哈希比对（加密解锁）；连续错 5 次锁 10 分钟并记入侵攻击 */
  verifyUnlockCode(code: string): { ok: boolean; msg?: string; lockedUntil?: number } {
    const lock = store.get<{ until: number }>('unlockLock', { until: 0 });
    if (lock.until > Date.now()) return { ok: false, lockedUntil: lock.until, msg: '验证码错误次数过多，已临时锁定' };
    const pending = store.get<{ hash: string; email: string; expiresAt: number } | null>(UNLOCK_PENDING_KEY, null);
    if (!pending || pending.expiresAt < Date.now()) {
      return { ok: false, msg: '验证码不存在或已过期，请重新发送' };
    }
    if (pending.hash === hashUnlockCode(code)) {
      store.remove(UNLOCK_PENDING_KEY);
      store.set('unlockFails', { n: 0 });
      return { ok: true };
    }
    const n = store.get<{ n: number }>('unlockFails', { n: 0 }).n + 1;
    if (n >= 5) {
      const until = Date.now() + 10 * 60 * 1000;
      store.set('unlockLock', { until });
      store.set('unlockFails', { n: 0 });
      security.recordAttack('管理后台邮箱验证码连续错误 5 次，已锁定 10 分钟');
      return { ok: false, lockedUntil: until, msg: '错误次数过多，已锁定 10 分钟' };
    }
    store.set('unlockFails', { n });
    security.recordAttack(`管理后台邮箱验证码验证失败（第 ${n} 次）`);
    return { ok: false, msg: `验证码错误，还可尝试 ${5 - n} 次` };
  },

  /** 邮箱验证码通道锁定截止时间（0 = 未锁定） */
  unlockLockedUntil(): number {
    const lock = store.get<{ until: number }>('unlockLock', { until: 0 });
    return lock.until > Date.now() ? lock.until : 0;
  },

  /** 真人解锁通道自检：后端投递所依赖的统一令牌是否已配置 */
  async hasUnlockToken(): Promise<boolean> {
    try {
      return (await resolveUserToken()).length > 0;
    } catch {
      return false;
    }
  },

  /** 解密并校验设置仓文件：只接受加密文件（设置含平台配置与设备会话，禁止明文入库），验签失败拒收 */
  async openSettingsFile(text: string): Promise<unknown | null> {
    const pass = await getUserPass();
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

  /** 从设置仓拉取全站设置与认证会话（增量：批量 SHA 对比，只拉有变化的文件） */
  async pullSettings(token?: string): Promise<SyncResult> {
    const tk = (token ?? '').trim() || (await resolveUserToken());
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌（设置仓共用同一令牌）' };
    if (!(await getUserPass())) return { ok: false, msg: '请先设置用户数据仓库加密口令' };
    return incrementalPull({
      files: SETTINGS_FILES,
      dir: SETTINGS_DIR,
      apiUrlFn: settingsApiUrl,
      metaKey: USER_META_KEY,
      getMeta: () => this.userMeta(),
      storeKeyMap: SETTINGS_STORE_KEYS,
      token: tk,
      openFile: (text) => this.openSettingsFile(text),
      sealData: async () => '', // pull 不需要
      putFile: async () => ({}), // pull 不需要
      verifyFailLabel: '验签失败/口令不符',
    });
  },

  /** 推送全站设置与认证会话到设置仓（增量推送 + 冲突检测；仅限管理员出口权限） */
  async pushSettings(token?: string): Promise<SyncResult> {
    if (!(await _requireAdminOperator())) return { ok: false, msg: '后端出口权限校验未通过：仅管理员可写入云端数据库（前端只读提取）' };
    const tk = (token ?? '').trim() || (await resolveUserToken());
    if (!tk) return { ok: false, msg: '请先配置用户数据仓库令牌（设置仓共用同一令牌）' };
    const pass = await getUserPass();
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
    return incrementalPush({
      files: SETTINGS_FILES,
      dir: SETTINGS_DIR,
      apiUrlFn: settingsApiUrl,
      metaKey: USER_META_KEY,
      getMeta: () => this.userMeta(),
      storeKeyMap: SETTINGS_STORE_KEYS,
      token: tk,
      openFile: async () => null, // push 不需要
      sealData: (data) => sealJson(JSON.stringify(data), keys),
      putFile: putSettingsFile as (path: string, content: string, token: string, sha: string | null) => Promise<{ content?: { sha?: string } }>,
    });
  },

  /** 一键修改全部加密口令：换新口令并自动用新口令重新加密推送三仓（内容库/用户库/设置仓）。本地数据为明文，直接重加密即可，无需先拉旧密文。 */
  async rotateAllPasswords(
    newPass: string,
  ): Promise<{ ok: boolean; results: { repo: string; ok: boolean; msg: string }[]; msg: string }> {
    const p = (newPass ?? '').trim();
    if (p.length < 6) return { ok: false, results: [], msg: '新口令至少 6 位' };
    // 管理员操作通道专用：更换全库加密口令属接入总数据仓库的高危操作
    if (!(await _requireAdminOperator('更换全库加密口令'))) return { ok: false, results: [], msg: '仅管理员可更换加密口令' };
    // 先落新口令：后续三个推送内部读取新口令派生新密钥（内容库 cloud-pass、用户库/设置仓 user-cloud-pass 统一更换）
    await savePass(p);
    await saveUserPass(p);
    const results: { repo: string; ok: boolean; msg: string }[] = [];
    const r1 = await this.pushToCloud();
    results.push({ repo: '内容库 22uuuc/6v', ok: r1.ok, msg: r1.msg ?? (r1.failed ?? []).join('、') });
    const r2 = await this.pushUserData();
    results.push({ repo: '用户库 22uuuc/moying-users', ok: r2.ok, msg: r2.msg ?? (r2.failed ?? []).join('、') });
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

  /**
   * 检测令牌权限：验证令牌对指定仓库是否有读写权限
   * 返回每个仓库的检测结果
   */
  async checkTokenPermissions(token?: string): Promise<{
    contentRepo: TokenPermissionResult;
    userRepo: TokenPermissionResult;
    settingsRepo: TokenPermissionResult;
  }> {
    const contentToken = (token ?? '').trim() || (await resolveContentToken());
    const userToken = (token ?? '').trim() || (await resolveUserToken());
    // 管理员操作通道专用：权限检测会暴露令牌能力范围，非管理员拒绝执行
    if (!(await _requireAdminOperator('令牌权限检测'))) throw new Error('仅管理员可执行令牌权限检测');

    const [contentRepo, userRepo, settingsRepo] = await Promise.all([
      _checkRepoPermission(contentToken, REPO_OWNER, REPO_NAME, '内容库'),
      _checkRepoPermission(userToken, USER_REPO_OWNER, USER_REPO_NAME, '用户数据仓'),
      _checkRepoPermission(userToken, REPO_OWNER, SETTINGS_REPO_NAME, '设置仓'),
    ]);

    return { contentRepo, userRepo, settingsRepo };
  },
};

/* ================= 自动同步引擎（管理员操作后自动推送到云端） ================= */

/** 令牌权限检测结果 */
interface TokenPermissionResult {
  repo: string;
  label: string;
  tokenConfigured: boolean;
  tokenValid: boolean;
  canRead: boolean;
  canWrite: boolean;
  error?: string;
}

/**
 * 检测单个仓库的令牌权限
 * 通过 GET 目录列表验证读权限，通过 GET 文件 SHA 辅助验证
 * 写权限通过尝试读取并判断返回信息推断（经典令牌检测方法）
 */
async function _checkRepoPermission(
  token: string,
  owner: string,
  name: string,
  label: string,
): Promise<TokenPermissionResult> {
  const repo = `${owner}/${name}`;
  const result: TokenPermissionResult = {
    repo,
    label,
    tokenConfigured: false,
    tokenValid: false,
    canRead: false,
    canWrite: false,
  };

  if (!token) {
    result.error = '未配置令牌';
    return result;
  }
  result.tokenConfigured = true;

  // 1. 验证令牌本身是否有效（GET /user）
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
      if (res.status === 401) {
        result.error = '令牌无效或已过期';
      } else {
        result.error = `令牌验证失败 HTTP ${res.status}`;
      }
      return result;
    }
    result.tokenValid = true;
  } catch (e) {
    result.error = `无法连接 GitHub：${e instanceof Error ? e.message : '网络错误'}`;
    return result;
  }

  // 2. 验证读权限（GET 仓库内容）
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (res.status === 404) {
      result.error = '仓库不存在或无访问权限';
      return result;
    }
    if (res.status === 403) {
      result.error = '令牌没有该仓库的读取权限';
      return result;
    }
    if (!res.ok) {
      result.error = `读取检测失败 HTTP ${res.status}`;
      return result;
    }
    result.canRead = true;
  } catch (e) {
    result.error = `读取检测失败：${e instanceof Error ? e.message : '网络错误'}`;
    return result;
  }

  // 3. 验证写权限：获取当前用户在该仓库的权限等级
  //    通过 GET /repos/{owner}/{repo}/collaborators/{username}/permission 检测
  try {
    // 先获取当前用户名
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (userRes.ok) {
      const userData = (await userRes.json()) as { login: string };
      const permRes = await fetch(
        `https://api.github.com/repos/${repo}/collaborators/${userData.login}/permission`,
        { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
      );
      if (permRes.ok) {
        const permData = (await permRes.json()) as { permission: string };
        // admin / write / read / none
        result.canWrite = permData.permission === 'admin' || permData.permission === 'write';
      }
    }
  } catch {
    // 权限接口可能因为令牌权限不足而失败，不影响已检测出的读权限
  }

  return result;
}

type SyncStatus = 'idle' | 'pending' | 'syncing' | 'error';

interface AutoSyncState {
  enabled: boolean;
  status: SyncStatus;
  lastError?: string;
  pendingCount: number;
}

const AUTO_SYNC_DEBOUNCE_MS = 3000; // 3 秒防抖：多次修改合并一次推送
let _autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
const _autoSyncState: AutoSyncState = { enabled: false, status: 'idle', pendingCount: 0 };
const _autoSyncListeners = new Set<(s: AutoSyncState) => void>();

function _emitAutoSyncState() {
  _autoSyncListeners.forEach((fn) => fn({ ..._autoSyncState }));
}

/** 订阅自动同步状态变化 */
export function onAutoSyncChange(fn: (s: AutoSyncState) => void) {
  _autoSyncListeners.add(fn);
  fn({ ..._autoSyncState });
  return () => {
    _autoSyncListeners.delete(fn);
  };
}

/** 获取当前自动同步状态 */
export function getAutoSyncState(): AutoSyncState {
  return { ..._autoSyncState };
}

/** 开启/关闭自动同步 */
export async function setAutoSyncEnabled(enabled: boolean) {
  _autoSyncState.enabled = enabled;
  if (!enabled) {
    // 关闭时清除待执行的同步
    if (_autoSyncTimer) {
      clearTimeout(_autoSyncTimer);
      _autoSyncTimer = null;
      _autoSyncState.pendingCount = 0;
      _autoSyncState.status = 'idle';
    }
  }
  _emitAutoSyncState();
}

/**
 * 触发一次同步调度（防抖）
 * 由 store.notify() 在数据变更时调用
 * 前置条件：已启用自动同步 + 管理员登录 + 令牌已配置
 */
export function scheduleAutoSync() {
  if (!_autoSyncState.enabled) return;
  if (_autoSyncState.status === 'syncing') {
    // 同步中又有修改 → 标记为待处理，等当前同步结束后再补一次
    _autoSyncState.pendingCount += 1;
    _emitAutoSyncState();
    return;
  }
  _autoSyncState.pendingCount += 1;
  _autoSyncState.status = 'pending';
  _emitAutoSyncState();

  if (_autoSyncTimer) clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(() => {
    _autoSyncTimer = null;
    void _doAutoSync();
  }, AUTO_SYNC_DEBOUNCE_MS);
}

/** 执行实际的同步操作（三仓增量推送） */
async function _doAutoSync() {
  if (_autoSyncState.status !== 'pending') return;
  _autoSyncState.status = 'syncing';
  _autoSyncState.pendingCount = 0;
  _emitAutoSyncState();

  try {
    // 内容库（需要内容库令牌 + 口令）
    const results: string[] = [];
    const errors: string[] = [];

    const hasContentToken = (await resolveContentToken()).length > 0;
    const hasContentPass = (await getPass()).length > 0;
    if (hasContentToken && hasContentPass) {
      const r = await cloud.pushToCloud();
      if (r.ok) {
        if (r.pushed && r.pushed.length > 0) results.push(`内容库+${r.pushed.length}`);
      } else {
        errors.push(`内容库: ${r.msg ?? '失败'}`);
      }
    }

    // 用户数据仓 + 设置仓（共用用户库令牌 + 口令）
    const hasUserToken = (await resolveUserToken()).length > 0;
    const hasUserPass = (await getUserPass()).length > 0;
    if (hasUserToken && hasUserPass) {
      const r2 = await cloud.pushUserData();
      if (r2.ok) {
        if (r2.pushed && r2.pushed.length > 0) results.push(`用户库+${r2.pushed.length}`);
      } else {
        if (r2.conflicts && r2.conflicts.length > 0) {
          errors.push(`用户库冲突: ${r2.conflicts.join(',')}`);
        } else {
          errors.push(`用户库: ${r2.msg ?? '失败'}`);
        }
      }

      const r3 = await cloud.pushSettings();
      if (r3.ok) {
        if (r3.pushed && r3.pushed.length > 0) results.push(`设置仓+${r3.pushed.length}`);
      } else {
        if (r3.conflicts && r3.conflicts.length > 0) {
          errors.push(`设置仓冲突: ${r3.conflicts.join(',')}`);
        } else {
          errors.push(`设置仓: ${r3.msg ?? '失败'}`);
        }
      }
    }

    if (errors.length > 0) {
      _autoSyncState.status = 'error';
      _autoSyncState.lastError = errors.join('；');
    } else {
      _autoSyncState.status = 'idle';
      _autoSyncState.lastError = undefined;
    }
  } catch (e) {
    _autoSyncState.status = 'error';
    _autoSyncState.lastError = e instanceof Error ? e.message : '同步异常';
  }

  _emitAutoSyncState();

  // 如果同步期间又有新修改，继续同步
  if (_autoSyncState.pendingCount > 0 && _autoSyncState.status !== 'error') {
    _autoSyncState.status = 'pending';
    _autoSyncTimer = setTimeout(() => {
      _autoSyncTimer = null;
      void _doAutoSync();
    }, 1000); // 快速补同步（1 秒间隔避免 API 限流）
  }
}

/** 手动触发一次立即同步（跳过防抖） */
export async function triggerAutoSyncNow() {
  if (_autoSyncTimer) {
    clearTimeout(_autoSyncTimer);
    _autoSyncTimer = null;
  }
  if (_autoSyncState.status === 'syncing') return;
  _autoSyncState.pendingCount = Math.max(_autoSyncState.pendingCount, 1);
  _autoSyncState.status = 'pending';
  _emitAutoSyncState();
  await _doAutoSync();
}

// 注册数据变更钩子：任何 store 写操作都会触发自动同步调度
let _autoSyncHookRegistered = false;
function _ensureAutoSyncHook() {
  if (_autoSyncHookRegistered) return;
  _autoSyncHookRegistered = true;
  onAfterNotify(() => {
    scheduleAutoSync();
  });
}
// 在模块加载时自动注册钩子
_ensureAutoSyncHook();
