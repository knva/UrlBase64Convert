export interface EncodedResult {
  parts: string[];
  preview: string;
  size: number;
}

export interface DecodedResult {
  parts: Uint8Array<ArrayBuffer>[];
  preview: string;
  size: number;
}

type ProgressCallback = (progress: number) => void;

const TEXT_CHUNK_SIZE = 512 * 1024;
const BASE64_BYTE_CHUNK_SIZE = 3 * 16 * 1024;
const BASE64_TEXT_CHUNK_SIZE = 4 * 16 * 1024;
const BINARY_STRING_CHUNK_SIZE = 32 * 1024;
const PREVIEW_CHARACTER_LIMIT = 200_000;

const urlEscapes: Record<string, string> = {
  "+": "%2B",
  "/": "%2F",
  "=": "%3D",
};

function bytesToBinaryString(bytes: Uint8Array) {
  let binary = "";
  for (
    let offset = 0;
    offset < bytes.length;
    offset += BINARY_STRING_CHUNK_SIZE
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + BINARY_STRING_CHUNK_SIZE),
    );
  }
  return binary;
}

function appendPreview(current: string, value: string) {
  if (current.length >= PREVIEW_CHARACTER_LIMIT) return current;
  return current + value.slice(0, PREVIEW_CHARACTER_LIMIT - current.length);
}

function encodeBase64Bytes(bytes: Uint8Array) {
  const base64 = btoa(bytesToBinaryString(bytes));
  return base64.replace(/[+/=]/g, (character) => urlEscapes[character]);
}

export function encodeTextToUrlBase64(
  source: string,
  onProgress?: ProgressCallback,
): EncodedResult {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let preview = "";
  let size = 0;
  let carry = new Uint8Array(0);
  let offset = 0;

  const appendPart = (part: string) => {
    parts.push(part);
    size += part.length;
    preview = appendPreview(preview, part);
  };

  while (offset < source.length) {
    let end = Math.min(offset + TEXT_CHUNK_SIZE, source.length);
    if (
      end < source.length &&
      end > offset &&
      source.charCodeAt(end - 1) >= 0xd800 &&
      source.charCodeAt(end - 1) <= 0xdbff
    ) {
      end -= 1;
    }

    const encoded = encoder.encode(source.slice(offset, end));
    let bytes = encoded;
    if (carry.length) {
      bytes = new Uint8Array(carry.length + encoded.length);
      bytes.set(carry);
      bytes.set(encoded, carry.length);
    }

    const readyLength = bytes.length - (bytes.length % 3);
    for (
      let byteOffset = 0;
      byteOffset < readyLength;
      byteOffset += BASE64_BYTE_CHUNK_SIZE
    ) {
      appendPart(
        encodeBase64Bytes(
          bytes.subarray(
            byteOffset,
            Math.min(byteOffset + BASE64_BYTE_CHUNK_SIZE, readyLength),
          ),
        ),
      );
    }
    carry = bytes.slice(readyLength);
    offset = end;
    onProgress?.(source.length ? offset / source.length : 1);
  }

  if (carry.length) appendPart(encodeBase64Bytes(carry));
  onProgress?.(1);
  return { parts, preview, size };
}

function decodeBinaryString(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodePercentEncodedAscii(value: string) {
  const decoded = value.replace(/%([\da-f]{2})/gi, (_, hexadecimal: string) => {
    const byte = Number.parseInt(hexadecimal, 16);
    if (byte > 0x7f) {
      throw new Error("URL 解码后包含非 ASCII 字符，无法作为 Base64 处理");
    }
    return String.fromCharCode(byte);
  });
  if (decoded.includes("%")) {
    throw new Error("URL 编码不完整，请检查 % 后是否有两位十六进制字符");
  }
  return decoded;
}

export function decodeUrlBase64ToBytes(
  source: string,
  onProgress?: ProgressCallback,
): DecodedResult {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const previewDecoder = new TextDecoder();
  let preview = "";
  let previewComplete = false;
  let size = 0;
  let base64Buffer = "";
  let rawCarry = "";
  let sawPadding = false;
  let paddingCount = 0;

  const decodeChunk = (base64: string) => {
    let binary: string;
    try {
      binary = atob(base64);
    } catch {
      throw new Error("Base64 内容无效，请检查字符、顺序和末尾填充");
    }
    const bytes = decodeBinaryString(binary);
    parts.push(bytes);
    size += bytes.length;

    if (!previewComplete) {
      const text = previewDecoder.decode(bytes, { stream: true });
      const remaining = PREVIEW_CHARACTER_LIMIT - preview.length;
      preview += text.slice(0, remaining);
      previewComplete = text.length >= remaining;
    }
  };

  const consumeRawText = (rawText: string) => {
    let normalized = decodePercentEncodedAscii(rawText)
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    if (!normalized) return;
    if (!/^[a-z\d+/=]+$/i.test(normalized)) {
      throw new Error("内容包含 Base64 字母表以外的字符");
    }

    const firstPadding = normalized.indexOf("=");
    if (firstPadding >= 0) {
      if (sawPadding && firstPadding > 0) {
        throw new Error("Base64 填充符 = 之后不能再出现数据");
      }
      const padding = normalized.slice(firstPadding);
      if (!/^=+$/.test(padding)) {
        throw new Error("Base64 填充符 = 只能出现在内容末尾");
      }
      if (sawPadding && normalized.slice(0, firstPadding)) {
        throw new Error("Base64 填充符 = 之后不能再出现数据");
      }
      sawPadding = true;
      paddingCount += padding.length;
      if (paddingCount > 2) throw new Error("Base64 末尾填充符不能超过两个");
    } else if (sawPadding) {
      throw new Error("Base64 填充符 = 之后不能再出现数据");
    }

    base64Buffer += normalized;
    normalized = "";
    while (!sawPadding && base64Buffer.length >= BASE64_TEXT_CHUNK_SIZE) {
      decodeChunk(base64Buffer.slice(0, BASE64_TEXT_CHUNK_SIZE));
      base64Buffer = base64Buffer.slice(BASE64_TEXT_CHUNK_SIZE);
    }
  };

  for (let offset = 0; offset < source.length; offset += TEXT_CHUNK_SIZE) {
    const end = Math.min(offset + TEXT_CHUNK_SIZE, source.length);
    let rawText = rawCarry + source.slice(offset, end);
    rawCarry = "";

    if (end < source.length) {
      const lastPercent = rawText.lastIndexOf("%");
      if (lastPercent >= rawText.length - 2) {
        rawCarry = rawText.slice(lastPercent);
        rawText = rawText.slice(0, lastPercent);
      }
    }

    consumeRawText(rawText);
    onProgress?.(source.length ? end / source.length : 1);
  }

  if (rawCarry) consumeRawText(rawCarry);

  if (base64Buffer.length) {
    if (sawPadding) {
      if (base64Buffer.length % 4 !== 0) {
        throw new Error("Base64 长度或末尾填充不正确");
      }
    } else {
      const remainder = base64Buffer.length % 4;
      if (remainder === 1) throw new Error("Base64 长度不正确");
      if (remainder) base64Buffer += "=".repeat(4 - remainder);
    }
    decodeChunk(base64Buffer);
  }

  if (!previewComplete) {
    preview = appendPreview(preview, previewDecoder.decode());
  }
  onProgress?.(1);
  return { parts, preview, size };
}
