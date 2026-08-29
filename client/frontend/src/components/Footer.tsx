import { useLocation } from "react-router-dom";

/** 页脚（list.html pagefoot 原样）。工作台整屏沉浸无页脚。 */
export default function Footer() {
  const location = useLocation();
  if (location.pathname.startsWith("/novel/")) return null;

  return <footer className="pagefoot">© 2026 爱小说</footer>;
}
