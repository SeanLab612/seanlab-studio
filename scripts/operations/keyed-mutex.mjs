export class KeyedMutex {
  #tails = new Map();

  run(key, operation) {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    this.#tails.set(key, current);
    return current.finally(() => {
      if (this.#tails.get(key) === current) this.#tails.delete(key);
    });
  }
}
