import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import ClientShell from "@/components/ClientShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import ApiKeyConfigPage from "@/pages/ApiKeyConfigPage";
import NovelListPage from "@/pages/NovelListPage";
import NovelLayout from "@/pages/NovelLayout";
import NovelWorkspace from "@/components/novel/NovelWorkspace";

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
            <Route index element={<NovelWorkspace />} />
          </Route>
        </Routes>
      </div>
      <Footer />
    </ClientShell>
  );
}
