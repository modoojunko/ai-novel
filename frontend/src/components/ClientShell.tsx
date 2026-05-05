"use client";

import { useEffect } from "react";
import { Toaster, toast } from "@/lib/toast";

export function ClientShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg =
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason || "Unknown error");
      toast.error(msg);
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
