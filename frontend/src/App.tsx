import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ClientShell from "@/components/ClientShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectLayout from "@/pages/ProjectLayout";
import NovelPage from "@/pages/NovelPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminUserDetailPage from "@/pages/admin/AdminUserDetailPage";
import AdminProjectsPage from "@/pages/admin/AdminProjectsPage";
import AdminTokenLogsPage from "@/pages/admin/AdminTokenLogsPage";

export default function App() {
  const location = useLocation();

  // Admin routes — standalone layout, no ClientShell/Navbar/Footer
  if (location.pathname.startsWith("/admin")) {
    return (
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="projects" element={<AdminProjectsPage />} />
          <Route path="tokens" element={<AdminTokenLogsPage />} />
        </Route>
      </Routes>
    );
  }

  return (
    <ClientShell>
      <Navbar />
      <div className="flex-1 page-enter" key={location.pathname}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/project/:slug" element={<ProjectLayout />}>
            <Route index element={<NovelPage />} />
            <Route path="settings" element={<Navigate to=".." replace />} />
            <Route path="settings/world" element={<Navigate to=".." replace />} />
            <Route path="settings/style" element={<Navigate to=".." replace />} />
            <Route path="settings/anti-ai" element={<Navigate to=".." replace />} />
            <Route path="settings/hooks" element={<Navigate to=".." replace />} />
            <Route path="settings/characters" element={<Navigate to=".." replace />} />
            <Route path="settings/characters/:name" element={<Navigate to=".." replace />} />
            <Route path="outline" element={<Navigate to=".." replace />} />
            <Route path="prompts" element={<Navigate to=".." replace />} />
            <Route path="write" element={<Navigate to=".." replace />} />
            <Route path="archives" element={<Navigate to=".." replace />} />
            <Route path="threads" element={<Navigate to=".." replace />} />
          </Route>
        </Routes>
      </div>
      <Footer />
    </ClientShell>
  );
}
