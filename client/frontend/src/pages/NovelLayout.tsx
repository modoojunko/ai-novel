import { Outlet } from "react-router-dom";
import AuthGuard from "@/components/auth/AuthGuard";

export default function NovelLayout() {
  return (
    <AuthGuard>
      <Outlet />
    </AuthGuard>
  );
}
