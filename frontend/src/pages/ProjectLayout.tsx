import { Outlet } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";
import ProjectNav from "@/components/project/ProjectNav";

export default function ProjectLayout() {
  return (
    <AuthGuard>
      <ProjectNav />
      <div className="p-6">
        <Outlet />
      </div>
    </AuthGuard>
  );
}
