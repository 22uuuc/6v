// EXPORTS:
//   sha256(text) → Promise<string>            —— SHA-256 哈希（用于数据完整性签名）
//   sha256Sync(text) → string                 —— 同步 SHA-256 降级（Web Crypto 不可用时回退）
//   aesEncrypt(plaintext, key) → Promise<string>  —— AES-GCM 加密（用于敏感数据存储）
//   aesDecrypt(ciphertext, key) → Promise<string> —— AES-GCM 解密
//   deriveKey(password, salt) → Promise<CryptoKey> —— PBKDF2 从口令派生密钥
//   generateSalt() → string                    —— 生成随机盐值
//   hashPassword(password, salt?) → Promise<{ hash: string; salt: string }>  —— 口令哈希（PBKDF2+SHA-256）
//   verifyPassword(password, hash, salt) → Promise<boolean>                   —— 验证口令
//   getAppCryptoKey() → Promise<CryptoKey>    —— 应用级加密密钥（懒加载单例）
//   isWebCryptoAvailable() → boolean          —— 检测 Web Crypto 支持
//
// 设计原则：
//   1. 优先使用浏览器原生 Web Crypto API（安全、高性能、硬件加速）
//   2. 所有加密函数均为异步（Web Crypto 是 Promise-based）
//   3. 提供同步降级方案（隐私模式 / 旧浏览器），但强度降低
//   4. AES-GCM 提供机密性 + 完整性校验（auth tag）
//   5. 口令存储使用 PBKDF2 慢哈希，防彩虹表与暴力破解

/* ---------- 工具函数 ---------- */

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

/** 把 ArrayBuffer 转成 base64 字符串 */
function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** 把 base64 字符串转成 ArrayBuffer */
function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** 检测是否支持 Web Crypto */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    !!crypto.subtle &&
    typeof crypto.subtle.digest === 'function'
  );
}

/* ---------- SHA-256 哈希（数据完整性签名） ---------- */

/**
 * 异步 SHA-256 哈希（使用 Web Crypto，安全可靠）
 * 返回 base64 编码的哈希值
 */
export async function sha256(text: string): Promise<string> {
  if (!isWebCryptoAvailable()) {
    return sha256Sync(text);
  }
  const data = TEXT_ENCODER.encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuf);
}

/**
 * 同步 SHA-256 降级实现（Web Crypto 不可用时使用）
 * 基于 FNV-1a 64 位变体的增强哈希，强度远高于 DJB2，但仍低于真实 SHA-256
 * 仅用于隐私模式等降级场景
 */
export function sha256Sync(text: string): string {
  // FNV-1a 64 位变体（用两个 32 位值模拟）
  let h0 = 0x811c9dc5; // FNV offset basis (low 32)
  let h1 = 0x01000193; // FNV prime (high 32 approximation)
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h0 ^= c & 0xff;
    h0 = Math.imul(h0, 0x01000193);
    h1 ^= (c >> 8) & 0xff;
    h1 = Math.imul(h1, 0x811c9dc5);
  }
  // 再加一轮字符位置敏感的混淆
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h0 = Math.imul(h0 ^ (c * (i + 1)), 0x01000193);
    h1 = Math.imul(h1 ^ ((c << 1) * (i + 2)), 0x811c9dc5);
  }
  h0 = h0 >>> 0;
  h1 = h1 >>> 0;
  return `${text.length}:${h0.toString(36)}${h1.toString(36)}`;
}

/* ---------- AES-GCM 加密（敏感数据存储） ---------- */

// AES-GCM 参数：256 位密钥、96 位随机 IV（推荐）、128 位认证标签
const IV_LENGTH = 12; // 96 bits = 12 bytes，GCM 推荐长度

/**
 * 生成随机盐值（base64 编码）
 */
export function generateSalt(byteLength: number = 16): string {
  if (isWebCryptoAvailable()) {
    const buf = new Uint8Array(byteLength);
    crypto.getRandomValues(buf);
    return bufferToBase64(buf.buffer);
  }
  // 降级：Math.random 生成（不够安全但能用）
  let s = '';
  for (let i = 0; i < byteLength; i += 1) {
    s += String.fromCharCode(Math.floor(Math.random() * 256));
  }
  return btoa(s);
}

/**
 * 从口令派生出 AES 密钥（PBKDF2 + SHA-256，10 万次迭代）
 * 用于：需要口令保护的敏感数据（如管理安全码加密的 GitHub token）
 */
export async function deriveKey(
  password: string,
  salt: string,
  iterations: number = 100000,
): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API not available for key derivation');
  }
  const passwordBuf = TEXT_ENCODER.encode(password);
  const saltBuf = base64ToBuffer(salt);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * 导入原始密钥（用于固定密钥场景，如应用级加密密钥）
 * 注意：前端固定密钥只是"防小白"级别，真正安全需服务端配合
 */
export async function importRawKey(keyBuffer: ArrayBuffer): Promise<CryptoKey> {
  if (!isWebCryptoAvailable()) {
    throw new Error('Web Crypto API not available');
  }
  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * AES-GCM 加密
 * 输出格式：base64(iv + ciphertext + authTag)，即 IV 在前密文在后
 * authTag 由 Web Crypto 自动追加在密文末尾
 */
export async function aesEncrypt(plaintext: string, key: CryptoKey): Promise<string> {
  if (!isWebCryptoAvailable()) {
    // 降级：XOR + Base64（仅演示，不推荐生产）
    return legacyXorEncrypt(plaintext);
  }
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  const data = TEXT_ENCODER.encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );
  // 拼接 IV + 密文（含 auth tag）
  const result = new Uint8Array(iv.length + cipherBuf.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(cipherBuf), iv.length);
  return bufferToBase64(result.buffer);
}

/**
 * AES-GCM 解密
 * 输入格式：base64(iv + ciphertext + authTag)
 */
export async function aesDecrypt(ciphertext: string, key: CryptoKey): Promise<string> {
  if (!isWebCryptoAvailable()) {
    return legacyXorDecrypt(ciphertext);
  }
  try {
    const data = new Uint8Array(base64ToBuffer(ciphertext));
    const iv = data.slice(0, IV_LENGTH);
    const cipher = data.slice(IV_LENGTH);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipher,
    );
    return TEXT_DECODER.decode(plainBuf);
  } catch {
    return '';
  }
}

/* ---------- 口令哈希（PBKDF2，用于密码存储） ---------- */

/**
 * 口令哈希：PBKDF2 + SHA-256 + 随机盐
 * 返回 { hash: base64字符串, salt: base64字符串 }
 */
export async function hashPassword(
  password: string,
  salt?: string,
): Promise<{ hash: string; salt: string }> {
  if (!isWebCryptoAvailable()) {
    // 降级：简单加盐哈希（远弱于 PBKDF2，但聊胜于无）
    const s = salt ?? generateSalt(8);
    const h = sha256Sync(`${s}:${password}:${s}`);
    return { hash: h, salt: s };
  }
  const s = salt ?? generateSalt(16);
  const passwordBuf = TEXT_ENCODER.encode(password);
  const saltBuf = base64ToBuffer(s);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuf,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const hashBuf = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256, // 256 位输出
  );
  return { hash: bufferToBase64(hashBuf), salt: s };
}

/**
 * 验证口令（恒定时间比较，防时序攻击）
 */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  const result = await hashPassword(password, salt);
  if (result.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i += 1) {
    diff |= hash.charCodeAt(i) ^ result.hash.charCodeAt(i);
  }
  return diff === 0;
}

/* ---------- 降级 XOR 加密（Web Crypto 不可用时） ---------- */

// 固定降级密钥（仅用于降级场景，强度很低）
const LEGACY_KEY = 'moying-novel-legacy-xor-key-v1';

function legacyXorEncrypt(plaintext: string): string {
  let out = '';
  for (let i = 0; i < plaintext.length; i += 1) {
    out += String.fromCharCode(
      plaintext.charCodeAt(i) ^ LEGACY_KEY.charCodeAt(i % LEGACY_KEY.length),
    );
  }
  return btoa(unescape(encodeURIComponent(out)));
}

function legacyXorDecrypt(ciphertext: string): string {
  try {
    const t = decodeURIComponent(escape(atob(ciphertext)));
    let out = '';
    for (let i = 0; i < t.length; i += 1) {
      out += String.fromCharCode(
        t.charCodeAt(i) ^ LEGACY_KEY.charCodeAt(i % LEGACY_KEY.length),
      );
    }
    return out;
  } catch {
    return '';
  }
}

/* ---------- 应用级默认加密密钥（派生自命名空间） ---------- */

// 注意：前端存储的"加密"仅为提高攻击门槛，无法真正抵御本地攻击者。
// 真正的安全需要服务端 + 用户口令 + 安全硬件。
// 这里用应用命名空间派生一个固定密钥，用于 session 等非核心敏感数据。

let _appKeyPromise: Promise<CryptoKey> | null = null;

/**
 * 获取应用级加密密钥（懒加载、单例）
 * 用于 session、用户偏好等一般敏感数据的加密存储
 */
export function getAppCryptoKey(): Promise<CryptoKey> {
  if (!_appKeyPromise) {
    _appKeyPromise = (async () => {
      if (!isWebCryptoAvailable()) {
        throw new Error('Web Crypto not available');
      }
      // 从应用命名空间派生一个固定密钥
      const namespace = 'moying-novel-app-encryption-key-v1';
      const buf = TEXT_ENCODER.encode(namespace);
      const hashBuf = await crypto.subtle.digest('SHA-256', buf);
      return importRawKey(hashBuf);
    })();
  }
  return _appKeyPromise;
}
