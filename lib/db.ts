import Dexie, { type Table } from "dexie";

export interface Cat {
  id: string;
  hash: string;
  name: string;
  createdAt: number;
  lastSeen: number;
  photoCount: number;
  thumbBlobId: string;
  notes?: string;
  manuallyNamed: boolean;
  color?: string;
}

export interface Photo {
  id: string;
  catId: string;
  blob: Blob;
  thumbBlob: Blob;
  takenAt: number;
  lat?: number;
  lng?: number;
  locationAccuracy?: number;
  pHash: string;
  width: number;
  height: number;
  bytes: number;
}

export interface Achievement {
  id: string;
  catId?: string;
  unlockedAt: number;
  seen: boolean;
}

export interface Settings {
  key: string;
  value: unknown;
}

class CatDexDB extends Dexie {
  cats!: Table<Cat, string>;
  photos!: Table<Photo, string>;
  achievements!: Table<Achievement, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("CatDexDB");
    this.version(1).stores({
      cats: "id, hash, name, createdAt, lastSeen",
      photos: "id, catId, takenAt",
      achievements: "id, unlockedAt",
      settings: "key",
    });
  }
}

export const db = new CatDexDB();
