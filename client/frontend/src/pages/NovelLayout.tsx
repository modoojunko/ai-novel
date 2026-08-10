import { Outlet } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import { LicenseProvider } from "@/components/novel/license/LicenseProvider";
import { ProjectShell } from "@/components/novel/license/ProjectShell";

export default function NovelLayout() {
  return (
    <AuthGuard>
      <LicenseProvider>
        <ProjectShell>
          <Outlet />
        </ProjectShell>
      </LicenseProvider>
    </AuthGuard>
  );
}
