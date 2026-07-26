import { useEffect } from "react";
import { Toaster, toast } from "@/lib/toast";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      toast.error(e.reason?.message || String(e.reason));
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-base-100 text-base-content">
      <div className="flex-1 flex flex-col">{children}</div>
      <Toaster />
    </div>
  );
}
