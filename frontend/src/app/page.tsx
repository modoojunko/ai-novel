import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gradient-to-b from-white to-gray-50">
      <h1 className="text-5xl font-bold tracking-tight">Novel SaaS</h1>
      <p className="text-lg text-gray-500 max-w-md text-center">
        AI-assisted novel writing — from world-building to final prose, guided by a 6-phase workflow.
      </p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/register"
          className="px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
