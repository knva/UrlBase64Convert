import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tmp/large-input.txt",
);
await mkdir(dirname(fixturePath), { recursive: true });

const file = await open(fixturePath, "w");
const oneMiB = Buffer.alloc(1024 * 1024, "x");
try {
  for (let index = 0; index < 21; index += 1) {
    await file.write(oneMiB);
  }
} finally {
  await file.close();
}

console.log(fixturePath);

const encodedFixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tmp/large-input.base64",
);
const encodedFixture = Buffer.alloc(21 * 1024 * 1024, "x").toString("base64");
await writeFile(encodedFixturePath, encodedFixture, "ascii");
console.log(encodedFixturePath);

const largeJsonPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tmp/large-json.json",
);
const largeJsonFile = await open(largeJsonPath, "w");
const jsonTargetBytes = 20 * 1024 * 1024;
const jsonHeader = '{\n  "items": [\n';
let jsonBytes = Buffer.byteLength(jsonHeader);
let jsonBuffer = jsonHeader;
let recordIndex = 0;

try {
  while (jsonBytes < jsonTargetBytes) {
    const name =
      recordIndex === 123_456
        ? "needle-json-search-987654"
        : `entry-${recordIndex}`;
    const line = `    {"id":${recordIndex},"name":"${name}","value":"${"x".repeat(64)}"},\n`;
    jsonBuffer += line;
    jsonBytes += Buffer.byteLength(line);
    recordIndex += 1;
    if (jsonBuffer.length >= 1024 * 1024) {
      await largeJsonFile.write(jsonBuffer);
      jsonBuffer = "";
    }
  }
  jsonBuffer += '    {"id":-1,"name":"final-record","value":"done"}\n  ]\n}\n';
  await largeJsonFile.write(jsonBuffer);
} finally {
  await largeJsonFile.close();
}

const largeJsonBase64Path = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tmp/large-json.base64",
);
const largeJsonBytes = await readFile(largeJsonPath);
await writeFile(largeJsonBase64Path, largeJsonBytes.toString("base64"), "ascii");
console.log(largeJsonPath);
console.log(largeJsonBase64Path);
