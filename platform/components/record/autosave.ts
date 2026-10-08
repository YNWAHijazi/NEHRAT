'use client';

/**
 * Save on Next (owner, 8 October 2026): moving between steps saves whatever was typed on
 * the step being left, so nobody has to press Save and then Next. Each editable form on
 * the record page registers a "save if changed" function against its root element; the
 * stepper (and Save draft) asks every form inside a container to save before it moves.
 * A save that is refused keeps the person on the step, with the reason on the form.
 */

type SaveIfDirty = () => Promise<boolean>;

const registry = new Map<HTMLElement, SaveIfDirty>();

export function registerAutosave(el: HTMLElement, save: SaveIfDirty): () => void {
  registry.set(el, save);
  return () => { registry.delete(el); };
}

/** Saves every changed form inside the container. True when all saved (or nothing had changed). */
export async function saveDirtyIn(container: ParentNode | null): Promise<boolean> {
  if (!container) return true;
  const pending: Promise<boolean>[] = [];
  for (const [el, save] of registry) if (el.isConnected && container.contains(el)) pending.push(save());
  const results = await Promise.all(pending);
  return results.every(Boolean);
}
