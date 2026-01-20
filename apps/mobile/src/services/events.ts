/**
 * Simple event emitter for app-wide events
 */

type EventCallback = () => void;

const listeners: Map<string, Set<EventCallback>> = new Map();

export const AppEvents = {
  DATA_CHANGED: 'data_changed',
};

export function subscribe(event: string, callback: EventCallback): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback);

  // Return unsubscribe function
  return () => {
    listeners.get(event)?.delete(callback);
  };
}

export function emit(event: string): void {
  console.log(`[Events] Emitting: ${event}`);
  listeners.get(event)?.forEach((callback) => callback());
}

// Convenience object for event emitter pattern
export const eventEmitter = {
  emit,
  subscribe,
};
