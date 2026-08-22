import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
// 设计系统在 tailwind/daisyUI 之后加载（覆盖共享类）；按屏追加在 base 之后
import "./design/base.css";
import "./design/list.css";
import "./design/model-config.css";
import "./design/book.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
