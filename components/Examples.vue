<script setup lang="ts">
type Operation = "encode" | "decode";

interface ProgressMessage {
  id: number;
  type: "progress";
  progress: number;
  stage: string;
}

interface ResultMessage {
  id: number;
  type: "result";
  blob: Blob;
  preview: string;
  inlineText?: string;
  size: number;
  elapsedMs: number;
  downloadName: string;
}

interface ErrorMessage {
  id: number;
  type: "error";
  error: string;
}

type WorkerMessage = ProgressMessage | ResultMessage | ErrorMessage;

const INLINE_RESULT_LIMIT = 2_000_000;

const inputElement = ref<HTMLTextAreaElement | null>(null);
const fileElement = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const inputLength = ref(0);
const outputText = ref("");
const outputBlob = ref<Blob | null>(null);
const outputSize = ref(0);
const downloadUrl = ref("");
const downloadName = ref("result.txt");
const resultIsPreview = ref(false);
const processing = ref(false);
const progress = ref(0);
const stage = ref("等待输入");
const statusKind = ref<"normal" | "success" | "error">("normal");
const copyLabel = ref("复制完整结果");

let converterWorker: Worker | null = null;
let requestSequence = 0;
let activeRequestId = 0;

const inputSummary = computed(() => {
  if (selectedFile.value) {
    return `${selectedFile.value.name} · ${formatBytes(selectedFile.value.size)}`;
  }
  return `${inputLength.value.toLocaleString()} 字符`;
});

const outputSummary = computed(() =>
  outputBlob.value ? formatBytes(outputSize.value) : "尚无结果",
);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function releaseDownloadUrl() {
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value);
    downloadUrl.value = "";
  }
}

function resetResult() {
  releaseDownloadUrl();
  outputText.value = "";
  outputBlob.value = null;
  outputSize.value = 0;
  resultIsPreview.value = false;
  copyLabel.value = "复制完整结果";
}

function createWorker() {
  const worker = new Worker(
    new URL("../workers/converter.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.addEventListener("message", handleWorkerMessage);
  worker.addEventListener("error", (event) => {
    if (converterWorker === worker) converterWorker = null;
    worker.terminate();
    processing.value = false;
    statusKind.value = "error";
    stage.value = event.message || "转换线程运行失败";
  });
  return worker;
}

function getWorker() {
  if (!converterWorker) converterWorker = createWorker();
  return converterWorker;
}

function terminateWorker() {
  converterWorker?.terminate();
  converterWorker = null;
}

function handleWorkerMessage(event: MessageEvent<WorkerMessage>) {
  const message = event.data;
  if (message.id !== activeRequestId) return;

  if (message.type === "progress") {
    progress.value = Math.round(message.progress * 100);
    stage.value = message.stage;
    return;
  }

  processing.value = false;

  if (message.type === "error") {
    progress.value = 0;
    statusKind.value = "error";
    stage.value = message.error;
    return;
  }

  resetResult();
  outputBlob.value = message.blob;
  outputSize.value = message.size;
  outputText.value = message.inlineText ?? message.preview;
  resultIsPreview.value = message.inlineText === undefined;
  downloadName.value = message.downloadName;
  downloadUrl.value = URL.createObjectURL(message.blob);
  progress.value = 100;
  statusKind.value = "success";
  stage.value = `转换完成 · ${(message.elapsedMs / 1000).toFixed(2)} 秒`;
}

function handleInput(event: Event) {
  inputLength.value = (event.target as HTMLTextAreaElement).value.length;
}

function handleFile(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  selectedFile.value = files?.[0] ?? null;
  statusKind.value = "normal";
  stage.value = selectedFile.value
    ? "已选择文件，转换时将优先读取文件"
    : "等待输入";
}

function removeFile() {
  selectedFile.value = null;
  if (fileElement.value) fileElement.value.value = "";
  stage.value = "已切换为文本框输入";
}

function run(operation: Operation) {
  const textareaValue = inputElement.value?.value ?? "";
  const source = selectedFile.value ?? textareaValue;
  const sourceIsEmpty =
    source instanceof File ? source.size === 0 : source.length === 0;

  if (sourceIsEmpty) {
    statusKind.value = "error";
    stage.value = "请粘贴文本或选择文本文件";
    return;
  }

  resetResult();
  processing.value = true;
  progress.value = 0;
  statusKind.value = "normal";
  stage.value = operation === "encode" ? "准备编码" : "准备解码";
  activeRequestId = ++requestSequence;
  getWorker().postMessage({
    id: activeRequestId,
    operation,
    source,
  });
}

function cancel() {
  if (!processing.value) return;
  terminateWorker();
  processing.value = false;
  progress.value = 0;
  statusKind.value = "normal";
  stage.value = "转换已取消";
}

function clearAll() {
  cancel();
  if (inputElement.value) inputElement.value.value = "";
  inputLength.value = 0;
  selectedFile.value = null;
  if (fileElement.value) fileElement.value.value = "";
  resetResult();
  statusKind.value = "normal";
  stage.value = "等待输入";
}

async function copyResult() {
  if (!outputBlob.value) return;
  copyLabel.value = "正在读取…";
  try {
    const text = await outputBlob.value.text();
    await writeClipboard(text);
    copyLabel.value = "已复制";
    statusKind.value = "success";
    stage.value = "完整结果已复制到剪贴板";
  } catch {
    copyLabel.value = "复制失败";
    statusKind.value = "error";
    stage.value = "浏览器拒绝复制大文本，请使用下载按钮";
  }
  window.setTimeout(() => {
    copyLabel.value = "复制完整结果";
  }, 1800);
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    if (!document.execCommand("copy")) throw new Error("copy failed");
  } finally {
    textarea.remove();
  }
}

async function showFullResult() {
  if (!outputBlob.value || !resultIsPreview.value) return;
  statusKind.value = "normal";
  stage.value = "正在载入完整结果，浏览器可能短暂卡顿";
  outputText.value = await outputBlob.value.text();
  resultIsPreview.value = false;
  statusKind.value = "success";
  stage.value = "完整结果已显示";
}

onBeforeUnmount(() => {
  terminateWorker();
  releaseDownloadUrl();
});
</script>

<template>
  <div class="tool-shell">
    <header class="hero">
      <p class="eyebrow">LOCAL · PRIVATE · CHUNKED</p>
      <h1>URL Base64 大文本转换</h1>
      <p class="hero-copy">
        转换在浏览器本地完成。分块算法与独立线程避免大数组调用栈溢出，
        20MB 以上建议直接选择文件。
      </p>
    </header>

    <section class="workspace" aria-label="URL Base64 转换区">
      <article class="panel">
        <div class="panel-heading">
          <div>
            <span class="panel-kicker">01 / INPUT</span>
            <h2>输入</h2>
          </div>
          <span class="measure">{{ inputSummary }}</span>
        </div>

        <textarea
          ref="inputElement"
          class="text-area"
          placeholder="粘贴普通文本、Base64 或 URL 编码后的 Base64…"
          spellcheck="false"
          @input="handleInput"
        />

        <div class="file-row">
          <label class="file-picker">
            <span>选择大文本文件</span>
            <input
              ref="fileElement"
              type="file"
              accept=".txt,.base64,text/plain"
              @change="handleFile"
            />
          </label>
          <button
            v-if="selectedFile"
            type="button"
            class="text-button"
            @click="removeFile"
          >
            改用文本框
          </button>
        </div>

        <p class="hint">
          解码同时兼容原始 Base64、URL 编码 Base64 和 Base64URL；空白与换行会自动忽略。
        </p>

        <div class="actions">
          <button
            type="button"
            class="button button-primary"
            :disabled="processing"
            @click="run('decode')"
          >
            解码
          </button>
          <button
            type="button"
            class="button button-secondary"
            :disabled="processing"
            @click="run('encode')"
          >
            编码 + URL 转义
          </button>
          <button
            v-if="processing"
            type="button"
            class="button button-danger"
            @click="cancel"
          >
            取消
          </button>
          <button type="button" class="button button-ghost" @click="clearAll">
            清空
          </button>
        </div>
      </article>

      <article class="panel panel-output">
        <div class="panel-heading">
          <div>
            <span class="panel-kicker">02 / OUTPUT</span>
            <h2>结果</h2>
          </div>
          <span class="measure">{{ outputSummary }}</span>
        </div>

        <div class="status-row" :class="`status-${statusKind}`" aria-live="polite">
          <span>{{ stage }}</span>
          <strong v-if="processing">{{ progress }}%</strong>
        </div>
        <div v-if="processing" class="progress-track" aria-hidden="true">
          <span :style="{ width: `${progress}%` }" />
        </div>

        <textarea
          class="text-area output-area"
          :value="outputText"
          readonly
          spellcheck="false"
          placeholder="转换结果会显示在这里"
        />

        <p v-if="resultIsPreview" class="large-result-notice">
          结果超过 {{ formatBytes(INLINE_RESULT_LIMIT) }}，当前仅显示开头预览；完整内容仍可复制或下载。
        </p>

        <div class="actions output-actions">
          <button
            type="button"
            class="button button-secondary"
            :disabled="!outputBlob"
            @click="copyResult"
          >
            {{ copyLabel }}
          </button>
          <button
            v-if="resultIsPreview"
            type="button"
            class="button button-ghost"
            @click="showFullResult"
          >
            显示完整结果
          </button>
          <a
            class="button button-primary"
            :class="{ disabled: !downloadUrl }"
            :href="downloadUrl || undefined"
            :download="downloadName"
          >
            下载完整结果
          </a>
        </div>
      </article>
    </section>

    <section class="feature-strip" aria-label="处理特性">
      <div>
        <strong>Web Worker</strong>
        <span>转换不阻塞页面交互</span>
      </div>
      <div>
        <strong>分块转换</strong>
        <span>不再展开超大字节数组</span>
      </div>
      <div>
        <strong>本地处理</strong>
        <span>输入内容不会上传服务器</span>
      </div>
    </section>
  </div>
</template>
