class StateManager {
    constructor(storeName = 'appState') {
        this.storeName = storeName;
        this._initPromise = this._init();
    }

    async _init() {
        this.db = await this._ensureStore(this.storeName);
    }

    async _ensureStore(storeName) {
        const dbName = this.storeName;

        const openDB = (version) => new Promise((resolve, reject) => {
            const req = indexedDB.open(dbName, version);
            req.onupgradeneeded = () => {
                const db = req.result;
                db.onversionchange = () => db.close();
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            }
            req.onsuccess = () => {
                const db = req.result;
                db.onversionchange = () => db.close();
                resolve(db);
            }
            req.onerror = () => {
                reject(req.error ?? new Error("IndexedDB open failed"));
            }
        });

        let db = await openDB();
        if (db.objectStoreNames.contains(storeName)) {
            return db;
        }

        const newVersion = db.version + 1;
        db.close();
        db = await openDB(newVersion);
        if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            throw new Error(`Failed to create object store "${storeName}"`);
        }
        return db;
    }

    async saveState(state) {
        await this._initPromise;
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        
        const persistentState = {
            BXXX: state.BXXX,
            CXXX: state.CXXX,
            SXXX: state.SXXX,
            voice: state._voice,
            isPhonetic: state._isPhonetic,
            isRepeat: state._isRepeat,
            isHardMuted: state._isHardMuted,
            lastUpdated: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const req = store.put(persistentState, 'currentState');
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadState() {
        await this._initPromise;
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);

        return new Promise((resolve, reject) => {
            const req = store.get('currentState');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }
}

// Export the StateManager
export { StateManager };