import type { CollectionName, Note, Project, Task, WorkspaceData } from "./model";

const DATABASE_NAME = "fieldnotes-workspace";
const DATABASE_VERSION = 2;
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

class IndexedDbWorkspaceRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return Promise.reject(new Error("This browser does not support local workspace storage."));
    }

    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = (event) => {
          for (const store of STORES) {
            if (!request.result.objectStoreNames.contains(store)) {
              request.result.createObjectStore(store, { keyPath: "id" });
            }
          }
          if (event.oldVersion < 2) {
            const transaction = request.transaction;
            transaction?.objectStore("tasks").delete("seed-task-week");
            transaction?.objectStore("tasks").delete("seed-task-read");
            transaction?.objectStore("tasks").delete("seed-task-review");
            transaction?.objectStore("tasks").delete("seed-task-priority");
            transaction?.objectStore("tasks").delete("seed-task-idea");
            transaction?.objectStore("notes").delete("seed-note-welcome");
            transaction?.objectStore("notes").delete("seed-note-ideas");
            transaction?.objectStore("notes").delete("seed-note-meeting");
            transaction?.objectStore("projects").delete("seed-personal");
            transaction?.objectStore("projects").delete("seed-work");
            transaction?.objectStore("projects").delete("seed-ideas");
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
    const transaction = database.transaction(STORES, "readonly");
    const [tasks, notes, projects] = await Promise.all([
      requestResult<Task[]>(transaction.objectStore("tasks").getAll()),
      requestResult<Note[]>(transaction.objectStore("notes").getAll()),
      requestResult<Project[]>(transaction.objectStore("projects").getAll()),
    ]);
    await transactionDone(transaction);
    return { tasks, notes, projects };
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