"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative">
      {/* Lamp glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.72 0.15 72 / 8%), transparent 60%)",
        }}
      />
      <Card className="relative z-10 sm:max-w-md w-full mx-4 border-border/50">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-serif-heading)]">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              No account?{" "}
              <Link href="/register" className="underline hover:text-primary transition-colors">
                Register
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
