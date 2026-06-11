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
