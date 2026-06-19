import { createApp } from "vue";
import "element-plus/dist/index.css";
// @mlightcad/cad-viewer no expone su CSS en el campo "exports", por lo que
// se importa por ruta relativa al filesystem (evita la resolución de exports).
import "../node_modules/@mlightcad/cad-viewer/dist/index.css";
import { i18n } from "@mlightcad/cad-viewer";
import App from "./App.vue";
import "./styles/main.css";

const app = createApp(App);
app.use(i18n);
app.mount("#app");
