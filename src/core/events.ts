// Tiny synchronous event bus for audio / UI hooks.
export interface Events {
  'fold:start': { x: number; z: number; size: number };
  'fold:land': { x: number; z: number; size: number };
  'input:first': undefined;
  'step': { x: number; z: number; run: boolean };
  'daynight': { night: boolean };
}

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

class Bus {
  private map = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(name: K, fn: Handler<K>): () => void {
    let set = this.map.get(name);
    if (!set) {
      set = new Set();
      this.map.set(name, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(name, fn);
  }

  once<K extends keyof Events>(name: K, fn: Handler<K>): void {
    const off = this.on(name, (payload) => {
      off();
      fn(payload);
    });
  }

  off<K extends keyof Events>(name: K, fn: Handler<K>): void {
    this.map.get(name)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    const set = this.map.get(name);
    if (!set) return;
    for (const fn of set) (fn as Handler<K>)(payload);
  }
}

export const bus = new Bus();
