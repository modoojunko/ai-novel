import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import ClientShell from "@/components/ClientShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import ApiKeyConfigPage from "@/pages/ApiKeyConfigPage";
import NovelListPage from "@/pages/NovelListPage";
import NovelLayout from "@/pages/NovelLayout";
import NovelPage from "@/pages/NovelPage";

/** 301 过渡：旧路由 /project/:id → /novel/:id */
function RedirectToNovel() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={"/novel/" + id} replace />;
}

export default function App() {
  const location = useLocation();

  return (
    <ClientShell>
      <Navbar />
      <div className="flex-1 page-enter" key={location.pathname}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/config" element={<ApiKeyConfigPage />} />
          {/* 301 过渡（一个版本期后删除） */}
          <Route path="/books" element={<Navigate to="/novels" replace />} />
          <Route path="/project/:id" element={<RedirectToNovel />} />
          {/* 新路由 */}
          <Route path="/novels" element={<NovelListPage />} />
          <Route path="/novel/:id" element={<NovelLayout />}>
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
