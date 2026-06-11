// Runtime compatibility helpers for Processing-style list operations in JS.

if (!Array.prototype.add) {
  Array.prototype.add = function add(value) {
    this.push(value);
    return true;
  };
}

if (!Array.prototype.get) {
  Array.prototype.get = function get(index) {
    return this[index];
  };
}

if (!Array.prototype.set) {
  Array.prototype.set = function set(index, value) {
    this[index] = value;
    return value;
  };
}

if (!Array.prototype.removeAt) {
  Array.prototype.removeAt = function removeAt(index) {
    if (index < 0 || index >= this.length) {
      return undefined;
    }
    return this.splice(index, 1)[0];
  };
}

if (!Array.prototype.removeValue) {
  Array.prototype.removeValue = function removeValue(value) {
    const idx = this.indexOf(value);
    if (idx === -1) {
      return false;
    }
    this.splice(idx, 1);
    return true;
  };
}

if (!Array.prototype.size) {
  Array.prototype.size = function size() {
    return this.length;
  };
}

if (!Array.prototype.isEmpty) {
  Array.prototype.isEmpty = function isEmpty() {
    return this.length === 0;
  };
}

if (!Array.prototype.clear) {
  Array.prototype.clear = function clear() {
    this.length = 0;
  };
}

class P5ForgeMapEntry {
  constructor(store, key) {
    this._store = store;
    this._key = key;
  }

  getKey() {
    return this._key;
  }

  getValue() {
    return this._store.has(this._key) ? this._store.get(this._key) : null;
  }

  setValue(nextValue) {
    const prev = this.getValue();
    this._store.set(this._key, nextValue);
    return prev;
  }
}

if (!globalThis.HashMap) {
  globalThis.HashMap = class HashMap {
    constructor() {
      this._store = new Map();
    }

    put(key, value) {
      const previous = this._store.has(key) ? this._store.get(key) : null;
      this._store.set(key, value);
      return previous;
    }

    get(key) {
      return this._store.has(key) ? this._store.get(key) : null;
    }

    remove(key) {
      if (!this._store.has(key)) {
        return null;
      }
      const previous = this._store.get(key);
      this._store.delete(key);
      return previous;
    }

    containsKey(key) {
      return this._store.has(key);
    }

    clear() {
      this._store.clear();
    }

    size() {
      return this._store.size;
    }

    isEmpty() {
      return this._store.size === 0;
    }

    keySet() {
      return Array.from(this._store.keys());
    }

    values() {
      return Array.from(this._store.values());
    }

    entrySet() {
      return Array.from(this._store.keys(), (key) => new P5ForgeMapEntry(this._store, key));
    }
  };
}

function p5forgeCoerceNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

if (!globalThis.IntDict) {
  globalThis.IntDict = class IntDict {
    constructor(initial = null) {
      this._store = new Map();
      if (initial && typeof initial === "object") {
        for (const [key, value] of Object.entries(initial)) {
          this.set(key, value);
        }
      }
    }

    set(key, value) {
      const nextValue = Math.trunc(p5forgeCoerceNumber(value, 0));
      this._store.set(String(key), nextValue);
      return nextValue;
    }

    get(key) {
      const normalizedKey = String(key);
      return this._store.has(normalizedKey) ? this._store.get(normalizedKey) : 0;
    }

    increment(key) {
      return this.add(key, 1);
    }

    add(key, amount) {
      const normalizedKey = String(key);
      const nextValue = this.get(normalizedKey) + Math.trunc(p5forgeCoerceNumber(amount, 0));
      this._store.set(normalizedKey, nextValue);
      return nextValue;
    }

    hasKey(key) {
      return this._store.has(String(key));
    }

    remove(key) {
      const normalizedKey = String(key);
      const previous = this.get(normalizedKey);
      this._store.delete(normalizedKey);
      return previous;
    }

    clear() {
      this._store.clear();
    }

    size() {
      return this._store.size;
    }

    keyArray() {
      return Array.from(this._store.keys());
    }

    valueArray() {
      return Array.from(this._store.values());
    }

    keys() {
      return this.keyArray();
    }

    values() {
      return this.valueArray();
    }

    sortKeys(reverse = false) {
      const ordered = this.keyArray().sort((a, b) => a.localeCompare(b));
      return reverse ? ordered.reverse() : ordered;
    }

    sortValues(reverse = false) {
      const ordered = this.valueArray().sort((a, b) => a - b);
      return reverse ? ordered.reverse() : ordered;
    }

    minValue() {
      if (this._store.size === 0) {
        return 0;
      }
      return Math.min(...this._store.values());
    }

    maxValue() {
      if (this._store.size === 0) {
        return 0;
      }
      return Math.max(...this._store.values());
    }
  };
}

if (!globalThis.FloatDict) {
  globalThis.FloatDict = class FloatDict {
    constructor(initial = null) {
      this._store = new Map();
      if (initial && typeof initial === "object") {
        for (const [key, value] of Object.entries(initial)) {
          this.set(key, value);
        }
      }
    }

    set(key, value) {
      const nextValue = p5forgeCoerceNumber(value, 0);
      this._store.set(String(key), nextValue);
      return nextValue;
    }

    get(key) {
      const normalizedKey = String(key);
      return this._store.has(normalizedKey) ? this._store.get(normalizedKey) : 0;
    }

    hasKey(key) {
      return this._store.has(String(key));
    }

    remove(key) {
      const normalizedKey = String(key);
      const previous = this.get(normalizedKey);
      this._store.delete(normalizedKey);
      return previous;
    }

    clear() {
      this._store.clear();
    }

    size() {
      return this._store.size;
    }

    keyArray() {
      return Array.from(this._store.keys());
    }

    valueArray() {
      return Array.from(this._store.values());
    }

    keys() {
      return this.keyArray();
    }

    values() {
      return this.valueArray();
    }

    sortKeys(reverse = false) {
      const ordered = this.keyArray().sort((a, b) => a.localeCompare(b));
      return reverse ? ordered.reverse() : ordered;
    }

    sortValues(reverse = false) {
      const ordered = this.valueArray().sort((a, b) => a - b);
      return reverse ? ordered.reverse() : ordered;
    }

    minValue() {
      if (this._store.size === 0) {
        return 0;
      }
      return Math.min(...this._store.values());
    }

    maxValue() {
      if (this._store.size === 0) {
        return 0;
      }
      return Math.max(...this._store.values());
    }
  };
}

if (!globalThis.FlatDict) {
  globalThis.FlatDict = globalThis.FloatDict;
}

if (!globalThis.StringDict) {
  globalThis.StringDict = class StringDict {
    constructor(initial = null) {
      this._store = new Map();
      if (initial && typeof initial === "object") {
        for (const [key, value] of Object.entries(initial)) {
          this.set(key, value);
        }
      }
    }

    set(key, value) {
      const nextValue = value === null || value === undefined ? "" : String(value);
      this._store.set(String(key), nextValue);
      return nextValue;
    }

    get(key) {
      const normalizedKey = String(key);
      return this._store.has(normalizedKey) ? this._store.get(normalizedKey) : null;
    }

    hasKey(key) {
      return this._store.has(String(key));
    }

    remove(key) {
      const normalizedKey = String(key);
      const previous = this.get(normalizedKey);
      this._store.delete(normalizedKey);
      return previous;
    }

    clear() {
      this._store.clear();
    }

    size() {
      return this._store.size;
    }

    keyArray() {
      return Array.from(this._store.keys());
    }

    valueArray() {
      return Array.from(this._store.values());
    }

    keys() {
      return this.keyArray();
    }

    values() {
      return this.valueArray();
    }

    sortKeys(reverse = false) {
      const ordered = this.keyArray().sort((a, b) => a.localeCompare(b));
      return reverse ? ordered.reverse() : ordered;
    }

    sortValues(reverse = false) {
      const ordered = this.valueArray().sort((a, b) => a.localeCompare(b));
      return reverse ? ordered.reverse() : ordered;
    }

    minValue() {
      if (this._store.size === 0) {
        return null;
      }
      return this.sortValues(false)[0];
    }

    maxValue() {
      if (this._store.size === 0) {
        return null;
      }
      const ordered = this.sortValues(true);
      return ordered[0];
    }
  };
}

if (!globalThis.IntList) {
  globalThis.IntList = class IntList {
    constructor(initial = []) {
      this._items = [];
      if (Array.isArray(initial)) {
        for (const value of initial) {
          this.append(value);
        }
      }
    }

    append(value) {
      this._items.push(Math.trunc(p5forgeCoerceNumber(value, 0)));
      return this;
    }

    add(value) {
      return this.append(value);
    }

    get(index) {
      return this._items[index];
    }

    set(index, value) {
      this._items[index] = Math.trunc(p5forgeCoerceNumber(value, 0));
      return this._items[index];
    }

    remove(index) {
      if (index < 0 || index >= this._items.length) {
        return 0;
      }
      return this._items.splice(index, 1)[0];
    }

    removeValue(value) {
      const target = Math.trunc(p5forgeCoerceNumber(value, 0));
      const idx = this._items.indexOf(target);
      if (idx === -1) {
        return false;
      }
      this._items.splice(idx, 1);
      return true;
    }

    hasValue(value) {
      const target = Math.trunc(p5forgeCoerceNumber(value, 0));
      return this._items.includes(target);
    }

    clear() {
      this._items.length = 0;
    }

    size() {
      return this._items.length;
    }

    isEmpty() {
      return this._items.length === 0;
    }

    sort(reverse = false) {
      this._items.sort((a, b) => a - b);
      if (reverse) {
        this._items.reverse();
      }
      return this;
    }

    min() {
      return this._items.length > 0 ? Math.min(...this._items) : 0;
    }

    max() {
      return this._items.length > 0 ? Math.max(...this._items) : 0;
    }

    sum() {
      return this._items.reduce((acc, value) => acc + value, 0);
    }

    values() {
      return this._items.slice();
    }

    array() {
      return this.values();
    }
  };
}

if (!globalThis.FloatList) {
  globalThis.FloatList = class FloatList {
    constructor(initial = []) {
      this._items = [];
      if (Array.isArray(initial)) {
        for (const value of initial) {
          this.append(value);
        }
      }
    }

    append(value) {
      this._items.push(p5forgeCoerceNumber(value, 0));
      return this;
    }

    add(value) {
      return this.append(value);
    }

    get(index) {
      return this._items[index];
    }

    set(index, value) {
      this._items[index] = p5forgeCoerceNumber(value, 0);
      return this._items[index];
    }

    remove(index) {
      if (index < 0 || index >= this._items.length) {
        return 0;
      }
      return this._items.splice(index, 1)[0];
    }

    removeValue(value) {
      const target = p5forgeCoerceNumber(value, 0);
      const idx = this._items.indexOf(target);
      if (idx === -1) {
        return false;
      }
      this._items.splice(idx, 1);
      return true;
    }

    hasValue(value) {
      const target = p5forgeCoerceNumber(value, 0);
      return this._items.includes(target);
    }

    clear() {
      this._items.length = 0;
    }

    size() {
      return this._items.length;
    }

    isEmpty() {
      return this._items.length === 0;
    }

    sort(reverse = false) {
      this._items.sort((a, b) => a - b);
      if (reverse) {
        this._items.reverse();
      }
      return this;
    }

    min() {
      return this._items.length > 0 ? Math.min(...this._items) : 0;
    }

    max() {
      return this._items.length > 0 ? Math.max(...this._items) : 0;
    }

    sum() {
      return this._items.reduce((acc, value) => acc + value, 0);
    }

    values() {
      return this._items.slice();
    }

    array() {
      return this.values();
    }
  };
}

if (!globalThis.StringList) {
  globalThis.StringList = class StringList {
    constructor(initial = []) {
      this._items = [];
      if (Array.isArray(initial)) {
        for (const value of initial) {
          this.append(value);
        }
      }
    }

    append(value) {
      this._items.push(value === null || value === undefined ? "" : String(value));
      return this;
    }

    add(value) {
      return this.append(value);
    }

    get(index) {
      return this._items[index];
    }

    set(index, value) {
      this._items[index] = value === null || value === undefined ? "" : String(value);
      return this._items[index];
    }

    remove(index) {
      if (index < 0 || index >= this._items.length) {
        return null;
      }
      return this._items.splice(index, 1)[0];
    }

    removeValue(value) {
      const target = value === null || value === undefined ? "" : String(value);
      const idx = this._items.indexOf(target);
      if (idx === -1) {
        return false;
      }
      this._items.splice(idx, 1);
      return true;
    }

    hasValue(value) {
      const target = value === null || value === undefined ? "" : String(value);
      return this._items.includes(target);
    }

    clear() {
      this._items.length = 0;
    }

    size() {
      return this._items.length;
    }

    isEmpty() {
      return this._items.length === 0;
    }

    sort(reverse = false) {
      this._items.sort((a, b) => a.localeCompare(b));
      if (reverse) {
        this._items.reverse();
      }
      return this;
    }

    values() {
      return this._items.slice();
    }

    array() {
      return this.values();
    }
  };
}
