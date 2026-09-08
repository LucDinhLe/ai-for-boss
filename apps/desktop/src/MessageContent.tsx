import { createElement, useMemo, type ReactNode } from "react";

// A deliberately small presentation grammar, not a full CommonMark parser.
// Source fragments remain React text. Public source links require an explicit
// host callback and a user click; no HTML, image or automatic network request.
type OpenUrl = (url: string) => void;
function publicMessageUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || value.length > 4096) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!host.includes('.') || /(^|\.)(localhost|local|internal|localdomain|home|lan)$/.test(host)) return null;
    // Literals, including alternate numeric spellings normalized by URL, go
    // through the browser's network policy instead of becoming chat actions.
    if (host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host)) return null;
    return url.href;
  } catch { return null; }
}
function inline(text: string, insideStrong = false, onOpenUrl?: OpenUrl): ReactNode[] {
  const token = insideStrong ? /`([^`\n]+)`/g : /`([^`\n]+)`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(token)) {
    result.push(text.slice(cursor, match.index));
    const url = match[4] && onOpenUrl ? publicMessageUrl(match[5]) : null;
    result.push(match[4] !== undefined
      ? url ? <button type="button" className="message-content__link" key={match.index} title={url}
        aria-label={`Mở ${match[4]} trên web`} onClick={() => onOpenUrl?.(url)}>{match[4]}</button> : match[0]
      : match[1] !== undefined
      ? <code key={match.index}>{match[1]}</code>
      : <strong key={match.index}>{inline(match[2] ?? match[3], true, onOpenUrl)}</strong>);
    cursor = match.index + match[0].length;
  }
  result.push(text.slice(cursor));
  return result;
}

function tableCells(line: string): string[] | null {
  let value = line.trim();
  if (!value.includes("|")) return null;
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);
  const cells = [""];
  let code = false;
  for (let i = 0; i < value.length; i += 1) {
    const character = value[i];
    if (character === "\\" && (value[i + 1] === "|" || value[i + 1] === "\\")) {
      cells[cells.length - 1] += value[++i];
    } else if (character === "|" && !code) {
      cells.push("");
    } else {
      if (character === "`") code = !code;
      cells[cells.length - 1] += character;
    }
  }
  return !code && cells.length >= 2 ? cells.map((cell) => cell.trim()) : null;
}

const heading = (line: string) => /^(#{1,6})[ \t]+(.+)$/.exec(line);
const fence = (line: string) => /^ {0,3}(`{3,}|~{3,})([^`]*)$/.exec(line);
const listItem = (line: string) => /^(?:([-+*])|(\d{1,9})[.)])[ \t]+(.+)$/.exec(line);
function tableHeader(lines: string[], index: number) {
  const cells = tableCells(lines[index]);
  const separator = tableCells(lines[index + 1] ?? "");
  return cells && separator && cells.length === separator.length
    && separator.every((cell) => /^:?-{3,}:?$/.test(cell)) ? cells : null;
}

function blocks(content: string, onOpenUrl?: OpenUrl): ReactNode[] {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const result: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const start = index;
    const line = lines[index];
    const opening = fence(line);
    if (opening) {
      const body: string[] = [];
      index += 1;
      const closing = new RegExp(`^ {0,3}${opening[1][0]}{${opening[1].length},}[ \\t]*$`);
      while (index < lines.length && !closing.test(lines[index])) body.push(lines[index++]);
      if (index < lines.length) index += 1;
      result.push(<pre className="message-content__code" key={start}><code>{body.join("\n")}</code></pre>);
      continue;
    }
    const title = heading(line);
    if (title) {
      result.push(createElement(`h${title[1].length}`, { key: start }, inline(title[2], false, onOpenUrl)));
      index += 1;
      continue;
    }
    const header = tableHeader(lines, index);
    if (header) {
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length) {
        const row = tableCells(lines[index]);
        if (!row || row.length !== header.length) break;
        rows.push(row);
        index += 1;
      }
      result.push(<div className="message-content__table-wrap" key={start}>
        <table className="message-content__table"><thead><tr>
          {header.map((cell, column) => <th scope="col" key={column}>{inline(cell, false, onOpenUrl)}</th>)}
        </tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>
          {row.map((cell, column) => <td key={column}>{inline(cell, false, onOpenUrl)}</td>)}
        </tr>)}</tbody></table>
      </div>);
      continue;
    }
    const firstItem = listItem(line);
    if (firstItem) {
      const ordered = firstItem[2] !== undefined;
      const items: ReactNode[] = [];
      while (index < lines.length) {
        if (!lines[index].trim()) {
          let next = index + 1;
          while (next < lines.length && !lines[next].trim()) next += 1;
          const nextItem = listItem(lines[next] ?? '');
          if (!nextItem || (nextItem[2] !== undefined) !== ordered) break;
          index = next;
        }
        const item = listItem(lines[index]);
        if (!item || (item[2] !== undefined) !== ordered) break;
        items.push(<li key={index}>{inline(item[3], false, onOpenUrl)}</li>);
        index += 1;
      }
      result.push(ordered ? <ol start={Number(firstItem[2])} key={start}>{items}</ol>
        : <ul key={start}>{items}</ul>);
      continue;
    }
    if (!line.trim()) {
      // Prose spacing belongs to the block layout. Blank lines inside fenced
      // code are handled above and remain literal.
      index += 1;
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "" && !fence(lines[index])
      && !heading(lines[index]) && !listItem(lines[index]) && !tableHeader(lines, index)) {
      paragraph.push(lines[index++]);
    }
    result.push(<p className="message-content__paragraph" style={{ whiteSpace: "pre-wrap" }} key={start}>
      {inline(paragraph.join("\n"), false, onOpenUrl)}
    </p>);
  }
  return result;
}

export default function MessageContent({ content, onOpenUrl }: { content: string; onOpenUrl?: OpenUrl }) {
  const rendered = useMemo(() => content ? blocks(content, onOpenUrl) : null, [content, onOpenUrl]);
  return <div className="message-content">{rendered}</div>;
}
