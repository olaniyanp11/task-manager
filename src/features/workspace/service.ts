import { createId, type CollectionName, type Note, type NoteInput, type Project, type ProjectInput, type Task, type TaskInput, type WorkspaceData } from "./model";
import { workspaceRepository } from "./repository";

function normalize(value: string): string {
  return value.trim();
}

function timestamp(): string {
  return new Date().toISOString();
}

export const workspaceService = {
  load: (): Promise<WorkspaceData> => workspaceRepository.getAll(),

  saveTask(input: TaskInput, existing?: Task): Promise<Task> {
    const now = timestamp();
    return workspaceRepository.put("tasks", {
      id: existing?.id ?? createId(), title: normalize(input.title), description: normalize(input.description),
      projectId: input.projectId, completed: existing?.completed ?? false, archived: existing?.archived ?? false,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    });
  },

  saveNote(input: NoteInput, existing?: Note): Promise<Note> {
    const now = timestamp();
    return workspaceRepository.put("notes", {
      id: existing?.id ?? createId(), title: normalize(input.title), content: input.content.trim(),
      projectId: input.projectId, createdAt: existing?.createdAt ?? now, updatedAt: now,
    });
  },

  saveProject(input: ProjectInput, existing?: Project): Promise<Project> {
    const now = timestamp();
    return workspaceRepository.put("projects", {
      id: existing?.id ?? createId(), name: normalize(input.name), description: normalize(input.description),
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    });
  },

  async updateTask(id: string, patch: Partial<Pick<Task, "completed" | "archived">>): Promise<Task> {
    const { tasks } = await workspaceRepository.getAll();
    const current = tasks.find((task) => task.id === id);
    if (!current) throw new Error("That task could not be found.");
    return workspaceRepository.put("tasks", { ...current, ...patch, updatedAt: timestamp() });
  },

  delete: (store: CollectionName, id: string): Promise<void> =>
    store === "projects" ? workspaceRepository.deleteProject(id) : workspaceRepository.remove(store, id),
};