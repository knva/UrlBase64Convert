import { mkdir, open, writeFile } from "node:fs/promises";
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
