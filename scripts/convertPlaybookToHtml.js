#!/usr/bin/env node
/**
 * One-shot tool: converts MIGRATION-PLAYBOOK.md into a self-contained,
 * printable HTML document styled to look like a Word/Pages doc.
 *
 * Usage:  node scripts/convertPlaybookToHtml.js
 * Output: MIGRATION-PLAYBOOK.html (in repo root)
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC = path.join(REPO_ROOT, 'MIGRATION-PLAYBOOK.md');
const OUT = path.join(REPO_ROOT, 'MIGRATION-PLAYBOOK.html');

const markdown = fs.readFileSync(SRC, 'utf8');

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false
});

const body = marked.parse(markdown);

const css = `
  :root {
    --ink: #1c1c1e;
    --muted: #6b7280;
    --accent: #0b5fff;
    --bg: #ffffff;
    --soft: #f5f5f7;
    --border: #e5e7eb;
    --warn: #b45309;
    --warn-bg: #fff7ed;
    --ok: #065f46;
    --code-bg: #0f172a;
    --code-ink: #e2e8f0;
  }
  * { box-sizing: border-box; }
  html, body { background: var(--bg); color: var(--ink); }
  body {
    font-family: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
    font-size: 14.5px;
    line-height: 1.6;
    max-width: 820px;
    margin: 48px auto;
    padding: 0 32px 64px;
  }
  h1, h2, h3, h4 {
    font-family: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
    color: var(--ink);
    line-height: 1.25;
    letter-spacing: -0.01em;
  }
  h1 { font-size: 30px; margin: 40px 0 8px; border-bottom: 2px solid var(--ink); padding-bottom: 10px; }
  h2 { font-size: 22px; margin: 44px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  h3 { font-size: 17px; margin: 28px 0 8px; }
  h4 { font-size: 15px; margin: 20px 0 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  p { margin: 10px 0; }
  strong { color: var(--ink); }
  em { color: var(--muted); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 0.88em;
    background: var(--soft);
    padding: 1px 5px;
    border-radius: 4px;
  }
  pre {
    background: var(--code-bg);
    color: var(--code-ink);
    padding: 14px 16px;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 12.5px;
    line-height: 1.5;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  blockquote {
    border-left: 4px solid var(--accent);
    background: var(--soft);
    padding: 10px 16px;
    margin: 16px 0;
    color: var(--ink);
  }
  ul, ol { padding-left: 22px; margin: 10px 0; }
  li { margin: 4px 0; }
  li > input[type="checkbox"] {
    margin-right: 8px;
    transform: translateY(1px);
    accent-color: var(--accent);
  }
  hr { border: none; border-top: 1px solid var(--border); margin: 36px 0; }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 16px 0;
    font-size: 13.5px;
  }
  th, td {
    border: 1px solid var(--border);
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  th { background: var(--soft); font-weight: 600; }
  /* Emoji-anchored callouts: approximations of the 🔵/⚠️ markers feel */
  p:has(strong:first-child):where(:has(strong:contains("GOTCHA"))) { }
  /* Print tuning */
  @media print {
    body { max-width: 100%; margin: 0; padding: 24px; font-size: 11.5pt; }
    h1 { page-break-before: auto; }
    h2 { page-break-after: avoid; }
    pre, blockquote, table { page-break-inside: avoid; }
    a { color: var(--ink); }
  }
`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CHS Infrastructure Migration Playbook</title>
    <style>${css}</style>
  </head>
  <body>
    ${body}
  </body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`Wrote ${OUT} (${(html.length / 1024).toFixed(1)} KB)`);
