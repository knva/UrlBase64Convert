<script setup lang="ts">
import zhCn from "element-plus/es/locale/lang/zh-cn";

const encodeText = ref("");
const decodeText = ref("");
const decode = () => {
  //先urldecode然后base64
  decodeText.value = atob(decodeURIComponent(encodeText.value));
};
const encode = () => {
  //先base64然后urlencode
  encodeText.value = encodeURIComponent(btoa(decodeText.value));
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
    <h1>Decode Tool</h1>
    <!--提示用户输入的文本-->

    <el-input
      v-model="encodeText"
      style="width: 480px"
      :rows="20"
      type="textarea"
      placeholder="输入加密文本"
    />

    <el-divider direction="vertical" />
    <el-input
      v-model="decodeText"
      style="width: 480px"
      :rows="20"
      type="textarea"
      placeholder="解密内容"
    />
    <br />
    <div class="buttons">
      <!--解密-->
      <el-button type="primary" @click="decode">Decode</el-button>
      <!--加密-->
      <el-button type="primary" @click="encode">Encode</el-button>
      <!--清空-->
      <el-button @click="clear">Clear</el-button>
      <!--复制-->
      <el-button type="primary" @click="copyText(decodeText)">Copy</el-button>
    </div>
  </div>
</template>
<style scoped>
.buttons {
  margin-top: 20px;
}
</style>
