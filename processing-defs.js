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

// ---------------------------------------------------------------------------
// PShape — Processing shape support on top of p5.js 2.0.
//
// p5.js 2.0 has no PShape / loadShape / createShape / shape() in core, so this
// is a runtime shim. A PShape records its geometry/style/transforms when built
// and replays them through p5's immediate-mode API when drawn. loadShape()
// defers to the now-async loadImage()/loadModel(), hence it is async (the
// transpiler awaits it; see ASYNC_LOADER_FUNCTIONS in generator.js).
// ---------------------------------------------------------------------------

// createShape() primitive/group kinds. Processing exposes these as constants;
// p5 has no equivalents, so define stable sentinels — guarded so we never
// clobber an existing p5 constant of the same name.
for (const kind of ["GROUP", "POINT", "LINE", "TRIANGLE", "QUAD", "RECT", "ELLIPSE", "ARC", "BOX", "SPHERE"]) {
  if (globalThis[kind] === undefined) {
    globalThis[kind] = "p5forge:shape:" + kind;
  }
}

if (!globalThis.PShape) {
  globalThis.PShape = class PShape {
    // type: "path" | "primitive" | "group" | "image" | "geometry"
    constructor(type = "path") {
      this._type = type;
      this._children = [];
      this._vertices = []; // { kind: "vertex" | "bezier" | "curve", args }
      this._beginKind = null; // beginShape() mode
      this._closeMode = null; // CLOSE or null
      this._primitive = null; // { kind, params } for "primitive"
      this._image = null; // p5.Image for "image"
      this._geometry = null; // p5.Geometry for "geometry"
      this._transforms = []; // { op, args }
      this._visible = true;
      // undefined = inherit ambient style, null = none, else explicit value
      this._fill = undefined;
      this._stroke = undefined;
      this._strokeWeight = undefined;
      this.width = 0;
      this.height = 0;
    }

    // --- building (retained mode) -----------------------------------------
    beginShape(kind) {
      this._beginKind = kind === undefined ? null : kind;
      this._vertices = [];
      return this;
    }

    vertex(...args) {
      this._vertices.push({ kind: "vertex", args });
      return this;
    }

    bezierVertex(...args) {
      this._vertices.push({ kind: "bezier", args });
      return this;
    }

    curveVertex(...args) {
      this._vertices.push({ kind: "curve", args });
      return this;
    }

    endShape(mode) {
      this._closeMode = mode === undefined ? null : mode;
      return this;
    }

    // --- children (GROUP shapes) ------------------------------------------
    addChild(child) {
      this._children.push(child);
      return this;
    }

    getChild(index) {
      return this._children[index] ?? null;
    }

    getChildCount() {
      return this._children.length;
    }

    // --- vertices ---------------------------------------------------------
    getVertexCount() {
      return this._vertices.length;
    }

    getVertex(index) {
      const v = this._vertices[index];
      if (!v) {
        return new globalThis.PVector(0, 0, 0);
      }
      return new globalThis.PVector(v.args[0] ?? 0, v.args[1] ?? 0, v.args[2] ?? 0);
    }

    setVertex(index, x, y, z) {
      const v = this._vertices[index];
      if (!v) {
        return;
      }
      if (x && typeof x === "object") {
        v.args = x.z === undefined ? [x.x ?? 0, x.y ?? 0] : [x.x ?? 0, x.y ?? 0, x.z];
      } else {
        v.args[0] = x;
        v.args[1] = y;
        if (z === undefined) {
          // Preserve 2D arity so vertex() is not given a stray texture coord.
          v.args.length = 2;
        } else {
          v.args[2] = z;
        }
      }
    }

    // --- style ------------------------------------------------------------
    // Color overrides are stored as argument arrays and replayed through p5's
    // fill()/stroke() at draw time (undefined = inherit, null = none).
    setFill(...args) {
      // Processing accepts setFill(boolean) to toggle and setFill(color).
      if (args.length === 1 && typeof args[0] === "boolean") {
        this._fill = args[0] ? undefined : null;
      } else {
        this._fill = args;
      }
      return this;
    }

    setStroke(...args) {
      if (args.length === 1 && typeof args[0] === "boolean") {
        this._stroke = args[0] ? undefined : null;
      } else {
        this._stroke = args;
      }
      return this;
    }

    setStrokeWeight(weight) {
      this._strokeWeight = weight;
      return this;
    }

    noFill() {
      this._fill = null;
      return this;
    }

    noStroke() {
      this._stroke = null;
      return this;
    }

    fill(...args) {
      this._fill = args;
      return this;
    }

    stroke(...args) {
      this._stroke = args;
      return this;
    }

    // --- transforms (queued, applied at draw time) ------------------------
    translate(x, y, z = 0) {
      this._transforms.push({ op: "translate", args: [x, y, z] });
      return this;
    }

    rotate(angle) {
      this._transforms.push({ op: "rotate", args: [angle] });
      return this;
    }

    rotateX(angle) {
      this._transforms.push({ op: "rotateX", args: [angle] });
      return this;
    }

    rotateY(angle) {
      this._transforms.push({ op: "rotateY", args: [angle] });
      return this;
    }

    rotateZ(angle) {
      this._transforms.push({ op: "rotateZ", args: [angle] });
      return this;
    }

    scale(x, y, z) {
      const args = y === undefined ? [x] : z === undefined ? [x, y] : [x, y, z];
      this._transforms.push({ op: "scale", args });
      return this;
    }

    resetMatrix() {
      this._transforms = [];
      return this;
    }

    // --- visibility -------------------------------------------------------
    setVisible(visible) {
      this._visible = !!visible;
      return this;
    }

    isVisible() {
      return this._visible;
    }

    // --- rendering --------------------------------------------------------
    _applyStyle() {
      if (this._fill === null) {
        globalThis.noFill();
      } else if (this._fill !== undefined) {
        globalThis.fill(...this._fill);
      }
      if (this._stroke === null) {
        globalThis.noStroke();
      } else if (this._stroke !== undefined) {
        globalThis.stroke(...this._stroke);
      }
      if (this._strokeWeight !== undefined) {
        globalThis.strokeWeight(this._strokeWeight);
      }
    }

    _applyTransforms() {
      for (const t of this._transforms) {
        const fn = globalThis[t.op];
        if (typeof fn === "function") {
          fn(...t.args);
        }
      }
    }

    _drawPath() {
      if (this._beginKind === null) {
        globalThis.beginShape();
      } else {
        globalThis.beginShape(this._beginKind);
      }
      for (const v of this._vertices) {
        if (v.kind === "bezier") {
          globalThis.bezierVertex(...v.args);
        } else if (v.kind === "curve") {
          globalThis.curveVertex(...v.args);
        } else {
          globalThis.vertex(...v.args);
        }
      }
      if (this._closeMode === null) {
        globalThis.endShape();
      } else {
        globalThis.endShape(this._closeMode);
      }
    }

    _drawPrimitive() {
      const { kind, params } = this._primitive;
      const call = (name) => {
        const fn = globalThis[name];
        if (typeof fn === "function") {
          fn(...params);
        }
      };
      if (kind === globalThis.RECT) call("rect");
      else if (kind === globalThis.ELLIPSE) call("ellipse");
      else if (kind === globalThis.LINE) call("line");
      else if (kind === globalThis.TRIANGLE) call("triangle");
      else if (kind === globalThis.QUAD) call("quad");
      else if (kind === globalThis.ARC) call("arc");
      else if (kind === globalThis.POINT) call("point");
      else if (kind === globalThis.BOX) call("box");
      else if (kind === globalThis.SPHERE) call("sphere");
    }

    // Render at the current origin. w/h are optional sizes from shape().
    _draw(w, h) {
      if (!this._visible) {
        return;
      }
      globalThis.push();
      this._applyTransforms();
      this._applyStyle();
      switch (this._type) {
        case "group":
          for (const child of this._children) {
            child._draw();
          }
          break;
        case "image":
          if (this._image) {
            if (w !== undefined && h !== undefined) {
              globalThis.image(this._image, 0, 0, w, h);
            } else {
              globalThis.image(this._image, 0, 0);
            }
          }
          break;
        case "geometry":
          if (this._geometry && typeof globalThis.model === "function") {
            globalThis.model(this._geometry);
          }
          break;
        case "primitive":
          this._drawPrimitive();
          break;
        default:
          this._drawPath();
          break;
      }
      globalThis.pop();
    }
  };
}

if (!globalThis.createShape) {
  globalThis.createShape = function createShape(kind, ...params) {
    if (kind === undefined) {
      return new globalThis.PShape("path");
    }
    if (kind === globalThis.GROUP) {
      return new globalThis.PShape("group");
    }

    // Vertex-based primitives (POINT/LINE/TRIANGLE/QUAD) are stored as editable
    // vertices so setVertex()/getVertex() behave like in Processing. The size
    // primitives (RECT/ELLIPSE/ARC/BOX/SPHERE) stay parameter-based.
    let beginKind = null;
    let close = false;
    let isVertexPrimitive = true;
    if (kind === globalThis.POINT) {
      beginKind = globalThis.POINTS;
    } else if (kind === globalThis.LINE) {
      beginKind = globalThis.LINES;
    } else if (kind === globalThis.TRIANGLE) {
      close = true;
    } else if (kind === globalThis.QUAD) {
      close = true;
    } else {
      isVertexPrimitive = false;
    }

    if (isVertexPrimitive) {
      const shape = new globalThis.PShape("path");
      shape._beginKind = beginKind;
      shape._closeMode = close ? globalThis.CLOSE ?? "close" : null;
      for (let i = 0; i + 1 < params.length; i += 2) {
        shape._vertices.push({ kind: "vertex", args: [params[i], params[i + 1]] });
      }
      return shape;
    }

    const shape = new globalThis.PShape("primitive");
    shape._primitive = { kind, params };
    return shape;
  };
}

if (!globalThis.loadShape) {
  globalThis.loadShape = async function loadShape(path) {
    const lower = String(path).toLowerCase();
    if (lower.endsWith(".obj") || lower.endsWith(".stl")) {
      const shape = new globalThis.PShape("geometry");
      if (typeof globalThis.loadModel === "function") {
        shape._geometry = await globalThis.loadModel(path);
      }
      return shape;
    }
    // SVG and other raster formats: load as an image and draw with image().
    const shape = new globalThis.PShape("image");
    const img = await globalThis.loadImage(path);
    shape._image = img;
    shape.width = img && img.width ? img.width : 0;
    shape.height = img && img.height ? img.height : 0;
    return shape;
  };
}

if (!globalThis.shapeMode) {
  globalThis.shapeMode = function shapeMode(mode) {
    globalThis.__p5forgeShapeMode = mode;
  };
}

if (!globalThis.shape) {
  globalThis.shape = function shape(sh, x = 0, y = 0, w, h) {
    if (!sh || typeof sh._draw !== "function") {
      return;
    }
    globalThis.push();
    const mode = globalThis.__p5forgeShapeMode;
    if (mode === globalThis.CENTER && w !== undefined && h !== undefined) {
      globalThis.translate(x - w / 2, y - h / 2);
    } else if (mode === globalThis.CORNERS && w !== undefined && h !== undefined) {
      // Treat (x, y) and (w, h) as opposite corners.
      globalThis.translate(x, y);
      w = w - x;
      h = h - y;
    } else {
      globalThis.translate(x, y);
    }
    sh._draw(w, h);
    globalThis.pop();
  };
}
