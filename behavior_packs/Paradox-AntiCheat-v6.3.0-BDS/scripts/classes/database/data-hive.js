import { system, world } from "@minecraft/server";
const CHUNK_SIZE = 30000;
/**
 * Type-safe, chunked database using dynamic properties, resilient to crashes.
 */
export class OptimizedDatabase {
    name;
    pointerKey;
    cachedPointers = undefined;
    static instances = [];
    static _locks = new Set();
    constructor(name) {
        if (!name || name.length === 0)
            throw new Error("[Paradox] Database name cannot be empty.");
        if (name.includes('"') || name.includes("/"))
            throw new Error('[Paradox] Database name cannot include `"` or `/`.');
        this.name = name;
        this.pointerKey = `${this.name}/pointers`;
        if (!world.getDynamicProperty(this.pointerKey)) {
            world.setDynamicProperty(this.pointerKey, JSON.stringify([]));
        }
        if (!OptimizedDatabase.instances.includes(this))
            OptimizedDatabase.instances.push(this);
    }
    /** Returns all existing instances of the database */
    static getAllInstances() {
        return this.instances;
    }
    /** Get cached pointers or read from dynamic properties */
    _getPointers() {
        if (this.cachedPointers !== undefined)
            return this.cachedPointers;
        const pointers = world.getDynamicProperty(this.pointerKey);
        this.cachedPointers = pointers ? JSON.parse(pointers) : [];
        return this.cachedPointers || [];
    }
    /** Update pointers and mark cache dirty */
    _setPointers(pointers) {
        if (JSON.stringify(pointers) !== JSON.stringify(this.cachedPointers)) {
            this.cachedPointers = pointers;
            world.setDynamicProperty(this.pointerKey, JSON.stringify(pointers));
            this._markDirty();
        }
    }
    _markDirty() {
        this.cachedPointers = undefined;
    }
    /** Run async/sync function with a lock to prevent concurrent writes */
    static async _withLock(resource, fn) {
        const TIMEOUT = 10000;
        const start = Date.now();
        while (this._locks.has(resource)) {
            if (Date.now() - start > TIMEOUT)
                throw new Error(`Lock timeout for resource: ${resource}`);
            await new Promise((resolve) => system.run(resolve));
        }
        this._locks.add(resource);
        try {
            return await fn();
        }
        finally {
            this._locks.delete(resource);
        }
    }
    /** Deletes all chunks of a base key */
    _deleteChunks(baseKey) {
        for (let i = 0;; ++i) {
            const key = `${baseKey}/${i}`;
            if (world.getDynamicProperty(key) === undefined)
                break;
            world.setDynamicProperty(key, undefined);
        }
        world.setDynamicProperty(baseKey, undefined);
    }
    /** Deletes multiple dynamic properties by key safely */
    _deleteKeys(keys) {
        for (const key of keys) {
            try {
                world.setDynamicProperty(key, undefined);
            }
            catch (err) {
                console.warn(`[${this.name}] Failed to delete dynamic property key "${key}":`, err);
            }
        }
    }
    /** Sets a key-value pair (chunks large entries) */
    async set(key, value) {
        const base = `${this.name}/${String(key)}`;
        await OptimizedDatabase._withLock(base, async () => {
            const json = JSON.stringify(value);
            const tmpBase = `${base}~tmp`;
            this._deleteChunks(tmpBase);
            const tmpChunks = {};
            for (let i = 0; i < json.length; i += CHUNK_SIZE) {
                tmpChunks[`${tmpBase}/${i / CHUNK_SIZE}`] = json.slice(i, i + CHUNK_SIZE);
            }
            world.setDynamicProperties(tmpChunks);
            world.setDynamicProperty(base, "USE_TMP");
            this._deleteChunks(base);
            const realChunks = {};
            const deleteChunks = [];
            for (let i = 0;; ++i) {
                const c = world.getDynamicProperty(`${tmpBase}/${i}`);
                if (c === undefined)
                    break;
                realChunks[`${base}/${i}`] = c;
                deleteChunks.push(`${tmpBase}/${i}`);
            }
            world.setDynamicProperties(realChunks);
            this._deleteKeys([...deleteChunks, base, tmpBase]);
        });
        const pointers = this._getPointers();
        if (!pointers.includes(base))
            this._setPointers([...pointers, base]);
    }
    /** Retrieves a stored object */
    get(key) {
        const base = `${this.name}/${String(key)}`;
        const marker = world.getDynamicProperty(base);
        const real = marker === "USE_TMP" ? `${base}~tmp` : base;
        const chunks = [];
        for (let i = 0;; ++i) {
            const c = world.getDynamicProperty(`${real}/${i}`);
            if (c === undefined)
                break;
            chunks.push(c);
        }
        if (!chunks.length)
            return undefined;
        try {
            return JSON.parse(chunks.join(""));
        }
        catch (err) {
            console.warn(`[${this.name}] Failed to parse entry for key "${String(key)}":`, err);
            return undefined;
        }
    }
    /** Deletes a key */
    async delete(key) {
        const base = `${this.name}/${String(key)}`;
        await OptimizedDatabase._withLock(base, async () => {
            this._deleteChunks(base);
            this._setPointers(this._getPointers().filter((p) => p !== base));
        });
    }
    /** Clears all keys */
    async clear() {
        await OptimizedDatabase._withLock(this.name, async () => {
            const pointers = this._getPointers();
            pointers.forEach((ptr) => this._deleteChunks(ptr));
            this._setPointers([]);
        });
    }
    /** Returns all entries */
    entries() {
        return this._getPointers()
            .map((ptr) => {
            const key = ptr.split("/").pop();
            const value = this.get(key);
            if (value === undefined)
                return null;
            return [key, value];
        })
            .filter((entry) => entry !== null);
    }
    /**
     * Cleans invalid entries from the database.
     *
     * @param validator Optional custom validation function.
     *                  Should return `true` for valid entries, `false` for invalid.
     * @param options Optional configuration object:
     *   - silent: if true, suppresses console logs/warnings.
     */
    async clean(validator, options) {
        const silent = options?.silent ?? false;
        await OptimizedDatabase._withLock(this.name, async () => {
            const entries = this.entries();
            let deletedCount = 0;
            const defaultValidator = (value) => {
                if (value === undefined)
                    return false;
                if (typeof value === "string" && value.trim() === "")
                    return false;
                if (Array.isArray(value) && value.length === 0)
                    return false;
                if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
                    return false;
                if (typeof value === "number" && isNaN(value))
                    return false;
                if (typeof value === "function" || typeof value === "symbol")
                    return false;
                return true;
            };
            for (const [key, value] of entries) {
                const isValid = validator ? validator(key, value) : defaultValidator(value);
                if (!isValid) {
                    await this.delete(key);
                    if (!silent) {
                        console.warn(`[${this.name}] Deleted invalid entry "${String(key)}" with value:`, value);
                    }
                    deletedCount++;
                }
            }
            if (!silent) {
                console.log(`[${this.name}] Cleanup complete. Total deleted entries: ${deletedCount}`);
            }
        });
    }
    /** ------------------- Legacy / Debug Methods ------------------- */
    /** List all pointer keys */
    listPointers() {
        return this._getPointers();
    }
    /** Get size of a single entry in bytes */
    getEntrySizeBytes(key) {
        const base = `${this.name}/${key}`;
        let bytes = 0;
        for (let i = 0;; i++) {
            const chunk = world.getDynamicProperty(`${base}/${i}`);
            if (chunk === undefined)
                break;
            bytes += chunk.length * 2;
        }
        return bytes;
    }
    /** Convert bytes to human-readable format */
    formatBytes(bytes) {
        const sizes = ["B", "KB", "MB", "GB", "TB"];
        if (bytes <= 0)
            return "0 B";
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        const value = bytes / Math.pow(1024, i);
        return `${value.toFixed(2)} ${sizes[i]}`;
    }
    /** Total size of all entries in human-readable format */
    getTotalSizeFormatted() {
        const totalBytes = this._getPointers().reduce((sum, ptr) => {
            const key = ptr.split("/").pop();
            return sum + this.getEntrySizeBytes(key);
        }, 0);
        return this.formatBytes(totalBytes);
    }
    /** Number of chunks for a given key */
    getChunkCount(key) {
        const base = `${this.name}/${key}`;
        let count = 0;
        while (world.getDynamicProperty(`${base}/${count}`) !== undefined)
            count++;
        return count;
    }
    /** Checks if a key exists */
    containsKey(key) {
        return this._getPointers().includes(`${this.name}/${key}`);
    }
}
