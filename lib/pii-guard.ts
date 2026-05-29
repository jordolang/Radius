/**
 * pii-guard.ts — Keep personal info out of chat.
 *
 * "No personal information is ever shared" can't be guaranteed (people can type
 * anything), but we can detect the common identifiers and warn/redact before a
 * message sends — phone numbers, emails, social handles, links, and street
 * addresses. This protects the anonymity the pseudonym system establishes.
 *
 * Default posture is WARN (let adults decide), with an option to hard-block
 * specific high-risk categories. We do not silently log message content.
 */

export type PiiKind = "phone" | "email" | "handle" | "url" | "address";

export interface PiiFinding {
  kind: PiiKind;
  match: string;
  index: number;
}

const PATTERNS: { kind: PiiKind; re: RegExp }[] = [
  { kind: "email", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
  // phone: 10+ digit sequences allowing spaces, dashes, parens, dots, +cc
  { kind: "phone", re: /(?:\+?\d[\s().-]?){9,}\d/g },
  { kind: "url", re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { kind: "handle", re: /(?<![A-Z0-9])@[A-Z0-9_.]{2,}\b/gi },
  // crude street-address heuristic: number + street-type word
  {
    kind: "address",
    re: /\b\d{1,6}\s+([A-Z][a-z]+\s){0,3}(St|Street|Ave|Avenue|Blvd|Rd|Road|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place)\b/gi,
  },
];

export function scanForPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];
  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      findings.push({ kind, match: m[0], index: m.index });
      if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

export function hasPii(text: string): boolean {
  return scanForPii(text).length > 0;
}

/** Replace detected PII with a placeholder so a message can still send safely. */
export function redactPii(text: string): { redacted: string; findings: PiiFinding[] } {
  const findings = scanForPii(text);
  let redacted = text;
  // redact right-to-left so indices stay valid
  for (const f of [...findings].sort((a, b) => b.index - a.index)) {
    redacted =
      redacted.slice(0, f.index) +
      `[${f.kind} hidden]` +
      redacted.slice(f.index + f.match.length);
  }
  return { redacted, findings };
}

/** Categories we recommend hard-blocking vs. merely warning on. */
export const HARD_BLOCK: ReadonlySet<PiiKind> = new Set(["address"]);

export function shouldBlock(findings: PiiFinding[]): boolean {
  return findings.some((f) => HARD_BLOCK.has(f.kind));
}
