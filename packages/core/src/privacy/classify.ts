import picomatch from 'picomatch';
import type { Classification, ClassifyRule, ParsedNote } from '../types.ts';

export function classify(note: ParsedNote, rule: ClassifyRule): Classification {
  const wantsPublic = detectPublicIntent(note, rule);
  const tripwireHit = !rule.unsafeAllowPrivateFolder && matchesTripwire(note.relativePath, rule.tripwirePaths);

  if (tripwireHit && wantsPublic.wants) {
    return {
      isPublic: false,
      tripwireFired: true,
      reason: `tripwire — note is under a blocked path (${note.relativePath}); public marker (${wantsPublic.reason}) ignored`,
    };
  }

  if (!wantsPublic.wants) {
    return {
      isPublic: false,
      tripwireFired: false,
      reason: 'no public marker',
    };
  }

  return {
    isPublic: true,
    tripwireFired: false,
    reason: wantsPublic.reason,
  };
}

interface PublicIntent {
  readonly wants: boolean;
  readonly reason: string;
}

function detectPublicIntent(note: ParsedNote, rule: ClassifyRule): PublicIntent {
  if (note.frontmatter[rule.frontmatterKey] === true) {
    return { wants: true, reason: `frontmatter ${rule.frontmatterKey}: true` };
  }

  const matchingTag = note.tags.find(
    (tag) => tag === rule.publicTag || tag.startsWith(`${rule.publicTag}/`),
  );
  if (matchingTag !== undefined) {
    return { wants: true, reason: `tag #${matchingTag}` };
  }

  return { wants: false, reason: 'no public marker' };
}

function matchesTripwire(relativePath: string, patterns: readonly string[]): boolean {
  if (patterns.length === 0) return false;
  const isMatch = picomatch(patterns as string[]);
  return isMatch(relativePath);
}
