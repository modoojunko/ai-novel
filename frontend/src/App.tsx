import { Routes, Route } from "react-router-dom";
import ClientShell from "@/components/ClientShell";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ProjectLayout from "@/pages/ProjectLayout";
import ProjectRedirectPage from "@/pages/ProjectRedirectPage";
import SettingsHubPage from "@/pages/SettingsHubPage";
import WorldSettingsPage from "@/pages/WorldSettingsPage";
import StyleSettingsPage from "@/pages/StyleSettingsPage";
import AntiAiSettingsPage from "@/pages/AntiAiSettingsPage";
import HooksPage from "@/pages/HooksPage";
import CharactersListPage from "@/pages/CharactersListPage";
import CharacterEditorPage from "@/pages/CharacterEditorPage";
import OutlinePage from "@/pages/OutlinePage";
import PromptsPage from "@/pages/PromptsPage";
import WritePage from "@/pages/WritePage";
import ArchivesPage from "@/pages/ArchivesPage";
import ThreadsPage from "@/pages/ThreadsPage";

export default function App() {
  return (
    <ClientShell>
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/project/:slug" element={<ProjectLayout />}>
            <Route index element={<ProjectRedirectPage />} />
            <Route path="settings" element={<SettingsHubPage />} />
            <Route path="settings/world" element={<WorldSettingsPage />} />
            <Route path="settings/style" element={<StyleSettingsPage />} />
            <Route path="settings/anti-ai" element={<AntiAiSettingsPage />} />
            <Route path="settings/hooks" element={<HooksPage />} />
            <Route path="settings/characters" element={<CharactersListPage />} />
            <Route path="settings/characters/:name" element={<CharacterEditorPage />} />
            <Route path="outline" element={<OutlinePage />} />
            <Route path="prompts" element={<PromptsPage />} />
            <Route path="write" element={<WritePage />} />
            <Route path="archives" element={<ArchivesPage />} />
            <Route path="threads" element={<ThreadsPage />} />
          </Route>
        </Routes>
      </div>
      <Footer />
    </ClientShell>
  );
}
