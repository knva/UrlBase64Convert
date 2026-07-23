const baseURL = process.env.NUXT_APP_BASE_URL || "/";

export default defineNuxtConfig({
  app: {
    baseURL,
    head: {
      title: "URL Base64 大文本转换与 JSON 查看工具",
      htmlAttrs: {
        lang: "zh-CN",
      },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content:
            "在浏览器本地分块编码和解码 URL/Base64，支持 20MB 以上大文本和高性能 JSON 搜索。",
        },
        { name: "theme-color", content: "#07111f" },
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: `${baseURL}favicon.ico` },
      ],
    },
  },
  css: ["~/assets/css/index.css"],
  devtools: {
    enabled: false,
  },
  typescript: {
    strict: true,
    shim: false,
  },
  hooks: {
    "build:manifest": (manifest) => {
      // JSON 查看器由用户点击后再加载，不让 SSR 将它加入首屏 prefetch。
      for (const resource of Object.values(manifest)) {
        resource.dynamicImports = resource.dynamicImports?.filter(
          (dependency) => !dependency.includes("JsonViewer.client.vue"),
        );
      }
    },
  },
});
