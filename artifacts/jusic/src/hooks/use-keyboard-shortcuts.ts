import { useEffect, useCallback, useRef } from "react";

export interface ShortcutDefinition {
  /** Key name as returned by KeyboardEvent.key (case-insensitive). */
  key: string;
  /**
   * When true the shortcut fires on Cmd (Mac) OR Ctrl (Win/Linux).
   * This is the standard cross-platform modifier for app-level commands.
   */
  cmdOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  /**
   * When true (default) the handler is suppressed while the user is typing
   * in an <input>, <textarea>, <select>, or contentEditable element.
   */
  ignoreWhenTyping?: boolean;
  handler: (e: KeyboardEvent) => void;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

/**
 * Registers global keyboard shortcuts for the lifetime of the calling component.
 *
 * @example
 * useKeyboardShortcuts([
 *   { key: "k", cmdOrCtrl: true, handler: () => focusSearch() },
 *   { key: " ", ignoreWhenTyping: true, handler: () => togglePlay() },
 *   { key: "s", cmdOrCtrl: true, handler: (e) => { e.preventDefault(); save(); } },
 * ]);
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[]): void {
  // Keep shortcuts in a ref so the event listener closure always sees the latest
  // handlers without needing to re-register the listener on every render.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    for (const shortcut of shortcutsRef.current) {
      const {
        key,
        cmdOrCtrl = false,
        shift = false,
        alt = false,
        ignoreWhenTyping = true,
        handler,
      } = shortcut;

      if (e.key.toLowerCase() !== key.toLowerCase()) continue;
      if (cmdOrCtrl && !(e.metaKey || e.ctrlKey)) continue;
      if (!cmdOrCtrl && (e.metaKey || e.ctrlKey)) continue;
      if (shift !== e.shiftKey) continue;
      if (alt !== e.altKey) continue;

      if (ignoreWhenTyping && isTypingTarget(document.activeElement)) continue;

      e.preventDefault();
      handler(e);
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
