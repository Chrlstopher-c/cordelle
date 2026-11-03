// Notifications éphémères : showToast(texte, { action }) ; chaque toast disparaît seul après 4 s.
import { create } from "zustand";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastItem {
  id: number;
  text: string;
  action?: ToastAction;
}

interface ToastState {
  items: ToastItem[];
  dismiss: (id: number) => void;
}

const LIFETIME_MS = 4000;
let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function showToast(text: string, options: { action?: ToastAction } = {}): void {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items, { id, text, action: options.action }] }));
  window.setTimeout(() => useToasts.getState().dismiss(id), LIFETIME_MS);
}
