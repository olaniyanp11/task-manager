export type EntityId = string;

export interface Task {
  id: EntityId;
  title: string;
  description: string;
  projectId: EntityId | null;
  dueDate?: string | null;
  completed: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: EntityId;
  title: string;
  content: string;
  projectId: EntityId | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: EntityId;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceData {
  tasks: Task[];
  notes: Note[];
  projects: Project[];
}

export type CollectionName = keyof WorkspaceData;
export type WorkspaceEntity = Task | Note | Project;

export type TaskInput = Pick<Task, "title" | "description" | "projectId"> & { dueDate?: string | null };
export type NoteInput = Pick<Note, "title" | "content" | "projectId">;
export type ProjectInput = Pick<Project, "name" | "description">;

export const EMPTY_WORKSPACE: WorkspaceData = { tasks: [], notes: [], projects: [] };

export function createId(): EntityId {
  return crypto.randomUUID();
}