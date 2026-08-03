export class JobGate {
  #maxConcurrent;
  #maxQueued;
  #running = new Set();
  #queued = [];

  constructor({ maxConcurrent, maxQueued }) {
    if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent <= 0)
      throw new Error("maxConcurrent must be a positive integer");
    if (!Number.isSafeInteger(maxQueued) || maxQueued <= 0) throw new Error("maxQueued must be a positive integer");
    this.#maxConcurrent = maxConcurrent;
    this.#maxQueued = maxQueued;
  }

  get snapshot() {
    return {
      maxConcurrent: this.#maxConcurrent,
      maxQueued: this.#maxQueued,
      running: [...this.#running],
      queued: this.#queued.map((item) => item.id),
    };
  }

  acquire(id) {
    if (this.#running.has(id) || this.#queued.some((item) => item.id === id))
      throw new Error(`Job is already registered: ${id}`);
    if (this.#running.size < this.#maxConcurrent) {
      this.#running.add(id);
      return Promise.resolve();
    }
    if (this.#queued.length >= this.#maxQueued) throw new Error("Studio task queue is full");
    return new Promise((resolveAcquire, rejectAcquire) => {
      this.#queued.push({ id, resolveAcquire, rejectAcquire });
    });
  }

  cancel(id) {
    const index = this.#queued.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const [entry] = this.#queued.splice(index, 1);
    entry.rejectAcquire(new Error("Queued job was cancelled"));
    return true;
  }

  release(id) {
    if (!this.#running.delete(id)) return false;
    const next = this.#queued.shift();
    if (next) {
      this.#running.add(next.id);
      next.resolveAcquire();
    }
    return true;
  }
}
