import { Outlet } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";

export default function ProjectLayout() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
