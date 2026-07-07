import { Link, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, FolderOpen, Receipt, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { path: "/admin", label: "仪表盘", icon: LayoutDashboard },
  { path: "/admin/users", label: "用户管理", icon: Users },
  { path: "/admin/projects", label: "项目浏览", icon: FolderOpen },
  { path: "/admin/tokens", label: "Token 账单", icon: Receipt },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-base-200/50">
      {/* Sidebar */}
      <aside className="w-56 bg-base-100 border-r border-base-300/60 flex flex-col">
        <div className="p-4 border-b border-base-300/40">
          <Link to="/admin" className="text-lg font-display text-primary">爱小说 · 管理</Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-base-content/60 hover:bg-base-200/80 hover:text-base-content"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-base-300/40">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/40 hover:text-base-content transition-colors">
            <LogOut className="w-4 h-4" />
            返回前台
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
