// Browser polyfill for Node.js AsyncLocalStorage
// This provides a simple implementation that works in browser environments

export class AsyncLocalStorage<T> {
  private storage = new Map<symbol, T>();
  private currentContext: symbol | null = null;

  constructor() {}

  run<R>(store: T, callback: (...args: any[]) => R, ...args: any[]): R {
    const context = Symbol('context');
    const previousContext = this.currentContext;
    
    this.currentContext = context;
    this.storage.set(context, store);
    
    try {
      return callback(...args);
    } finally {
      this.storage.delete(context);
      this.currentContext = previousContext;
    }
  }

  getStore(): T | undefined {
    if (!this.currentContext) return undefined;
    return this.storage.get(this.currentContext);
  }

  exit<R>(callback: (...args: any[]) => R, ...args: any[]): R {
    const previousContext = this.currentContext;
    this.currentContext = null;
    
    try {
      return callback(...args);
    } finally {
      this.currentContext = previousContext;
    }
  }

  enterWith(store: T): void {
    const context = Symbol('context');
    this.currentContext = context;
    this.storage.set(context, store);
  }

  disable(): void {
    this.storage.clear();
    this.currentContext = null;
  }
}

// Polyfill the global object if needed
if (typeof globalThis !== 'undefined' && !globalThis.AsyncLocalStorage) {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage;
}

// Also add to node:async_hooks module mock
if (typeof window !== 'undefined') {
  (window as any).node_async_hooks = { AsyncLocalStorage };
}