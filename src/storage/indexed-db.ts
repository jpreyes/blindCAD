/**
 * IndexedDB para proyectos recientes.
 * Almacena metadatos (nombre, fecha, tamaño) y el contenido DXF del dibujo
 * para permitir reabrir proyectos sin acceso al filesystem.
 *
 * Estrategia AGENTS.md: IndexedDB para proyectos recientes, File System Access
 * API cuando esté disponible, fallback con input/download.
 */

const DB_NAME = "blindcad";
const DB_VERSION = 1;
const STORE = "projects";

export interface RecentProject {
  id: string;
  name: string;
  sourceFile?: string;
  dxf: string;
  createdAt: number;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("name", "name");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Guarda (o actualiza) un proyecto reciente. */
export async function saveRecentProject(project: RecentProject): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Lista los proyectos recientes ordenados por updatedAt desc. */
export async function listRecentProjects(): Promise<RecentProject[]> {
  const db = await openDb();
  const result = await new Promise<RecentProject[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as RecentProject[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Obtiene un proyecto por id. */
export async function getRecentProject(id: string): Promise<RecentProject | undefined> {
  const db = await openDb();
  const result = await new Promise<RecentProject | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result as RecentProject | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

/** Elimina un proyecto reciente. */
export async function deleteRecentProject(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
