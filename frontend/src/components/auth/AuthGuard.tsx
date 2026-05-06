"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => isLoggedIn());
  const router = useRouter();

  useEffect(() => {
    if (!ok) {
      router.push("/login");
    }
  }, [ok, router]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }
  return <>{children}</>;
}
