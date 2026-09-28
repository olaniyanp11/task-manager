import type { CollectionName, Note, Project, Task, WorkspaceData } from "./model";

const DATABASE_NAME = "fieldnotes-workspace";
const DATABASE_VERSION = 1;
const STORES: CollectionName[] = ["tasks", "notes", "projects"];

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The local database request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("The local database transaction was aborted."));
    transaction.onerror = () => reject(transaction.error ?? new Error("The local database transaction failed."));
  });
}

function seedData(): WorkspaceData {
  const now = new Date().toISOString();
  const localDate = new Date();
  const dateAtOffset = (offset: number) => {
    const date = new Date(localDate);
    date.setDate(date.getDate() + offset);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  const personalId = "seed-personal";
  const workId = "seed-work";
  const ideasId = "seed-ideas";

  return {
    projects: [
      { id: personalId, name: "Personal", description: "Small things that make life feel considered.", createdAt: now, updatedAt: now },
      { id: workId, name: "Studio work", description: "The thoughtful work in progress.", createdAt: now, updatedAt: now },
      { id: ideasId, name: "Field notes", description: "Loose threads worth following.", createdAt: now, updatedAt: now },
    ],
    tasks: [
      { id: "seed-task-week", title: "Send the studio proposal", description: "Give the scope one final read before it goes out.", projectId: workId, dueDate: dateAtOffset(-1), completed: false, archived: false, createdAt: now, updatedAt: now },
      { id: "seed-task-read", title: "Prepare the client review", description: "Pull together the latest screens and open questions.", projectId: workId, dueDate: dateAtOffset(0), completed: false, archived: false, createdAt: now, updatedAt: now },
      { id: "seed-task-review", title: "Book a table for Friday", description: "Somewhere quiet enough to catch up properly.", projectId: personalId, dueDate: dateAtOffset(1), completed: false, archived: false, createdAt: now, updatedAt: now },
      { id: "seed-task-priority", title: "Share the first concept draft", description: "Protect a focused block for this.", projectId: workId, dueDate: dateAtOffset(0), completed: true, archived: false, createdAt: now, updatedAt: now },
      { id: "seed-task-idea", title: "Order a new notebook", description: "A small fresh start for the next project.", projectId: personalId, dueDate: dateAtOffset(6), completed: false, archived: false, createdAt: now, updatedAt: now },
    ],
    notes: [
      { id: "seed-note-welcome", title: "Welcome to your workspace", content: "Use this space to keep track of things you need to do, things you need to remember, and projects you are working on.\n\nStart small. Add a task, leave yourself a note, and let this workspace grow with you.", projectId: null, createdAt: now, updatedAt: now },
      { id: "seed-note-ideas", title: "Project ideas", content: "A place for the ideas that are not ready to become plans yet.\n\nWhat would be useful to make? What would be fun to learn?", projectId: ideasId, createdAt: now, updatedAt: now },
      { id: "seed-note-meeting", title: "Meeting notes", content: "Decisions\n- Keep the first version focused\n- Share a draft before polishing\n\nNext: gather feedback from the team", projectId: workId, createdAt: now, updatedAt: now },
    ],
  };
}

class IndexedDbWorkspaceRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("This browser does not support local workspace storage."));
    }

    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          for (const store of STORES) {
            if (!request.result.objectStoreNames.contains(store)) {
              request.result.createObjectStore(store, { keyPath: "id" });
            }
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open the local workspace database."));
        request.onblocked = () => reject(new Error("The local workspace database is blocked by another open tab."));
      });
    }

    return this.databasePromise;
  }

  async getAll(): Promise<WorkspaceData> {
    const database = await this.open();
    const transaction = database.transaction(STORES, "readwrite");
    const [tasks, notes, projects] = await Promise.all([
      requestResult<Task[]>(transaction.objectStore("tasks").getAll()),
      requestResult<Note[]>(transaction.objectStore("notes").getAll()),
      requestResult<Project[]>(transaction.objectStore("projects").getAll()),
    ]);
    const dateOffsets: Record<string, number> = {
      "seed-task-week": -1,
      "seed-task-read": 0,
      "seed-task-review": 1,
      "seed-task-priority": 0,
      "seed-task-idea": 6,
    };
    const today = new Date();
    const tasksWithDates = tasks.map((task) => {
      const offset = dateOffsets[task.id];
      if (task.dueDate || offset === undefined) return task;
      const due = new Date(today);
      due.setDate(due.getDate() + offset);
      const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
      const migrated = { ...task, dueDate };
      transaction.objectStore("tasks").put(migrated);
      return migrated;
    });
    const data: WorkspaceData = { tasks: tasksWithDates, notes, projects };
    if (tasks.length === 0 && notes.length === 0 && projects.length === 0) {
      const seed = seedData();
      for (const store of STORES) {
        for (const item of seed[store]) transaction.objectStore(store).put(item);
      }
      await transactionDone(transaction);
      return seed;
    }
    await transactionDone(transaction);
    return data;
  }

  async put<T extends Task | Note | Project>(store: CollectionName, item: T): Promise<T> {
    const database = await this.open();
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).put(item);
    await transactionDone(transaction);
    return item;
  }

  async remove(store: CollectionName, id: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(store, "readwrite");
    transaction.objectStore(store).delete(id);
    await transactionDone(transaction);
  }

  async deleteProject(id: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(["projects", "tasks", "notes"], "readwrite");
    transaction.objectStore("projects").delete(id);
    for (const store of ["tasks", "notes"] as const) {
      const records = await requestResult<(Task | Note)[]>(transaction.objectStore(store).getAll());
      for (const record of records) {
        if (record.projectId === id) transaction.objectStore(store).put({ ...record, projectId: null, updatedAt: new Date().toISOString() });
      }
    }
    await transactionDone(transaction);
  }
}

export const workspaceRepository = new IndexedDbWorkspaceRepository();