<script setup lang="ts">
import zhCn from "element-plus/es/locale/lang/zh-cn";

import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";

const { $windowHeight } = useNuxtApp();

const encodeText = ref("");
const decodeText = ref("");
//json结构体
const jsonData = computed(() => {
  try {
    return JSON.parse(decodeText.value);
  } catch (e) {
    return {};
  }
});

const pageHeight = computed(() => {
  if (process.client) {
    const { height, width } = window.screen;
    return height;
  }
});
// Base64 编码
const base64Encode = (str: string | undefined) => {
  const utf8Bytes = new TextEncoder().encode(str);
  return btoa(String.fromCharCode(...utf8Bytes));
};

// Base64 解码
const base64Decode = (str: string) => {
  const binaryString = atob(str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};
const decode = () => {
  //先urldecode然后base64
  decodeText.value = base64Decode(decodeURIComponent(encodeText.value));
};
const encode = () => {
  //先base64然后urlencode

  decodeText.value = encodeURIComponent(base64Encode(encodeText.value));
};
const clear = () => {
  encodeText.value = "";
  decodeText.value = "";
};
const copyText = (text: string) => {
  const input = document.createElement("input");
  input.setAttribute("readonly", "readonly");
  input.setAttribute("value", text);
  document.body.appendChild(input);
  input.select();
  if (document.execCommand("copy")) {
    document.execCommand("copy");
    console.log("复制成功");
    ElMessage({
      message: "copy success",
      type: "success",
    });
  }
  document.body.removeChild(input);
};
</script>


<template>
  <div>
    <!--标题，解密工具-->
    <!--提示用户输入的文本-->

    <div class="container">
      <div class="left-column">
        <h1>Decode Tool</h1>
        <div class="input-group">
          <el-input
            v-model="encodeText"
            type="textarea"
            class="input-textarea"
            placeholder="输入"
            :autosize="{ minRows: 10, maxRows: 10 }"
          />
        </div>
        <div class="buttons">
          <!--解密-->
          <el-button type="primary" @click="decode">Decode</el-button>
          <!--加密-->
          <el-button type="primary" @click="encode">Encode</el-button>
          <!--清空-->
          <el-button @click="clear">Clear</el-button>
          <!--复制-->
          <el-button type="primary" @click="copyText(decodeText)"
            >Copy</el-button
          >
        </div>
        <div class="input-group">
          <el-input
            v-model="decodeText"
            type="textarea"
            class="input-textarea"
            placeholder="输出"
            :autosize="{ minRows: 10, maxRows: 10 }"
          />
        </div>
      </div>
      <vue-json-pretty
        :data="jsonData"
        :showIcon="true"
        :virtual="true"
        class="json-pretty"
        :height="pageHeight"
      />
    </div>
  </div>
</template>
<style scoped>
.buttons {
  margin-top: 20px;
  margin-bottom: 20px;
}
.container {
  display: flex;
  justify-content: space-between;
}

.left-column {
  display: flex;
  flex-direction: column;
  width: 30%;
}

.input-textarea {
  width: 100%;
  margin-bottom: 10px; /* Adjust spacing between textareas */
}
.input-group {
  flex: 1;
  margin-bottom: 10px; /* Adjust spacing as needed */
}

.json-pretty {
  width: 70%;
  height: 100vh; /* Adjust height as needed */
}
</style>
