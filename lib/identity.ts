/**
 * identity.ts — Pseudonymous identity.
 *
 * Rules:
 *  - There is NO real-name field anywhere in the system. Not optional, not
 *    private, not "for verification" — it simply does not exist as storable data.
 *    (Age verification happens at signup and is discarded; it never becomes a
 *    stored name attached to the profile.)
 *  - At signup the user is offered 10 randomly drawn aliases and picks one.
 *  - Aliases are unique per active user so two people can't be confused.
 *
 * This is what makes blackmail/shaming structurally hard: there is no real
 * identity in the record to leak in the first place.
 */

export type Alias = string;

// A tasteful, masquerade-themed pool. Expand freely; keep it non-crude.
const ALIAS_POOL: readonly Alias[] = [
  "Velvet", "Cinder", "Marlowe", "Lux", "Sable", "Renn", "Onyx", "Vesper",
  "Juno", "Cael", "Wren", "Faye", "Dax", "Lyra", "Sol", "Nox", "Indigo",
  "Bryn", "Ash", "Rune", "Vale", "Echo", "Sage", "Kit", "Mirth", "Quill",
  "Halcyon", "Ember", "Frost", "Lark", "Nyx", "Orin", "Pax", "Reverie",
  "Saint", "Tindra", "Vivienne", "Wilder", "Zephyr", "Cosima",
];

export interface AliasOffer {
  userId: string;
  choices: Alias[]; // exactly 10
  createdAt: number;
}

function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Offer 10 aliases not currently taken by an active user.
 * `taken` is the set of aliases in use right now.
 */
export function offerAliases(
  userId: string,
  taken: ReadonlySet<Alias>,
  rnd: () => number = Math.random,
): AliasOffer {
  const available = ALIAS_POOL.filter((a) => !taken.has(a));
  if (available.length < 10) {
    // Pool exhausted: append a discreet numeric suffix to keep uniqueness.
    const padded = [...available];
    let n = 1;
    while (padded.length < 10) {
      for (const base of ALIAS_POOL) {
        const candidate = `${base}-${n}`;
        if (!taken.has(candidate) && !padded.includes(candidate)) padded.push(candidate);
        if (padded.length >= 10) break;
      }
      n++;
    }
    return { userId, choices: shuffle(padded, rnd).slice(0, 10), createdAt: Date.now() };
  }
  return { userId, choices: shuffle(available, rnd).slice(0, 10), createdAt: Date.now() };
}

/** Validate a user's pick against the offer + current availability. */
export function claimAlias(
  offer: AliasOffer,
  pick: Alias,
  taken: ReadonlySet<Alias>,
): { ok: true; alias: Alias } | { ok: false; reason: string } {
  if (!offer.choices.includes(pick)) {
    return { ok: false, reason: "alias was not one of the offered choices" };
  }
  if (taken.has(pick)) {
    return { ok: false, reason: "alias just got taken — pick another" };
  }
  return { ok: true, alias: pick };
}

/** Defense-in-depth: reject any attempt to set a free-text display name. */
export function isAllowedDisplayName(name: string, validAliases: ReadonlySet<Alias>): boolean {
  return validAliases.has(name);
}
