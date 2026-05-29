type ToastType = "success" | "error";

export type ToastItem = {
  id: number;
  type: ToastType;
  message: string;
};

type Listener = (toasts: ToastItem[]) => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l([...items]));
}

export const toast = {
  success(message: string) {
    const id = nextId++;
    items = [...items, { id, type: "success", message }];
    notify();
    setTimeout(() => toast.dismiss(id), 4000);
  },
  error(message: string) {
    const id = nextId++;
    items = [...items, { id, type: "error", message }];
    notify();
    setTimeout(() => toast.dismiss(id), 6000);
  },
  dismiss(id: number) {
    items = items.filter((t) => t.id !== id);
    notify();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};
