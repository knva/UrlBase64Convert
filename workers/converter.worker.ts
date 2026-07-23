import {
  decodeUrlBase64ToBytes,
  encodeTextToUrlBase64,
} from "../utils/base64";

type Operation = "encode" | "decode";

interface ConvertRequest {
  id: number;
  operation: Operation;
  source: string | File;
}

const INLINE_RESULT_LIMIT = 2_000_000;

function createProgressReporter(id: number, stage: string) {
  let lastProgress = -1;
  let lastReportedAt = 0;
  return (progress: number) => {
    const now = performance.now();
    if (progress < 1 && progress - lastProgress < 0.01 && now - lastReportedAt < 100) {
      return;
    }
    lastProgress = progress;
    lastReportedAt = now;
    self.postMessage({ id, type: "progress", progress, stage });
  };
}

function getDownloadName(source: string | File, operation: Operation) {
  const originalName = source instanceof File ? source.name : "result";
  const baseName = originalName.replace(/\.(txt|base64)$/i, "") || "result";
  return operation === "encode"
    ? `${baseName}.url-base64.txt`
    : `${baseName}.decoded.txt`;
}

self.addEventListener("message", async (event: MessageEvent<ConvertRequest>) => {
  const { id, operation, source } = event.data;
  const startedAt = performance.now();

  try {
    self.postMessage({
      id,
      type: "progress",
      progress: 0,
      stage: source instanceof File ? "正在读取文件" : "正在准备文本",
    });
    const text = source instanceof File ? await source.text() : source;
    const reportProgress = createProgressReporter(
      id,
      operation === "encode" ? "正在分块编码" : "正在分块解码",
    );

    const converted =
      operation === "encode"
        ? encodeTextToUrlBase64(text, reportProgress)
        : decodeUrlBase64ToBytes(text, reportProgress);
    const blob = new Blob(converted.parts, {
      type: "text/plain;charset=utf-8",
    });
    const inlineText =
      converted.size <= INLINE_RESULT_LIMIT ? await blob.text() : undefined;

    self.postMessage({
      id,
      type: "result",
      blob,
      preview: inlineText ?? converted.preview,
      inlineText,
      size: converted.size,
      elapsedMs: performance.now() - startedAt,
      downloadName: getDownloadName(source, operation),
    });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export {};
