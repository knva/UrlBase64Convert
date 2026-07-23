import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  decodeUrlBase64ToBytes,
  encodeTextToUrlBase64,
} from "../utils/base64.ts";

function expectedEncoding(value) {
  return encodeURIComponent(Buffer.from(value, "utf8").toString("base64"));
}

function concatenateBytes(parts) {
  return Buffer.concat(
    parts.map((part) => Buffer.from(part.buffer, part.byteOffset, part.byteLength)),
  );
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

const smallCases = [
  "hello world",
  "中文、emoji 🙂 与换行\n第二行",
  "a".repeat(512 * 1024 - 1) + "🙂边界",
];

for (const source of smallCases) {
  const encoded = encodeTextToUrlBase64(source);
  const encodedText = encoded.parts.join("");
  assert.equal(encodedText, expectedEncoding(source));
  assert.equal(encoded.size, encodedText.length);

  const decoded = decodeUrlBase64ToBytes(encodedText);
  assert.equal(concatenateBytes(decoded.parts).toString("utf8"), source);
}

const base64Url = Buffer.from("Base64URL 兼容性 🙂", "utf8")
  .toString("base64url");
assert.equal(
  concatenateBytes(decodeUrlBase64ToBytes(`\n${base64Url}\r\n`).parts).toString(
    "utf8",
  ),
  "Base64URL 兼容性 🙂",
);

assert.throws(
  () => decodeUrlBase64ToBytes("%%%"),
  /URL 编码不完整/,
);
assert.throws(
  () => decodeUrlBase64ToBytes("YWJj=Z"),
  /填充符/,
);

for (const encodedAcrossBoundary of [
  "A".repeat(512 * 1024 - 1) + "%2B",
  "A".repeat(512 * 1024 - 2) + "%2B" + "A",
]) {
  assert.equal(
    decodeUrlBase64ToBytes(encodedAcrossBoundary).size,
    (512 * 1024 * 3) / 4,
  );
}

const targetBytes = 21 * 1024 * 1024;
const unit = "Large text / 大文本 / 🙂 / 0123456789\n";
const repeats = Math.ceil(targetBytes / Buffer.byteLength(unit));
const largeSource = unit.repeat(repeats);
const sourceBytes = Buffer.byteLength(largeSource);
assert.ok(sourceBytes >= targetBytes);

const encodeStartedAt = performance.now();
const largeEncoded = encodeTextToUrlBase64(largeSource);
const encodedText = largeEncoded.parts.join("");
const encodeMs = performance.now() - encodeStartedAt;

const decodeStartedAt = performance.now();
const largeDecoded = decodeUrlBase64ToBytes(encodedText);
const decodeMs = performance.now() - decodeStartedAt;
const decodedBuffer = concatenateBytes(largeDecoded.parts);

assert.equal(largeDecoded.size, sourceBytes);
assert.equal(digest(decodedBuffer), digest(Buffer.from(largeSource, "utf8")));

console.log(
  JSON.stringify(
    {
      sourceMiB: Number((sourceBytes / 1024 / 1024).toFixed(2)),
      encodedMiB: Number((largeEncoded.size / 1024 / 1024).toFixed(2)),
      chunks: {
        encoded: largeEncoded.parts.length,
        decoded: largeDecoded.parts.length,
      },
      encodeSeconds: Number((encodeMs / 1000).toFixed(3)),
      decodeSeconds: Number((decodeMs / 1000).toFixed(3)),
      sha256: digest(decodedBuffer),
    },
    null,
    2,
  ),
);
