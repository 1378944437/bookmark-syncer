/**
 * 加密工具函数
 * - generateHash：书签内容哈希（同步身份识别）
 * - encryptText/decryptText：端到端加密（AES-256-GCM + PBKDF2 派生密钥）
 *
 * 端到端加密格式（v1）：base64( magic "MSYE1" | salt 16B | iv 12B | ciphertext )
 * 每次加密使用随机 salt 与 iv，两台设备用相同密码即可解出同一密钥，
 * 无需任何额外的密钥交换
 */

/** 端到端加密数据头（magic + 版本），同时用于快速识别密文 */
const E2E_MAGIC = "MSYE1";
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const GCM_TAG_BYTES = 16;

/** 派生密钥缓存（PBKDF2 较慢，同一密码+盐不重复派生） */
const derivedKeyCache = new Map<string, CryptoKey>();

/** 密文缺少解密密码：调用方应提示用户开启端到端加密并输入密码 */
export class E2EPasswordRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2EPasswordRequiredError";
  }
}

/** 密文解密失败（密码不一致或数据损坏） */
export class E2EDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "E2EDecryptError";
  }
}

/** 分块 base64 编码，避免大负载时 String.fromCharCode 参数超限 */
function toBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  let saltB64 = "";
  for (let i = 0; i < salt.length; i += 0x1000) {
    saltB64 += String.fromCharCode.apply(null, Array.from(salt.subarray(i, i + 0x1000)));
  }
  const cacheKey = `${passphrase}:${saltB64}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) return cached;

  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  // 简单上限，防止长会话下缓存无限增长
  if (derivedKeyCache.size >= 8) {
    derivedKeyCache.delete(derivedKeyCache.keys().next().value as string);
  }
  derivedKeyCache.set(cacheKey, key);
  return key;
}

/**
 * 端到端加密：随机 salt/iv，AES-256-GCM 认证加密，输出 base64 载荷
 */
export async function encryptText(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new E2EPasswordRequiredError("加密密码为空");

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );

  const magic = new TextEncoder().encode(E2E_MAGIC);
  const payload = new Uint8Array(magic.length + salt.length + iv.length + ciphertext.length);
  payload.set(magic, 0);
  payload.set(salt, magic.length);
  payload.set(iv, magic.length + salt.length);
  payload.set(ciphertext, magic.length + salt.length + iv.length);
  return toBase64(payload);
}

/**
 * 端到端解密：密码不一致（GCM 校验失败）或数据损坏时抛出 E2EDecryptError
 */
export async function decryptText(payloadB64: string, passphrase: string): Promise<string> {
  let payload: Uint8Array;
  try {
    payload = fromBase64(payloadB64);
  } catch {
    throw new E2EDecryptError("端到端加密数据不是有效的 base64");
  }

  const magic = new TextEncoder().encode(E2E_MAGIC);
  if (
    payload.length < magic.length + SALT_BYTES + IV_BYTES + GCM_TAG_BYTES ||
    !magic.every((byte, i) => payload[i] === byte)
  ) {
    throw new E2EDecryptError("端到端加密数据格式无效");
  }

  const salt = payload.slice(magic.length, magic.length + SALT_BYTES);
  const iv = payload.slice(magic.length + SALT_BYTES, magic.length + SALT_BYTES + IV_BYTES);
  const ciphertext = payload.slice(magic.length + SALT_BYTES + IV_BYTES);
  const key = await deriveKey(passphrase, salt);

  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    throw new E2EDecryptError("解密失败：端到端加密密码与加密该备份的设备不一致");
  }
}

/**
 * 生成内容哈希（用于书签同步）
 * 使用 SHA-256 算法对书签内容进行哈希
 *
 * @param url 书签 URL
 * @param title 书签标题
 * @returns SHA-256 哈希值（64 个十六进制字符）
 */
export async function generateHash(url: string, title: string): Promise<string> {
  const content = `${url}|${title}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
