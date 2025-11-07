const DB_NAME = 'video-clip-tool';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

let dbPromise: Promise<IDBDatabase> | null = null;

const getIndexedDB = () => {
  if (typeof window === 'undefined') return null;
  return window.indexedDB ?? null;
};

const openDatabase = async (): Promise<IDBDatabase> => {
  const indexedDB = getIndexedDB();
  if (!indexedDB) {
    throw new Error('IndexedDB is not available in this environment');
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('Failed to open IndexedDB'));
    };
  });

  return dbPromise;
};

const runRequest = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const getStore = async (mode: IDBTransactionMode) => {
  const db = await openDatabase();
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
};

export async function saveFile(sourceId: string, file: File) {
  const store = await getStore('readwrite');
  await runRequest(store.put(file, sourceId));
}

export async function getFile(sourceId: string): Promise<File | null> {
  const store = await getStore('readonly');
  const result = await runRequest<File | undefined>(store.get(sourceId));
  return result ?? null;
}

export async function deleteFile(sourceId: string) {
  const store = await getStore('readwrite');
  await runRequest(store.delete(sourceId));
}

export async function clearAll() {
  const store = await getStore('readwrite');
  await runRequest(store.clear());
}
