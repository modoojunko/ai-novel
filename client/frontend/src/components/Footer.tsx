import { useLocation } from "react-router-dom";

/** 页脚（list.html pagefoot 原样）。Landing page has its own footer. */
export default function Footer() {
  const location = useLocation();
  if (location.pathname === "/") return null;

  return <footer className="pagefoot">© 2026 爱小说</footer>;
}
