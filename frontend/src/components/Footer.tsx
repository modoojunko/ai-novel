import { useLocation } from "react-router-dom";

export default function Footer() {
  const location = useLocation();

  // Landing page has its own footer
  if (location.pathname === "/") return null;

  return (
    <footer className="footer footer-center p-4 bg-base-200 text-base-content/40 text-xs border-t border-base-300">
      <p>夜深人静，笔墨纸砚 · 爱小说</p>
    </footer>
  );
}
