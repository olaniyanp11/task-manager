"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowUpRight, Check, CheckCheck, ChevronDown,
  FileText, FolderKanban, House, ListTodo, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, StickyNote, X,
} from "lucide-react";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { CollectionName, Note, Project, Task } from "@/features/workspace/model";

type View = "home" | "tasks" | "notes" | "projects";
type Kind = "task" | "note" | "project";
type TaskFilter = "Active" | "Completed" | "Archived";

const navigation: { id: View; label: string; icon: typeof House }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "projects", label: "Projects", icon: FolderKanban },
];

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(date));
}

function cx(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

function dueLabel(dueDate?: string | null): string {
  if (!dueDate) return "No due date";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (dueDate < todayKey) return `Overdue · ${shortDate(`${dueDate}T12:00:00`)}`;
  if (dueDate === todayKey) return "Today";
  if (dueDate === tomorrowKey) return "Tomorrow";
  return shortDate(`${dueDate}T12:00:00`);
}

export default function WorkspacePage() {
  const workspace = useWorkspace();
  const [view, setView] = useState<View>("home");
  const [filter, setFilter] = useState<TaskFilter>("Active");
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [dialog, setDialog] = useState<{ kind: Kind; item?: Task | Note | Project } | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setQuickOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const projectById = useMemo(() => new Map(workspace.projects.map((project) => [project.id, project])), [workspace.projects]);
  const activeTasks = workspace.tasks.filter((task) => !task.archived && !task.completed);
  const completedTasks = workspace.tasks.filter((task) => !task.archived && task.completed);
  const selectedProjectData = workspace.projects.find((project) => project.id === selectedProject) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const searchTasks = normalizedQuery ? workspace.tasks.filter((task) => !task.archived && `${task.title} ${task.description}`.toLowerCase().includes(normalizedQuery)) : [];
  const searchNotes = normalizedQuery ? workspace.notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(normalizedQuery)) : [];
  const searchProjects = normalizedQuery ? workspace.projects.filter((project) => `${project.name} ${project.description}`.toLowerCase().includes(normalizedQuery)) : [];
  const hasSearchResults = searchTasks.length + searchNotes.length + searchProjects.length > 0;

  async function remove(store: CollectionName, id: string) {
    if (!window.confirm(`Delete this ${store === "projects" ? "project" : store === "tasks" ? "task" : "note"}?`)) return;
    const saved = await workspace.deleteEntity(store, id);
    if (saved) {
      setNotice("Deleted");
      if (store === "projects" && selectedProject === id) setSelectedProject(null);
    }
  }

  function openCreate(kind: Kind) {
    setQuickOpen(false);
    setDialog({ kind });
  }

  function openEdit(kind: Kind, item: Task | Note | Project) {
    setDialog({ kind, item });
  }

  function openProject(projectId: string) {
    setSelectedProject(projectId);
    setView("projects");
    setQuery("");
  }

  function chooseSearchResult(kind: Kind, item: Task | Note | Project) {
    setQuery("");
    if (kind === "project") openProject(item.id);
    else {
      setView(kind === "task" ? "tasks" : "notes");
      if (kind === "task") setFilter((item as Task).archived ? "Archived" : (item as Task).completed ? "Completed" : "Active");
      setDialog({ kind, item });
    }
  }

  const taskList = (tasks: Task[], compact = false) => (
    <div className={cx("task-list", compact && "task-list-compact")}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} project={task.projectId ? projectById.get(task.projectId) : undefined}
          projectColorIndex={task.projectId ? workspace.projects.findIndex((project) => project.id === task.projectId) : 0} minimal={compact}
          onToggle={() => workspace.updateTask(task.id, { completed: !task.completed })}
          onEdit={() => openEdit("task", task)} onArchive={() => workspace.updateTask(task.id, { archived: !task.archived })}
          onDelete={() => remove("tasks", task.id)} />
      ))}
      {!tasks.length && <EmptyState icon={<CheckCheck size={18} />} title="Nothing in this view" detail="A clear space for what comes next." />}
    </div>
  );

  const noteList = (notes: Note[]) => (
    <div className="note-grid">
      {notes.map((note) => (
        <article className="note-card" key={note.id}>
          <button className="note-card-main" onClick={() => openEdit("note", note)} aria-label={`Edit ${note.title}`}>
            <span className="note-mark"><FileText size={15} /></span>
            <h3>{note.title}</h3>
            <p>{note.content || "No content yet."}</p>
            <span className="note-meta">{note.projectId ? projectById.get(note.projectId)?.name : "Unsorted"}<i />{shortDate(note.updatedAt)}</span>
          </button>
          <button className="icon-button note-delete" title="Delete note" aria-label={`Delete ${note.title}`} onClick={() => remove("notes", note.id)}><X size={15} /></button>
        </article>
      ))}
      {!notes.length && <EmptyState icon={<StickyNote size={18} />} title="No notes here yet" detail="Keep the useful things close by." action="Add a note" onAction={() => openCreate("note")} />}
    </div>
  );

  function renderHome() {
    const todaysTasks = [...activeTasks].sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"));
    return <>
      <section className="home-hero">
        <h1>{activeTasks.length} tasks left <em>today</em></h1>
        <p>Make a little room for the work that moves things forward.</p>
      </section>
      <section className="home-task-section" aria-label="Tasks to do">
        {todaysTasks.length ? taskList(todaysTasks, true) : <EmptyState icon={<CheckCheck size={18} />} title="You're all caught up" detail="Add a task when something comes to mind." action="Add a task" onAction={() => openCreate("task")} />}
        <button className="home-add-button primary-button" onClick={() => openCreate("task")}><Plus size={16} /> Add a task</button>
      </section>
    </>;
  }

  function renderTasks() {
    const filteredTasks = workspace.tasks.filter((task) => filter === "Archived" ? task.archived : filter === "Completed" ? task.completed && !task.archived : !task.completed && !task.archived);
    return <>
      <PageHeading eyebrow="A CLEAR NEXT STEP" title="Tasks" detail="Keep the moving parts somewhere you can see them." action={<button className="primary-button" onClick={() => openCreate("task")}><Plus size={16} /> New task</button>} />
      <div className="filter-bar" role="tablist" aria-label="Filter tasks">{(["Active", "Completed", "Archived"] as TaskFilter[]).map((item) => <button role="tab" aria-selected={filter === item} className={cx("filter-tab", filter === item && "filter-active")} key={item} onClick={() => setFilter(item)}>{item}<span>{item === "Active" ? activeTasks.length : item === "Completed" ? completedTasks.length : workspace.tasks.filter((task) => task.archived).length}</span></button>)}</div>
      {taskList(filteredTasks)}
    </>;
  }

  function renderNotes() {
    return <>
      <PageHeading eyebrow="THOUGHTS, KEPT CLOSE" title="Notes" detail="A home for the things you don't want to lose." action={<button className="primary-button" onClick={() => openCreate("note")}><Plus size={16} /> New note</button>} />
      {noteList([...workspace.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))}
    </>;
  }

  function renderProjects() {
    if (selectedProjectData) {
      const projectTasks = workspace.tasks.filter((task) => task.projectId === selectedProjectData.id && !task.archived);
      const projectNotes = workspace.notes.filter((note) => note.projectId === selectedProjectData.id);
      return <>
        <button className="back-link" onClick={() => setSelectedProject(null)}><ArrowDownRight size={15} /> All projects</button>
        <PageHeading eyebrow="PROJECT SPACE" title={selectedProjectData.name} detail={selectedProjectData.description || "A place for related tasks and notes."} action={<button className="secondary-button" onClick={() => openEdit("project", selectedProjectData)}><Settings2 size={15} /> Edit project</button>} />
        <section className="project-detail-section"><div className="section-heading"><div><span className="section-kicker">MAKE IT HAPPEN</span><h2>Tasks <span className="heading-count">{projectTasks.length}</span></h2></div><button className="icon-button" title="Add task to project" aria-label="Add task to project" onClick={() => setDialog({ kind: "task", item: { projectId: selectedProjectData.id } as Task })}><Plus size={17} /></button></div>
          {taskList(projectTasks)}{!projectTasks.length && <EmptyState icon={<ListTodo size={18} />} title="No tasks in this project" detail="Keep the next step close." action="Add a task" onAction={() => setDialog({ kind: "task", item: { projectId: selectedProjectData.id } as Task })} />}</section>
        <section className="project-detail-section"><div className="section-heading"><div><span className="section-kicker">IDEAS & CONTEXT</span><h2>Notes <span className="heading-count">{projectNotes.length}</span></h2></div><button className="icon-button" title="Add note to project" aria-label="Add note to project" onClick={() => setDialog({ kind: "note", item: { projectId: selectedProjectData.id } as Note })}><Plus size={17} /></button></div>
          {noteList(projectNotes)}{!projectNotes.length && <EmptyState icon={<StickyNote size={18} />} title="No notes in this project" detail="Add context as it comes to you." action="Add a note" onAction={() => setDialog({ kind: "note", item: { projectId: selectedProjectData.id } as Note })} />}</section>
        <button className="danger-link" onClick={() => remove("projects", selectedProjectData.id)}>Delete this project</button>
      </>;
    }
    return <>
      <PageHeading eyebrow="THE BIGGER PICTURE" title="Projects" detail="Give the different parts of your life a little structure." action={<button className="primary-button" onClick={() => openCreate("project")}><Plus size={16} /> New project</button>} />
      <div className="project-grid">{workspace.projects.map((project, index) => {
        const tasks = workspace.tasks.filter((task) => task.projectId === project.id && !task.archived);
        const notes = workspace.notes.filter((note) => note.projectId === project.id);
        return <article className="project-card" key={project.id}>
          <button className="project-card-open" onClick={() => openProject(project.id)}><span className={`project-swatch large swatch-${index % 4}`}><FolderKanban size={18} /></span><ArrowUpRight size={16} className="project-arrow" /><h2>{project.name}</h2><p>{project.description || "An open space for related work."}</p><div className="project-card-meta"><span><ListTodo size={14} /> {tasks.length} tasks</span><span><FileText size={14} /> {notes.length} notes</span></div></button>
          <button className="project-edit-link" onClick={() => openEdit("project", project)}>Edit details <ArrowUpRight size={13} /></button>
        </article>;
      })}{!workspace.projects.length && <EmptyState icon={<FolderKanban size={18} />} title="Start with a project" detail="Create a space for the work on your mind." action="Create a project" onAction={() => openCreate("project")} />}</div>
    </>;
  }

  function renderSearch() {
    if (!normalizedQuery) return <div className="search-prompt"><Search size={20} /><h2>Search your workspace</h2><p>Find a task, note, or project by name or detail.</p></div>;
    return <div className="search-results">
      {searchTasks.length > 0 && <SearchGroup title="Tasks" icon={<ListTodo size={15} />}>{searchTasks.map((task) => <SearchResult key={task.id} title={task.title} detail={task.description || "Task"} onClick={() => chooseSearchResult("task", task)} />)}</SearchGroup>}
      {searchNotes.length > 0 && <SearchGroup title="Notes" icon={<StickyNote size={15} />}>{searchNotes.map((note) => <SearchResult key={note.id} title={note.title} detail={note.content.split("\n")[0] || "Note"} onClick={() => chooseSearchResult("note", note)} />)}</SearchGroup>}
      {searchProjects.length > 0 && <SearchGroup title="Projects" icon={<FolderKanban size={15} />}>{searchProjects.map((project) => <SearchResult key={project.id} title={project.name} detail={project.description || "Project"} onClick={() => chooseSearchResult("project", project)} />)}</SearchGroup>}
      {!hasSearchResults && <EmptyState icon={<Search size={18} />} title="No results found" detail={`Nothing matches “${query.trim()}”. Try another search.`} />}
    </div>;
  }

  if (workspace.loading) return <main className="loading-screen"><div className="brand-mark"><Sparkles size={17} /></div><span>Opening your workspace</span><div className="loading-line" /></main>;

  return <main className="app-frame">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={17} strokeWidth={1.8} /></div><div className="brand-word">stillroom<span>PERSONAL WORKSPACE</span></div></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{navigation.map(({ id, label, icon: Icon }) => <button key={id} aria-label={label} className={cx("nav-item", view === id && !selectedProject && !normalizedQuery && "nav-active")} onClick={() => { setView(id); setSelectedProject(null); setQuery(""); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{id === "tasks" && <small>{activeTasks.length}</small>}</button>)}</nav>
      <div className="sidebar-label project-label">YOUR PROJECTS <button title="Add project" aria-label="Add project" onClick={() => openCreate("project")}><Plus size={14} /></button></div>
      <nav className="project-nav" aria-label="Projects">{workspace.projects.slice(0, 5).map((project, index) => <button className={cx("project-nav-item", selectedProject === project.id && "project-nav-active")} key={project.id} onClick={() => openProject(project.id)}><span className={`nav-project-dot dot-${index % 4}`} />{project.name}</button>)}</nav>
      <div className="sidebar-bottom"><div className="storage-status"><span className="storage-dot" /><span>Saved on this device</span><Check size={14} /></div><div className="profile-row"><div className="profile-avatar">S</div><div><strong>Your workspace</strong><small>Personal account</small></div><MoreHorizontal size={17} /></div></div>
    </aside>
    <section className="workspace-main">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{normalizedQuery ? "Search" : selectedProjectData?.name ?? navigation.find((item) => item.id === view)?.label}</strong></div>
        <div className="topbar-actions"><div className={cx("search-wrap", normalizedQuery && "search-wrap-focused")}><Search size={16} /><input id="global-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedProject(null); }} placeholder="Search anything..." aria-label="Search tasks, notes, and projects" /><kbd>⌘ K</kbd>{query && <button className="clear-search" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} /></button>}</div>
          <div className="quick-add-wrap"><button className="quick-add-button" aria-label="Quick add" title="Quick add" onClick={() => setQuickOpen(!quickOpen)} aria-expanded={quickOpen}><Plus size={16} /><span>Quick add</span><ChevronDown size={14} /></button>{quickOpen && <><button className="menu-dismiss" aria-label="Close quick add menu" onClick={() => setQuickOpen(false)} /><div className="quick-menu"><span className="menu-overline">CREATE SOMETHING</span><button onClick={() => openCreate("task")}><span className="menu-icon"><ListTodo size={16} /></span><span><strong>New task</strong><small>Something to get done</small></span><kbd>T</kbd></button><button onClick={() => openCreate("note")}><span className="menu-icon"><StickyNote size={16} /></span><span><strong>New note</strong><small>A thought to keep</small></span><kbd>N</kbd></button><button onClick={() => openCreate("project")}><span className="menu-icon"><FolderKanban size={16} /></span><span><strong>New project</strong><small>A space for related work</small></span><kbd>P</kbd></button></div></>}</div>
        </div></header>
      <div className="mobile-nav">{navigation.map(({ id, label, icon: Icon }) => <button key={id} className={cx(view === id && !selectedProject && "mobile-nav-active")} onClick={() => { setView(id); setSelectedProject(null); setQuery(""); }}><Icon size={17} /><span>{label}</span></button>)}</div>
      {workspace.error && <div className="error-banner" role="alert"><span>{workspace.error}</span><button onClick={workspace.clearError} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="notice-banner" role="status">{notice}<button aria-label="Dismiss message" onClick={() => setNotice("")}><X size={14} /></button></div>}
      <div className="page-content">{normalizedQuery ? renderSearch() : view === "home" ? renderHome() : view === "tasks" ? renderTasks() : view === "notes" ? renderNotes() : renderProjects()}</div>
    </section>
    {dialog && <EntityDialog kind={dialog.kind} item={dialog.item} projects={workspace.projects} onClose={() => setDialog(null)} onSave={async (form) => {
      const item = dialog.item;
      const saved = dialog.kind === "task" ? await workspace.saveTask(form as Parameters<typeof workspace.saveTask>[0], item && "completed" in item ? item : undefined)
        : dialog.kind === "note" ? await workspace.saveNote(form as Parameters<typeof workspace.saveNote>[0], item && "content" in item ? item : undefined)
          : await workspace.saveProject(form as Parameters<typeof workspace.saveProject>[0], item && "name" in item ? item : undefined);
      if (saved) { setDialog(null); setNotice(item && "id" in item ? "Changes saved" : `${dialog.kind[0].toUpperCase()}${dialog.kind.slice(1)} created`); }
    }} />}
  </main>;
}

function PageHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action: ReactNode }) {
  return <section className="page-heading"><div><span className="section-kicker">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div><div className="page-heading-action">{action}</div></section>;
}

function EmptyState({ icon, title, detail, action, onAction }: { icon: ReactNode; title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{detail}</p>{action && onAction && <button className="text-link" onClick={onAction}>{action} <ArrowUpRight size={13} /></button>}</div>;
}

function TaskRow({ task, project, projectColorIndex = 0, minimal = false, onToggle, onEdit, onArchive, onDelete }: { task: Task; project?: Project; projectColorIndex?: number; minimal?: boolean; onToggle: () => void; onEdit: () => void; onArchive: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
   return <article className={cx("task-row", task.completed && "task-row-complete", menuOpen && "task-row-menu-open")}>
    <button className={cx("task-check", task.completed && "task-checked")} aria-label={task.completed ? `Mark ${task.title} active` : `Complete ${task.title}`} onClick={onToggle}>{task.completed && <Check size={13} strokeWidth={2.5} />}</button>
    <button className="task-copy" onClick={onEdit}><strong>{task.title}</strong>{!minimal && task.description && <small>{task.description}</small>}</button>
    {project && <span className="task-project-dot-tag"><i className={`task-project-dot-${projectColorIndex % 4}`} />{project.name}</span>}
    <time className={cx("task-date", Boolean(task.dueDate && dueLabel(task.dueDate).startsWith("Overdue")) && "task-date-overdue")}>{dueLabel(task.dueDate)}</time>
    {!minimal && <div className="task-menu-wrap"><button className="icon-button task-more" title="Task actions" aria-label={`Actions for ${task.title}`} onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={17} /></button>{menuOpen && <><button className="menu-dismiss" aria-label="Close task menu" onClick={() => setMenuOpen(false)} /><div className="task-menu"><button onClick={() => { setMenuOpen(false); onEdit(); }}>Edit task</button><button onClick={() => { setMenuOpen(false); onArchive(); }}>{task.archived ? "Restore to active" : "Archive task"}</button><button className="menu-danger" onClick={() => { setMenuOpen(false); onDelete(); }}>Delete task</button></div></>}</div>}
  </article>;
}

function SearchGroup({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return <section className="search-group"><div className="search-group-title">{icon}{title}</div><div>{children}</div></section>;
}

function SearchResult({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button className="search-result" onClick={onClick}><span><strong>{title}</strong><small>{detail}</small></span><ArrowUpRight size={15} /></button>;
}

function EntityDialog({ kind, item, projects, onClose, onSave }: { kind: Kind; item?: Task | Note | Project; projects: Project[]; onClose: () => void; onSave: (value: { title?: string; name?: string; description?: string; content?: string; projectId?: string | null; dueDate?: string | null }) => Promise<void> }) {
  const isEdit = Boolean(item && "id" in item);
  const [title, setTitle] = useState(kind === "project" && item && "name" in item ? item.name : item && "title" in item ? item.title : "");
  const [detail, setDetail] = useState(kind === "task" && item && "description" in item ? item.description : kind === "note" && item && "content" in item ? item.content : item && "description" in item ? item.description : "");
  const [projectId, setProjectId] = useState(item && "projectId" in item ? item.projectId ?? "" : "");
  const [dueDate, setDueDate] = useState(item && "dueDate" in item ? item.dueDate ?? "" : "");
  const [validation, setValidation] = useState("");
  const [saving, setSaving] = useState(false);
  const titleLabel = kind === "project" ? "Project name" : kind === "task" ? "Task title" : "Note title";

  useEffect(() => {
    function onEscape(event: KeyboardEvent) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) { setValidation(`Please enter a ${kind === "project" ? "name" : "title"}.`); return; }
    setSaving(true);
    const value = kind === "task" ? { title, description: detail, projectId: projectId || null, dueDate: dueDate || null }
      : kind === "note" ? { title, content: detail, projectId: projectId || null }
        : { name: title, description: detail };
    await onSave(value);
    setSaving(false);
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="entity-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="dialog-topline"><span className="dialog-kind-icon">{kind === "task" ? <ListTodo size={17} /> : kind === "note" ? <StickyNote size={17} /> : <FolderKanban size={17} />}</span><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={17} /></button></div>
      <span className="section-kicker">{isEdit ? "MAKE A CHANGE" : "ADD TO YOUR WORKSPACE"}</span><h2 id="dialog-title">{isEdit ? `Edit ${kind}` : `New ${kind}`}</h2><p className="dialog-description">{kind === "task" ? "Keep the next step clear and specific." : kind === "note" ? "A thought, a reminder, a useful detail." : "Give a collection of work a place to belong."}</p>
      <form onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="entity-title">{titleLabel}<span>REQUIRED</span></label><input id="entity-title" className="form-input" autoFocus value={title} onChange={(event) => { setTitle(event.target.value); setValidation(""); }} placeholder={kind === "task" ? "What needs doing?" : kind === "note" ? "Give this note a title" : "Name your project"} />
        <label className="field-label" htmlFor="entity-detail">{kind === "task" ? "Description" : kind === "note" ? "Content" : "Description"}<span>OPTIONAL</span></label>{kind === "note" ? <textarea id="entity-detail" className="form-input form-textarea note-editor" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Write it down before it gets away..." rows={6} /> : <textarea id="entity-detail" className="form-input form-textarea" value={detail} onChange={(event) => setDetail(event.target.value)} placeholder={kind === "task" ? "Add a little context" : "What is this project about?"} rows={3} />}
        {kind === "task" && <><label className="field-label" htmlFor="entity-due-date">Due date<span>OPTIONAL</span></label><input id="entity-due-date" className="form-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></>}
        {kind !== "project" && <><label className="field-label" htmlFor="entity-project">Project<span>OPTIONAL</span></label><select id="entity-project" className="form-input form-select" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">No project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></>}
        {validation && <p className="field-error" role="alert">{validation}</p>}
        <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save changes" : `Create ${kind}`}</button></div>
      </form>
    </section>
  </div>;
}