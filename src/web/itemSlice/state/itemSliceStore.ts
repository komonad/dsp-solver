export interface ItemSliceOverlayState {
  selectedItemId: string;
  isOpen: boolean;
}

type Listener = () => void;

let currentState: ItemSliceOverlayState = {
  selectedItemId: '',
  isOpen: false,
};

const listeners = new Set<Listener>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(nextState: ItemSliceOverlayState): void {
  if (
    currentState.selectedItemId === nextState.selectedItemId &&
    currentState.isOpen === nextState.isOpen
  ) {
    return;
  }

  currentState = nextState;
  emitChange();
}

export function getItemSliceOverlayState(): ItemSliceOverlayState {
  return currentState;
}

export function subscribeItemSliceOverlay(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openItemSliceOverlay(itemId: string): void {
  if (!itemId) {
    return;
  }

  setState({
    selectedItemId: itemId,
    isOpen: true,
  });
}

export function closeItemSliceOverlay(): void {
  if (!currentState.selectedItemId && !currentState.isOpen) {
    return;
  }

  setState({
    selectedItemId: currentState.selectedItemId,
    isOpen: false,
  });
}
