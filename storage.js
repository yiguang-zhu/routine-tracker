// Local-only storage. No data is transmitted to a server.
const DB_NAME = 'routine-tracker-v2';
const DB_VERSION = 1;
const STORE = 'documents';
let databasePromise;

export function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function initialState() {
  const createdAt = new Date().toISOString();
  const names = [
    ['Laundry', '🧺'],
    ['Grocery', '🛒'],
    ['Dine out', '🍽️'],
    ['Cleaning', '🧹'],
    ['Workout', '🏸'],
  ];
  return {
    schema: 2,
    activities: names.map(([name, emoji], index) => ({ id: makeId(), name, emoji, order: index, archived: false, createdAt })),
    logs: [],
    meta: { createdAt, lastExportAt: null, reminderSnoozedUntil: null, readOnly: false, importedAt: null },
  };
}

function openDatabase() {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('此浏览器不支持 IndexedDB'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('无法打开本地数据库'));
      request.onblocked = () => reject(new Error('本地数据库被其他标签页占用'));
    }).catch(error => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

export async function readLocal() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get('state');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('读取本地数据失败'));
  });
}

export async function writeLocal(state) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(state, 'state');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存失败'));
    tx.onabort = () => reject(tx.error || new Error('保存已中止'));
  });
}

export function isValidISO(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function parseBackup(raw) {
  if (!raw || typeof raw !== 'object' || raw.app !== 'routine-tracker' || raw.version !== 2) {
    throw new Error('不支持的备份格式，请选择 Routine V2 导出的 JSON 文件。');
  }
  if (!Array.isArray(raw.activities) || !Array.isArray(raw.logs) || raw.activities.length > 10000 || raw.logs.length > 500000) {
    throw new Error('备份文件缺少事项或记录，或内容过多。');
  }
  const activities = raw.activities.map((a, index) => {
    if (!a || typeof a.id !== 'string' || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80) {
      throw new Error(`第 ${index + 1} 个事项格式错误。`);
    }
    return { id: a.id, name: a.name.trim(), emoji: typeof a.emoji === 'string' ? a.emoji.slice(0, 12) : '✦',
      order: Number.isFinite(a.order) ? a.order : index, archived: a.archived === true,
      createdAt: isValidISO(a.createdAt) ? a.createdAt : new Date().toISOString() };
  });
  const activityIds = new Set(activities.map(a => a.id));
  const logs = raw.logs.map((l, index) => {
    if (!l || typeof l.id !== 'string' || !activityIds.has(l.activityId) || !isValidISO(l.occurredAt)) {
      throw new Error(`第 ${index + 1} 条记录格式错误。`);
    }
    return { id: l.id, activityId: l.activityId, occurredAt: l.occurredAt,
      recordedAt: isValidISO(l.recordedAt) ? l.recordedAt : l.occurredAt };
  });
  return { schema: 2, activities, logs,
    meta: { createdAt: isValidISO(raw.createdAt) ? raw.createdAt : new Date().toISOString(),
      lastExportAt: null, reminderSnoozedUntil: null, readOnly: false, importedAt: null } };
}

export function toBackup(state) {
  return { app: 'routine-tracker', version: 2, exportedAt: new Date().toISOString(),
    createdAt: state.meta.createdAt, activities: state.activities, logs: state.logs };
}
