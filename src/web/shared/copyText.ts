type ClipboardLike = {
  writeText?: (text: string) => Promise<void>;
};

type FocusableLike = {
  focus?: () => void;
};

type TextAreaLike = FocusableLike & {
  value: string;
  style: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
  select: () => void;
  setSelectionRange?: (start: number, end: number) => void;
  remove: () => void;
};

type DocumentLike = {
  activeElement?: FocusableLike | null;
  body?: {
    appendChild: (node: TextAreaLike) => void;
  } | null;
  createElement?: (tagName: string) => TextAreaLike;
  execCommand?: (commandId: string) => boolean;
};

export interface CopyTextEnvironment {
  navigator?: {
    clipboard?: ClipboardLike;
  };
  document?: DocumentLike;
}

function isTextareaLike(node: unknown): node is TextAreaLike {
  return Boolean(
    node &&
      typeof node === 'object' &&
      'setAttribute' in node &&
      'select' in node &&
      'remove' in node &&
      'style' in node
  );
}

function createFallbackTextarea(doc: DocumentLike, text: string): TextAreaLike | null {
  if (!doc.body || !doc.createElement) {
    return null;
  }

  const textarea = doc.createElement('textarea');
  if (!isTextareaLike(textarea)) {
    return null;
  }

  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  doc.body.appendChild(textarea);
  return textarea;
}

function copyTextWithExecCommand(text: string, env: CopyTextEnvironment): boolean {
  const doc = env.document;
  if (!doc?.execCommand) {
    return false;
  }

  const textarea = createFallbackTextarea(doc, text);
  if (!textarea) {
    return false;
  }

  const activeElement = doc.activeElement;
  try {
    textarea.select();
    textarea.setSelectionRange?.(0, text.length);
    return doc.execCommand('copy') === true;
  } finally {
    textarea.remove();
    activeElement?.focus?.();
  }
}

export async function copyText(
  text: string,
  env: CopyTextEnvironment = globalThis as CopyTextEnvironment
): Promise<boolean> {
  if (!text) {
    return false;
  }

  try {
    const clipboard = env.navigator?.clipboard;
    if (clipboard?.writeText) {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below.
  }

  return copyTextWithExecCommand(text, env);
}
