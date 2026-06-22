import { Link, useLocation } from "react-router-dom";
import { isLoggedIn } from "../lib/auth";
import { BookOpen } from "lucide-react";
import ThemeToggle from "../components/novel/ThemeToggle";

export default function Navbar() {
  const location = useLocation();
  const loggedIn = isLoggedIn();

  // Landing page has its own full-page layout
  if (location.pathname === "/") return null;

  return (
    <div className="navbar bg-base-200/80 backdrop-blur-sm border-b border-base-300 px-4 lg:px-8">
      <div className="navbar-start">
        <Link to="/" className="btn btn-ghost text-xl font-display gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          爱小说
        </Link>
      </div>
      <div className="navbar-end gap-2">
        <ThemeToggle />
        {loggedIn ? (
          <>
            <Link to="/dashboard" className="btn btn-ghost btn-sm">
              我的小说
            </Link>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                localStorage.removeItem("token");
                window.location.hash = "#/";
              }}
            >
              退出
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">
              登录
            </Link>
            <Link to="/register" className="btn btn-primary btn-sm">
              注册
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
