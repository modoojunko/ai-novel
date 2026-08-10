import { createContext, useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api";

export interface ProjectState {
  project: Record<string, any> | null;
  loading: boolean;
  error: string | null;
  /** 局部更新 project（如书名改名后同步，004 新增） */
  updateProject: (patch: Record<string, any>) => void;
}

const ProjectContext = createContext<ProjectState | null>(null);

/** 项目壳：按路由 id 一次 GET /novels/{id}，Context 下发供 useWorkbench/NovelBar 等消费。 */
export function ProjectShell({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/novels/${id}`)
      .then((p) => {
        setProject(p);
        setError(null);
      })
      .catch(() => {
        setProject(null);
        setError("项目加载失败");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const updateProject = useCallback((patch: Record<string, any>) => {
    setProject((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return (
    <ProjectContext.Provider value={{ project, loading, error, updateProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export { ProjectContext };
