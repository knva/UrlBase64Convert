import VueDevUI from 'vue-devui';
import 'vue-devui/style.css';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueDevUI);
});