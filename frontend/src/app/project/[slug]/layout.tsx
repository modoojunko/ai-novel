import { AuthGuard } from "@/components/auth/AuthGuard";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <AuthGuard>
      <ProjectNav slug={slug} />
      <div className="p-6 page-enter">{children}</div>
    </AuthGuard>
  );
}
