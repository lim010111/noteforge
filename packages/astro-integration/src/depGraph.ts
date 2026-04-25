/**
 * Bidirectional dependency map for the vault watcher.
 *
 * Forward: "A depends on B" — A's outgoing wiki/embed links.
 * Reverse: "A is a dependent of B" — answers "who must re-render when B changes?"
 * in O(1). Both maps are kept in lock-step so invalidation never misses edges.
 *
 * Framework-independent. No fs / chokidar / Astro imports by design.
 */

export interface DepGraph {
  /** Replace `noteId`'s outgoing deps with `dependsOn`. Prunes stale forward/reverse entries. */
  setDeps(noteId: string, dependsOn: Iterable<string>): void;
  /** Delete `noteId`'s forward entry and prune `noteId` from the reverse sets of its former deps.
   *  Incoming reverse entries (X → noteId) are preserved so the watcher can still invalidate X
   *  when noteId reappears. */
  removeNote(noteId: string): void;
  /** Ids `noteId` currently depends on. Returns a defensive copy; not mutable by caller. */
  depsOf(noteId: string): ReadonlySet<string>;
  /** Ids that currently depend on `noteId` (re-render targets). Defensive copy. */
  dependentsOf(noteId: string): ReadonlySet<string>;
  /** True if any forward or reverse entry tracks `noteId`. */
  has(noteId: string): boolean;
}

export function createDepGraph(): DepGraph {
  const forward = new Map<string, Set<string>>();
  const reverse = new Map<string, Set<string>>();

  function dropFromReverse(dep: string, noteId: string): void {
    const set = reverse.get(dep);
    if (!set) return;
    set.delete(noteId);
    if (set.size === 0) reverse.delete(dep);
  }

  function addToReverse(dep: string, noteId: string): void {
    let set = reverse.get(dep);
    if (!set) {
      set = new Set();
      reverse.set(dep, set);
    }
    set.add(noteId);
  }

  return {
    setDeps(noteId, dependsOn) {
      const prev = forward.get(noteId);
      if (prev) {
        for (const oldDep of prev) dropFromReverse(oldDep, noteId);
      }

      const next = new Set(dependsOn);
      if (next.size === 0) {
        forward.delete(noteId);
      } else {
        forward.set(noteId, next);
        for (const dep of next) addToReverse(dep, noteId);
      }
    },

    removeNote(noteId) {
      const outgoing = forward.get(noteId);
      if (outgoing) {
        for (const dep of outgoing) dropFromReverse(dep, noteId);
        forward.delete(noteId);
      }
      // Incoming reverse entries (X → noteId) are intentionally preserved.
    },

    depsOf(noteId) {
      const set = forward.get(noteId);
      return set ? new Set(set) : new Set();
    },

    dependentsOf(noteId) {
      const set = reverse.get(noteId);
      return set ? new Set(set) : new Set();
    },

    has(noteId) {
      return forward.has(noteId) || reverse.has(noteId);
    },
  };
}
