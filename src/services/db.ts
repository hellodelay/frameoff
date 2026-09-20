import { Album, CachedPhoto, FrameSettings } from '../types';

const DB_NAME = 'GooglePhotosFrameDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Albums store
        if (!db.objectStoreNames.contains('albums')) {
          db.createObjectStore('albums', { keyPath: 'id' });
        }

        // Photos store with index on albumId
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('albumId', 'albumId', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

// Album Operations
export async function saveAlbum(album: Album): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readwrite');
    const store = tx.objectStore('albums');
    store.put(album);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAlbums(): Promise<Album[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readonly');
    const store = tx.objectStore('albums');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getAlbum(id: string): Promise<Album | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('albums', 'readonly');
    const store = tx.objectStore('albums');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAlbum(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['albums', 'photos'], 'readwrite');
    const albumStore = tx.objectStore('albums');
    const photoStore = tx.objectStore('photos');
    albumStore.delete(id);

    const index = photoStore.index('albumId');
    const request = index.openCursor(IDBKeyRange.only(id));
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Photo Operations
export async function savePhoto(photo: CachedPhoto): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    store.put(photo);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function savePhotosBatch(photos: CachedPhoto[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    for (const photo of photos) {
      store.put(photo);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhotosByAlbum(albumId: string): Promise<CachedPhoto[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const index = store.index('albumId');
    const request = index.getAll(IDBKeyRange.only(albumId));
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedPhotos(): Promise<CachedPhoto[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readonly');
    const store = tx.objectStore('photos');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deletePhotos(ids: string[]): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', 'readwrite');
    const store = tx.objectStore('photos');
    for (const id of ids) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Storage Stats
export async function getStorageStats(): Promise<{ totalCount: number; totalBytes: number }> {
  const photos = await getAllCachedPhotos();
  let totalBytes = 0;
  for (const p of photos) {
    totalBytes += p.sizeBytes || (p.blob ? p.blob.size : 0);
  }
  return {
    totalCount: photos.length,
    totalBytes,
  };
}

// Settings Operations
export async function saveSettings(settings: FrameSettings): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key: 'frame_settings', value: settings });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSettings(): Promise<FrameSettings | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get('frame_settings');
    request.onsuccess = () => {
      resolve(request.result ? request.result.value : null);
    };
    request.onerror = () => reject(request.error);
  });
}

// Clear all local database data (photos, albums, settings)
export async function clearAllDatabaseData(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['albums', 'photos', 'settings'], 'readwrite');
    tx.objectStore('albums').clear();
    tx.objectStore('photos').clear();
    tx.objectStore('settings').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

