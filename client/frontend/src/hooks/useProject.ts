import { useContext } from "react";
import {
  ProjectContext,
  type ProjectState,
} from "@/components/novel/license/ProjectShell";

const SAFE: ProjectState = {
  project: null,
  loading: false,
  error: null,
  updateProject: () => {},
};

/** 取当前项目；未包 ProjectShell 时返回安全默认值，不抛。 */
export function useProject(): ProjectState {
  return useContext(ProjectContext) ?? SAFE;
}
