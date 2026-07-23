const baseURL = process.env.NUXT_APP_BASE_URL || "/";

export default defineNuxtConfig({
  app: {
    baseURL,
    head: {
      title: "URL Base64 大文本转换工具",
      htmlAttrs: {
        lang: "zh-CN",
      },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "在浏览器本地分块编码和解码 URL/Base64，支持 20MB 以上大文本。",
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
});
