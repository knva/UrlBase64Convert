<script setup lang="ts">
import { json } from "@codemirror/lang-json";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  syntaxHighlighting,
} from "@codemirror/language";
import {
  highlightSelectionMatches,
  openSearchPanel,
  search,
  searchKeymap,
} from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";

const props = defineProps<{
  content: string;
  formatted: boolean;
  size: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

const editorHost = ref<HTMLDivElement | null>(null);
const lineCount = ref(0);
let editorView: EditorView | null = null;

const sizeLabel = computed(() => formatBytes(props.size));

const viewerTheme = EditorView.theme(
  {
    "&": {
      height: "min(72vh, 760px)",
      color: "#dce9f5",
      backgroundColor: "#050e19",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      lineHeight: "1.55",
      overflow: "auto",
    },
    ".cm-content": {
      caretColor: "transparent",
      padding: "12px 0 30px",
    },
    ".cm-gutters": {
      color: "#577087",
      backgroundColor: "#07121f",
      borderRight: "1px solid rgba(147, 175, 201, 0.12)",
    },
    ".cm-activeLineGutter": {
      color: "#8ee7cd",
      backgroundColor: "rgba(93, 228, 189, 0.06)",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(83, 139, 255, 0.34)",
    },
    ".cm-searchMatch": {
      outline: "1px solid rgba(255, 199, 94, 0.85)",
      backgroundColor: "rgba(255, 199, 94, 0.24)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(93, 228, 189, 0.35)",
    },
    ".cm-panels": {
      color: "#dce9f5",
      backgroundColor: "#0b1a2a",
    },
    ".cm-panels.cm-panels-top": {
      borderBottom: "1px solid rgba(147, 175, 201, 0.18)",
    },
    ".cm-panel.cm-search": {
      padding: "10px 12px",
    },
    ".cm-panel.cm-search input": {
      minHeight: "30px",
      border: "1px solid rgba(147, 175, 201, 0.28)",
      borderRadius: "6px",
      outline: "none",
      color: "#e8f0f8",
      backgroundColor: "#050e19",
    },
    ".cm-panel.cm-search input[name='search']": {
      width: "min(360px, 38vw)",
    },
    ".cm-panel.cm-search button": {
      minHeight: "30px",
      border: "1px solid rgba(147, 175, 201, 0.22)",
      borderRadius: "6px",
      color: "#c9d9e8",
      backgroundColor: "rgba(109, 155, 255, 0.12)",
    },
    ".cm-tooltip": {
      border: "1px solid rgba(147, 175, 201, 0.18)",
      color: "#dce9f5",
      backgroundColor: "#0b1a2a",
    },
  },
  { dark: true },
);

function createEditor(content: string) {
  if (!editorHost.value) return;
  const state = EditorState.create({
    doc: content,
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLineGutter(),
      drawSelection(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      json(),
      search({ top: true }),
      highlightSelectionMatches(),
      keymap.of([...searchKeymap, ...foldKeymap]),
      EditorState.phrases.of({
        Find: "搜索",
        Replace: "替换",
        next: "下一个",
        previous: "上一个",
        all: "全部",
        "match case": "区分大小写",
        regexp: "正则表达式",
        "by word": "全词匹配",
        replace: "替换",
        "replace all": "全部替换",
        close: "关闭",
      }),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({
        "aria-label": "JSON 内容",
        "data-testid": "json-editor-content",
      }),
      viewerTheme,
    ],
  });
  editorView = new EditorView({ state, parent: editorHost.value });
  lineCount.value = state.doc.lines;
}

function openDocumentSearch() {
  if (!editorView) return;
  openSearchPanel(editorView);
  editorView.focus();
}

function replaceContent(content: string) {
  if (!editorView) return;
  editorView.dispatch({
    changes: { from: 0, to: editorView.state.doc.length, insert: content },
  });
  lineCount.value = editorView.state.doc.lines;
}

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

watch(
  () => props.content,
  (content: string) => replaceContent(content),
);

onMounted(() => createEditor(props.content));

onBeforeUnmount(() => {
  editorView?.destroy();
  editorView = null;
});
</script>

<template>
  <section class="json-viewer-panel" aria-label="JSON 高性能视图">
    <header class="json-viewer-heading">
      <div>
        <span class="panel-kicker">03 / JSON VIEW</span>
        <h2>JSON 高性能视图</h2>
        <p>
          CodeMirror 6 仅渲染可见区域；可使用搜索面板定位键名或值，并支持 JSON 折叠。
        </p>
      </div>
      <div class="json-viewer-tools">
        <span class="json-document-meta">
          {{ sizeLabel }} · {{ lineCount.toLocaleString() }} 行 ·
          {{ formatted ? "已格式化" : "原始格式" }}
        </span>
        <button
          type="button"
          class="button button-secondary"
          data-testid="json-search-button"
          @click="openDocumentSearch"
        >
          搜索（Ctrl/⌘ F）
        </button>
        <button
          type="button"
          class="button button-ghost"
          data-testid="json-close-button"
          @click="emit('close')"
        >
          关闭 JSON
        </button>
      </div>
    </header>
    <div ref="editorHost" class="json-editor-host" data-testid="json-editor" />
  </section>
</template>

<style scoped>
.json-viewer-panel {
  margin-top: 18px;
  padding: 24px;
  border: 1px solid rgba(139, 167, 194, 0.16);
  border-radius: 18px;
  background: rgba(8, 20, 34, 0.94);
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.2);
}

.json-viewer-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 17px;
}

.json-viewer-heading h2 {
  margin: 5px 0 7px;
  font-size: 1.45rem;
  letter-spacing: -0.025em;
}

.json-viewer-heading p {
  max-width: 720px;
  margin: 0;
  color: #71879b;
  font-size: 0.78rem;
  line-height: 1.55;
}

.json-viewer-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
}

.json-document-meta {
  width: 100%;
  color: #8da1b5;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.76rem;
  text-align: right;
}

.json-editor-host {
  overflow: hidden;
  border: 1px solid rgba(147, 175, 201, 0.18);
  border-radius: 12px;
  background: #050e19;
}

:deep(.cm-editor.cm-focused) {
  outline: 1px solid rgba(93, 228, 189, 0.55);
}

@media (max-width: 900px) {
  .json-viewer-heading {
    flex-direction: column;
  }

  .json-viewer-tools {
    width: 100%;
    justify-content: flex-start;
  }

  .json-document-meta {
    text-align: left;
  }
}

@media (max-width: 620px) {
  .json-viewer-panel {
    padding: 17px;
    border-radius: 14px;
  }
}
</style>
