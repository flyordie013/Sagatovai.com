import { Fragment } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal formatter for owner-typed text (lesson materials).
 *
 * Supports exactly three things, all typed by hand without any markup:
 *   - blank line          → new paragraph
 *   - line starting with «- », «* » or «• » → bullet list item
 *   - bare http(s) link   → clickable link
 *
 * Everything is built as React elements — no `dangerouslySetInnerHTML`, so text
 * pasted from anywhere can never become HTML or a script. Anything that isn't
 * one of the three rules above stays plain text, line breaks included.
 */

const URL_RE = /(https?:\/\/[^\s<>()[\]]+)/g;
const BULLET_RE = /^\s*[-*•]\s+/;

/** Trailing «.,;:!?» usually belongs to the sentence, not to the URL. */
function splitTrailingPunctuation(url: string): [string, string] {
  const m = url.match(/[.,;:!?]+$/);
  return m ? [url.slice(0, -m[0].length), m[0]] : [url, ""];
}

/** Turns bare links inside one line into <a> elements. */
function linkify(line: string, keyPrefix: string): ReactNode[] {
  return line.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={`${keyPrefix}-t${i}`}>{part}</Fragment>;
    const [href, tail] = splitTrailingPunctuation(part);
    return (
      <Fragment key={`${keyPrefix}-l${i}`}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="break-all text-gold underline underline-offset-2 hover:text-gold-soft"
        >
          {href}
        </a>
        {tail}
      </Fragment>
    );
  });
}

type Block = { kind: "p" | "ul"; lines: string[] };

/** Groups raw lines into paragraphs and bullet lists. */
function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ kind: "p", lines: [] }); // blank line breaks the current block
      continue;
    }
    const bullet = BULLET_RE.test(line);
    const kind: Block["kind"] = bullet ? "ul" : "p";
    const last = blocks[blocks.length - 1];
    const value = bullet ? line.replace(BULLET_RE, "") : line;
    if (last && last.kind === kind && last.lines.length > 0) last.lines.push(value);
    else blocks.push({ kind, lines: [value] });
  }
  return blocks.filter((b) => b.lines.length > 0);
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = toBlocks(text ?? "");
  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-2.5 break-words text-sm leading-relaxed", className)}>
      {blocks.map((b, bi) =>
        b.kind === "ul" ? (
          <ul key={bi} className="list-disc space-y-1 pl-5">
            {b.lines.map((line, li) => (
              <li key={li}>{linkify(line, `${bi}-${li}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={bi}>
            {b.lines.map((line, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {linkify(line, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
