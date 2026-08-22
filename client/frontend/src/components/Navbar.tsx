import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { isLoggedIn } from "../lib/auth";
import PrefsModal from "../components/PrefsModal";

/** 顶栏（list.html appbar 原样）：logo + 导航 + spacer + 设置。 */
export default function Navbar() {
  const location = useLocation();
  const loggedIn = isLoggedIn();
  const [showPrefs, setShowPrefs] = useState(false);

  // Landing page has its own full-page layout
  if (location.pathname === "/") return null;

  const on = (prefix: string) =>
    location.pathname === prefix || location.pathname.startsWith(prefix + "/") ? "on" : undefined;

  return (
    <header className="appbar">
      <Link className="logo" to="/novels">
        <span className="logo-mark">爱</span>爱小说
      </Link>
      <nav className="nav">
        <Link to="/novels" className={on("/novels")} aria-current={on("/novels") ? "page" : undefined}>
          我的作品
        </Link>
        <Link to="/config" className={on("/config")}>
          模型配置
        </Link>
      </nav>
      <span className="spacer" />
      {!loggedIn && (
        <Link className="btn btn-ghost btn-sm" to="/login">
          登录
        </Link>
      )}
      <button className="btn btn-ghost btn-sm" onClick={() => setShowPrefs(true)}>
        设置
      </button>
      <PrefsModal open={showPrefs} onClose={() => setShowPrefs(false)} />
    </header>
  );
}
