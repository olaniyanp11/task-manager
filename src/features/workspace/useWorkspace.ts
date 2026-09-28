"use client";

import { useEffect, useState } from "react";
import { EMPTY_WORKSPACE, type CollectionName, type Note, type NoteInput, type Project, type ProjectInput, type Task, type TaskInput, type WorkspaceData } from "./model";
import { workspaceService } from "./service";

export function useWorkspace() {
  const [data, setData] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    workspaceService.load()
      .then((workspace) => { if (mounted) setData(workspace); })
      .catch(() => { if (mounted) setError("Your workspace could not be opened. Check that browser storage is available and try again."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function mutate<T>(operation: () => Promise<T>, apply: (value: T) => void): Promise<boolean> {
    setError("");
    try {
      const value = await operation();
      apply(value);
      return true;
    } catch {
      setError("That change could not be saved. Please try again.");
      return false;
    }
  }

  function saveTask(input: TaskInput, existing?: Task) {
    return mutate(() => workspaceService.saveTask(input, existing), (task) => {
      setData((current) => ({ ...current, tasks: [task, ...current.tasks.filter((item) => item.id !== task.id)] }));
    });
  }

  function saveNote(input: NoteInput, existing?: Note) {
    return mutate(() => workspaceService.saveNote(input, existing), (note) => {
      setData((current) => ({ ...current, notes: [note, ...current.notes.filter((item) => item.id !== note.id)] }));
    });
  }

  function saveProject(input: ProjectInput, existing?: Project) {
    return mutate(() => workspaceService.saveProject(input, existing), (project) => {
      setData((current) => ({ ...current, projects: [project, ...current.projects.filter((item) => item.id !== project.id)] }));
    });
  }

  function updateTask(id: string, patch: Partial<Pick<Task, "completed" | "archived">>) {
    return mutate(() => workspaceService.updateTask(id, patch), (updated) => {
      setData((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? updated : task) }));
    });
  }

  function deleteEntity(store: CollectionName, id: string) {
    return mutate(() => workspaceService.delete(store, id), () => {
      setData((current) => {
        if (store === "projects") return {
          ...current,
          projects: current.projects.filter((project) => project.id !== id),
          tasks: current.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
          notes: current.notes.map((note) => note.projectId === id ? { ...note, projectId: null } : note),
        };
        if (store === "tasks") return { ...current, tasks: current.tasks.filter((task) => task.id !== id) };
        return { ...current, notes: current.notes.filter((note) => note.id !== id) };
      });
    });
  }

  return { ...data, loading, error, saveTask, saveNote, saveProject, updateTask, deleteEntity, clearError: () => setError("") };
}