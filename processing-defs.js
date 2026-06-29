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

if (!globalThis.ArrayList) {
  globalThis.ArrayList = class ArrayList extends Array {
    constructor(...args) {
      super();

      // Java-style initial capacity should not pre-fill JS array length.
      if (args.length === 1 && Number.isFinite(args[0])) {
        return;
      }

      if (args.length === 1 && Array.isArray(args[0])) {
        this.push(...args[0]);
        return;
      }

      if (args.length > 0) {
        this.push(...args);
      }
    }
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

if (!globalThis.PVector) {
  globalThis.PVector = class PVector {
    constructor(x = 0, y = 0, z = 0) {
      this.x = p5forgeCoerceNumber(x, 0);
      this.y = p5forgeCoerceNumber(y, 0);
      this.z = p5forgeCoerceNumber(z, 0);
    }

    set(x, y, z = this.z) {
      if (x && typeof x === "object") {
        this.x = p5forgeCoerceNumber(x.x, 0);
        this.y = p5forgeCoerceNumber(x.y, 0);
        this.z = p5forgeCoerceNumber(x.z, 0);
        return this;
      }

      this.x = p5forgeCoerceNumber(x, 0);
      this.y = p5forgeCoerceNumber(y, 0);
      this.z = p5forgeCoerceNumber(z, 0);
      return this;
    }

    copy() {
      return new globalThis.PVector(this.x, this.y, this.z);
    }

    add(x, y, z = 0) {
      if (x && typeof x === "object") {
        this.x += p5forgeCoerceNumber(x.x, 0);
        this.y += p5forgeCoerceNumber(x.y, 0);
        this.z += p5forgeCoerceNumber(x.z, 0);
        return this;
      }

      this.x += p5forgeCoerceNumber(x, 0);
      this.y += p5forgeCoerceNumber(y, 0);
      this.z += p5forgeCoerceNumber(z, 0);
      return this;
    }

    sub(x, y, z = 0) {
      if (x && typeof x === "object") {
        this.x -= p5forgeCoerceNumber(x.x, 0);
        this.y -= p5forgeCoerceNumber(x.y, 0);
        this.z -= p5forgeCoerceNumber(x.z, 0);
        return this;
      }

      this.x -= p5forgeCoerceNumber(x, 0);
      this.y -= p5forgeCoerceNumber(y, 0);
      this.z -= p5forgeCoerceNumber(z, 0);
      return this;
    }

    mult(value) {
      const n = p5forgeCoerceNumber(value, 1);
      this.x *= n;
      this.y *= n;
      this.z *= n;
      return this;
    }

    div(value) {
      const n = p5forgeCoerceNumber(value, 1);
      if (n === 0) {
        return this;
      }
      this.x /= n;
      this.y /= n;
      this.z /= n;
      return this;
    }

    magSq() {
      return this.x * this.x + this.y * this.y + this.z * this.z;
    }

    mag() {
      return Math.sqrt(this.magSq());
    }

    normalize() {
      const m = this.mag();
      if (m !== 0) {
        this.div(m);
      }
      return this;
    }

    setMag(len) {
      return this.normalize().mult(p5forgeCoerceNumber(len, 0));
    }

    limit(maxValue) {
      const max = p5forgeCoerceNumber(maxValue, 0);
      const mSq = this.magSq();
      if (mSq > max * max) {
        this.normalize();
        this.mult(max);
      }
      return this;
    }

    heading() {
      return Math.atan2(this.y, this.x);
    }

    lerp(x, y, z, amt) {
      if (x && typeof x === "object") {
        const targetX = p5forgeCoerceNumber(x.x, 0);
        const targetY = p5forgeCoerceNumber(x.y, 0);
        const targetZ = p5forgeCoerceNumber(x.z, 0);
        const t = p5forgeCoerceNumber(y, 0);

        this.x += (targetX - this.x) * t;
        this.y += (targetY - this.y) * t;
        this.z += (targetZ - this.z) * t;
        return this;
      }

      const targetX = p5forgeCoerceNumber(x, 0);
      const targetY = p5forgeCoerceNumber(y, 0);
      const targetZ = p5forgeCoerceNumber(z, 0);
      const t = p5forgeCoerceNumber(amt, 0);

      this.x += (targetX - this.x) * t;
      this.y += (targetY - this.y) * t;
      this.z += (targetZ - this.z) * t;
      return this;
    }

    dot(x, y, z = 0) {
      if (x && typeof x === "object") {
        return this.x * p5forgeCoerceNumber(x.x, 0) + this.y * p5forgeCoerceNumber(x.y, 0) + this.z * p5forgeCoerceNumber(x.z, 0);
      }

      return this.x * p5forgeCoerceNumber(x, 0) + this.y * p5forgeCoerceNumber(y, 0) + this.z * p5forgeCoerceNumber(z, 0);
    }

    dist(other) {
      const dx = this.x - p5forgeCoerceNumber(other && other.x, 0);
      const dy = this.y - p5forgeCoerceNumber(other && other.y, 0);
      const dz = this.z - p5forgeCoerceNumber(other && other.z, 0);
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    cross(other) {
      const ox = p5forgeCoerceNumber(other && other.x, 0);
      const oy = p5forgeCoerceNumber(other && other.y, 0);
      const oz = p5forgeCoerceNumber(other && other.z, 0);
      return new globalThis.PVector(
        this.y * oz - this.z * oy,
        this.z * ox - this.x * oz,
        this.x * oy - this.y * ox
      );
    }

    static add(v1, v2) {
      return v1.copy().add(v2);
    }

    static sub(v1, v2) {
      return v1.copy().sub(v2);
    }

    static mult(vector, n) {
      return vector.copy().mult(n);
    }

    static div(vector, n) {
      return vector.copy().div(n);
    }

    static fromAngle(angle, length = 1) {
      const a = p5forgeCoerceNumber(angle, 0);
      const len = p5forgeCoerceNumber(length, 1);
      return new globalThis.PVector(Math.cos(a) * len, Math.sin(a) * len, 0);
    }

    static lerp(v1, v2, amt) {
      return v1.copy().lerp(v2, amt);
    }

    static random2D() {
      const angle = Math.random() * Math.PI * 2;
      return globalThis.PVector.fromAngle(angle, 1);
    }

    static random3D() {
      const angle = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const base = Math.sqrt(Math.max(0, 1 - z * z));
      return new globalThis.PVector(base * Math.cos(angle), base * Math.sin(angle), z);
    }
  };
}
