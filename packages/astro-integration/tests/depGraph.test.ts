/**
 * Tests for @obpub/astro dep-graph.
 *
 * The graph tracks forward ("A depends on B") and reverse ("B is depended on by A")
 * edges in lock-step, so the watcher can answer "who must re-render when B changes?"
 * in O(1). These assertions pin down the invariants a watcher relies on; each one
 * is written as "the broken invariant in one sentence" for traceable regressions.
 */

import { describe, expect, it } from 'vitest';
import { createDepGraph } from '../src/depGraph.ts';

describe('createDepGraph', () => {
  it('(1) empty graph returns empty sets and false for unknown ids, without throwing', () => {
    const g = createDepGraph();
    expect(g.depsOf('x').size, 'depsOf on an unknown id must be empty').toBe(0);
    expect(
      g.dependentsOf('x').size,
      'dependentsOf on an unknown id must be empty',
    ).toBe(0);
    expect(g.has('x'), 'has() on an unknown id must be false').toBe(false);
  });

  it('(2) setDeps records forward and reverse edges in lock-step', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B', 'C']);
    expect(
      [...g.depsOf('A')].sort(),
      'forward edges for A must contain exactly B and C',
    ).toEqual(['B', 'C']);
    expect(
      [...g.dependentsOf('B')],
      'reverse edge for B must contain A (the only dependent)',
    ).toEqual(['A']);
    expect(
      [...g.dependentsOf('C')],
      'reverse edge for C must contain A (the only dependent)',
    ).toEqual(['A']);
  });

  it('(3) setDeps called again replaces prior deps — stale reverse entries must be pruned', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B', 'C']);
    g.setDeps('A', ['B', 'D']);
    expect(
      g.dependentsOf('C').has('A'),
      'C was removed from A deps — dependentsOf(C) must no longer contain A (stale reverse leak)',
    ).toBe(false);
    expect(
      [...g.dependentsOf('D')],
      'D is newly a dep of A — dependentsOf(D) must contain exactly A',
    ).toEqual(['A']);
    expect(
      [...g.dependentsOf('B')],
      'B remained a dep of A across both setDeps calls — dependentsOf(B) must still contain A',
    ).toEqual(['A']);
  });

  it('(4) duplicate inputs to setDeps are deduplicated (idempotent)', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B', 'B', 'B']);
    expect(
      g.depsOf('A').size,
      'duplicate deps must be collapsed — depsOf(A) size must be 1',
    ).toBe(1);
    expect(
      g.depsOf('A').has('B'),
      'the single remaining dep of A must be B',
    ).toBe(true);
  });

  it('(5) removeNote drops forward entries and prunes reverse entries of its former deps', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B']);
    g.removeNote('A');
    expect(
      g.depsOf('A').size,
      'after removeNote(A), depsOf(A) must be empty',
    ).toBe(0);
    expect(
      g.dependentsOf('B').has('A'),
      'after removeNote(A), dependentsOf(B) must no longer include A',
    ).toBe(false);
  });

  it('(6) removeNote leaves incoming reverse edges intact — other notes still believe they link it', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B']);
    g.setDeps('C', ['B']);
    g.removeNote('B');
    expect(
      g.depsOf('B').size,
      'after removeNote(B), B has no outgoing deps of its own',
    ).toBe(0);
    expect(
      [...g.depsOf('A')],
      "A's markdown has not been re-parsed — its forward dep on B must remain",
    ).toEqual(['B']);
    expect(
      [...g.depsOf('C')],
      "C's markdown has not been re-parsed — its forward dep on B must remain",
    ).toEqual(['B']);
    expect(
      [...g.dependentsOf('B')].sort(),
      'dependentsOf(B) must still report A and C — those notes still depend on B',
    ).toEqual(['A', 'C']);
  });

  it('(7) self-loop: a note may depend on itself, and removeNote clears both sides', () => {
    const g = createDepGraph();
    g.setDeps('A', ['A']);
    expect(
      [...g.depsOf('A')],
      'self-loop must appear in forward edges as A → A',
    ).toEqual(['A']);
    expect(
      [...g.dependentsOf('A')],
      'self-loop must appear symmetrically in reverse edges as A → A',
    ).toEqual(['A']);
    g.removeNote('A');
    expect(
      g.depsOf('A').size,
      "after removeNote(A) on a self-loop, A's forward side must be empty",
    ).toBe(0);
    expect(
      g.dependentsOf('A').size,
      "after removeNote(A) on a self-loop, A's reverse side must be empty (self-reverse is A's own outgoing edge)",
    ).toBe(0);
  });

  it('(8) cycle A↔B: removeNote(A) prunes A from B’s reverse but preserves B→A stale forward edge', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B']);
    g.setDeps('B', ['A']);
    expect([...g.dependentsOf('A')], 'dependentsOf(A) must be {B}').toEqual(['B']);
    expect([...g.dependentsOf('B')], 'dependentsOf(B) must be {A}').toEqual(['A']);
    g.removeNote('A');
    expect(
      g.dependentsOf('B').has('A'),
      "A's outgoing dep on B was torn down by removeNote — dependentsOf(B) must no longer include A",
    ).toBe(false);
    expect(
      [...g.depsOf('B')],
      "B still believes it depends on A (B has not been re-parsed) — depsOf(B) must still be {A}",
    ).toEqual(['A']);
  });

  it('(9) returned sets are defensive copies — external mutation must not affect internal state', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B']);
    const deps = g.depsOf('A') as Set<string>;
    const dependents = g.dependentsOf('B') as Set<string>;
    deps.clear();
    dependents.clear();
    deps.add('HACKED');
    dependents.add('HACKED');
    expect(
      [...g.depsOf('A')],
      'internal forward set must survive external mutation of a previously returned set (defensive copy)',
    ).toEqual(['B']);
    expect(
      [...g.dependentsOf('B')],
      'internal reverse set must survive external mutation of a previously returned set (defensive copy)',
    ).toEqual(['A']);
  });

  it('(10) has() is true for any node with a forward or reverse entry, false after full removal', () => {
    const g = createDepGraph();
    g.setDeps('A', ['B']);
    expect(g.has('A'), 'A has a forward entry → has(A) must be true').toBe(true);
    expect(g.has('B'), 'B has a reverse entry → has(B) must be true').toBe(true);
    g.removeNote('A');
    expect(
      g.has('A'),
      'after removeNote(A), A has no forward or reverse entries → has(A) must be false',
    ).toBe(false);
    expect(
      g.has('B'),
      'B still has a reverse entry (stale forward edge from A is gone, but B has no other dependents) — but after A removal B has 0 dependents, so reverse entry was pruned → has(B) must be false',
    ).toBe(false);
    g.setDeps('A', ['B']);
    expect(g.has('B'), 're-adding A→B must re-surface B via its reverse entry').toBe(true);
    g.removeNote('B');
    expect(
      g.has('B'),
      'after removeNote(B), B has 0 outgoing deps and A still points at B (reverse retained) → has(B) must be true',
    ).toBe(true);
  });
});
