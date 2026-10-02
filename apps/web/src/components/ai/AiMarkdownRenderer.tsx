'use client';

import React, { useState } from 'react';

interface AiMarkdownRendererProps {
  content: string;
}

export function AiMarkdownRenderer({ content }: AiMarkdownRendererProps) {
  if (!content) return null;

  // Split content by code blocks first
  const parts = parseMarkdownBlocks(content);

  return (
    <div className="text-zinc-800 dark:text-zinc-200 text-xs sm:text-[13px] leading-relaxed space-y-2.5 break-words">
      {parts.map((part, idx) => {
        if (part.type === 'code') {
          return <CodeSnippet key={idx} language={part.language} code={part.code} />;
        }
        if (part.type === 'table') {
          return <TableBlock key={idx} rows={part.rows} />;
        }
        if (part.type === 'heading') {
          return <HeadingBlock key={idx} level={part.level} text={part.text} />;
        }
        if (part.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="my-2 border-l-3 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 pl-3 pr-2 py-1.5 rounded-r text-zinc-700 dark:text-zinc-300 italic text-xs"
            >
              <InlineText text={part.text} />
            </blockquote>
          );
        }
        if (part.type === 'list') {
          return (
            <ul key={idx} className="list-disc pl-4 space-y-1 text-zinc-700 dark:text-zinc-300">
              {part.items.map((item, itemIdx) => (
                <li key={itemIdx} className="leading-relaxed">
                  <InlineText text={item} />
                </li>
              ))}
            </ul>
          );
        }
        if (part.type === 'divider') {
          return <hr key={idx} className="my-3 border-zinc-200 dark:border-zinc-800" />;
        }
        // Normal paragraph
        return (
          <p key={idx} className="leading-relaxed">
            <InlineText text={part.text} />
          </p>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// INLINE TEXT FORMATTER (Bold, Italic, Code, Links)
// -----------------------------------------------------------------------------
function InlineText({ text }: { text: string }) {
  if (!text) return null;

  // Split by inline code: `code`
  const codeParts = text.split(/(`[^`]+`)/g);

  return (
    <>
      {codeParts.map((segment, i) => {
        if (segment.startsWith('`') && segment.endsWith('`') && segment.length >= 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold"
            >
              {segment.slice(1, -1)}
            </code>
          );
        }

        // Parse bold: **text**
        const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
        return (
          <React.Fragment key={i}>
            {boldParts.map((sub, j) => {
              if (sub.startsWith('**') && sub.endsWith('**') && sub.length >= 4) {
                return (
                  <strong key={j} className="font-bold text-zinc-950 dark:text-white">
                    {sub.slice(2, -2)}
                  </strong>
                );
              }
              // Parse italic: *text* or _text_
              const italicParts = sub.split(/(\*[^*]+\*)/g);
              return (
                <React.Fragment key={j}>
                  {italicParts.map((italicSub, k) => {
                    if (italicSub.startsWith('*') && italicSub.endsWith('*') && italicSub.length >= 2) {
                      return <em key={k}>{italicSub.slice(1, -1)}</em>;
                    }
                    return italicSub;
                  })}
                </React.Fragment>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

// -----------------------------------------------------------------------------
// CODE SNIPPET BLOCK WITH COPY BUTTON
// -----------------------------------------------------------------------------
function CodeSnippet({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="relative my-2.5 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 text-xs font-mono shadow-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] text-zinc-400">
        <span className="font-semibold uppercase tracking-wider text-zinc-300">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer text-[10px]"
        >
          {copied ? (
            <>
              <span className="text-emerald-400 font-bold">✓</span>
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto overflow-y-auto max-h-96">
        <pre className="leading-relaxed whitespace-pre font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TABLE BLOCK COMPONENT
// -----------------------------------------------------------------------------
function TableBlock({ rows }: { rows: string[][] }) {
  if (!rows || rows.length === 0) return null;
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  return (
    <div className="my-2.5 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-xs border-collapse divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-100/90 dark:bg-zinc-800/70 font-semibold text-zinc-950 dark:text-zinc-100">
          <tr>
            {headerRow.map((cell, idx) => (
              <th key={idx} className="px-3 py-2 text-[11px] uppercase tracking-wider font-bold">
                <InlineText text={cell.trim()} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900/40">
          {bodyRows.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                  <InlineText text={cell.trim()} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// HEADING BLOCK COMPONENT
// -----------------------------------------------------------------------------
function HeadingBlock({ level, text }: { level: number; text: string }) {
  if (level === 1) {
    return (
      <h1 className="text-base font-bold text-zinc-950 dark:text-white mt-4 mb-2">
        <InlineText text={text} />
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 className="text-sm font-bold text-zinc-900 dark:text-white mt-3 pb-1 border-b border-zinc-200 dark:border-zinc-800">
        <InlineText text={text} />
      </h2>
    );
  }
  return (
    <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-2">
      <InlineText text={text} />
    </h3>
  );
}

// -----------------------------------------------------------------------------
// BLOCK PARSER LOGIC
// -----------------------------------------------------------------------------
type ParsedBlock =
  | { type: 'code'; language: string; code: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'heading'; level: number; text: string }
  | { type: 'quote'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'divider' }
  | { type: 'paragraph'; text: string };

function parseMarkdownBlocks(markdown: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code block fence: ```
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        language,
        code: codeLines.join('\n'),
      });
      i++;
      continue;
    }

    // 2. Table row starting with |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        const rowLine = lines[i].trim();
        // Check if this is a separator row like |---|---|
        const isSeparator = /^\|(\s*:?-+:?\s*\|)+$/.test(rowLine);
        if (!isSeparator) {
          const cells = rowLine
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());
          tableRows.push(cells);
        }
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push({ type: 'table', rows: tableRows });
      }
      continue;
    }

    // 3. Headings: #, ##, ###
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,3})\s+(.*)$/);
      if (match) {
        blocks.push({
          type: 'heading',
          level: match[1].length,
          text: match[2],
        });
        i++;
        continue;
      }
    }

    // 4. Blockquotes: >
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      blocks.push({ type: 'quote', text: quoteText });
      i++;
      continue;
    }

    // 5. Divider: ---
    if (trimmed === '---' || trimmed === '***') {
      blocks.push({ type: 'divider' });
      i++;
      continue;
    }

    // 6. Bullet lists: * or -
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // 7. Regular paragraph / text
    if (trimmed) {
      blocks.push({ type: 'paragraph', text: trimmed });
    }

    i++;
  }

  return blocks;
}

