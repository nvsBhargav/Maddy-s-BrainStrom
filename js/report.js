// Card reporting: turn selected cards into TXT, Word (.doc) and PDF files.
// PDF is written by hand (A4, Helvetica) so export works offline with no CDN.

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 56;
const MARGIN_TOP = 792;
const MARGIN_BOTTOM = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const decoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
const byteLength = (s) => (decoder ? decoder.encode(s).length : s.length);

function slug(s) {
  return String(s || "brainvault")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "brainvault";
}

function stripInline(md) {
  return String(md || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "[image: $1]")
    .replace(/\*\*\[([^\]]+)\]\([^)]*\)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Convert card markdown into styled blocks: {kind, text} where kind is
 * 'h1' | 'h2' | 'h3' | 'body' | 'code' | 'table' | 'quote' | 'meta'.
 */
export function markdownToBlocks(md) {
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    blocks.push({ kind: "body", text: buffer.join(" ").replace(/\s+/g, " ").trim() });
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\w*)/);
    if (fence) {
      flush();
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ kind: "code", text: code.join("\n"), lang: fence[1] || "" });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => stripInline(c.trim()));
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells.join("  |  "));
        i++;
      }
      i--;
      blocks.push({ kind: "table", text: rows.join("\n") });
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({ kind: `h${heading[1].length}`, text: stripInline(heading[2]) });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      blocks.push({ kind: "quote", text: stripInline(line.replace(/^\s*>\s?/, "")) });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      blocks.push({ kind: "body", text: `- ${stripInline(line.replace(/^\s*[-*]\s+/, ""))}` });
      continue;
    }
    buffer.push(stripInline(line));
  }
  flush();
  return blocks.filter((b) => b.text);
}

export function buildReport({ workspace, nodes, links = [], generatedAt = new Date() }) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return {
    title: workspace?.name || "BrainVault workspace",
    workspace,
    generatedAt,
    nodes: nodes.map((n) => ({
      title: n.prompt,
      color: n.color,
      tags: n.tags || [],
      images: (n.images || []).map((img) => img.name || "image"),
      body: n.text || "",
      blocks: markdownToBlocks(n.text || ""),
      linksOut: links.filter((l) => l.sourceId === n.id && byId.get(l.targetId)).map((l) => byId.get(l.targetId).prompt),
      linksIn: links.filter((l) => l.targetId === n.id && byId.get(l.sourceId)).map((l) => byId.get(l.sourceId).prompt),
      parent: n.parentId && byId.get(n.parentId) ? byId.get(n.parentId).prompt : "",
    })),
  };
}

export function reportToText(report) {
  const out = [];
  out.push(report.title);
  out.push("=".repeat(Math.min(72, report.title.length || 1)));
  out.push(`Generated ${report.generatedAt.toLocaleString()} · ${report.nodes.length} cards`);
  out.push("");
  report.nodes.forEach((n, i) => {
    out.push(`${i + 1}. ${n.title}`);
    const meta = [];
    if (n.parent) meta.push(`Child of: ${n.parent}`);
    if (n.tags.length) meta.push(`Tags: ${n.tags.join(", ")}`);
    if (n.images.length) meta.push(`Images: ${n.images.join(", ")}`);
    if (meta.length) out.push(meta.join(" · "));
    out.push("-".repeat(Math.min(72, n.title.length + 2)));
    out.push(n.body || "(empty card)");
    if (n.linksOut.length) out.push(`Links to: ${n.linksOut.join("; ")}`);
    if (n.linksIn.length) out.push(`Linked from: ${n.linksIn.join("; ")}`);
    out.push("");
    out.push("");
  });
  return out.join("\n");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function inlineHtml(md) {
  return escapeHtml(md)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<div class="shot"><img src="$2" alt="$1"><span>$1</span></div>')
    .replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

export function reportToHtml(report) {
  const cards = report.nodes
    .map((n) => {
      const body = n.blocks
        .map((b) => {
          const text = inlineHtml(b.text);
          if (b.kind === "code") return `<pre class="code">${text}</pre>`;
          if (b.kind === "table") return `<pre class="table">${text}</pre>`;
          if (b.kind === "quote") return `<blockquote>${text}</blockquote>`;
          if (b.kind.startsWith("h")) return `<${b.kind}>${text}</${b.kind}>`;
          return `<p>${text}</p>`;
        })
        .join("");
      const meta = [
        n.parent ? `Child of ${escapeHtml(n.parent)}` : "",
        n.tags.length ? `Tags: ${n.tags.map(escapeHtml).join(", ")}` : "",
        n.images.length ? `Images: ${n.images.map(escapeHtml).join(", ")}` : "",
        n.linksOut.length ? `Links to: ${n.linksOut.map(escapeHtml).join(", ")}` : "",
      ].filter(Boolean);
      return `<section class="card"><h2 style="border-left:6px solid ${escapeHtml(n.color)}">${escapeHtml(n.title)}</h2>
        ${meta.length ? `<p class="meta">${meta.join(" · ")}</p>` : ""}
        ${body || "<p><em>(empty card)</em></p>"}
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #14201a; font-size: 11pt; line-height: 1.55; }
  h1 { font-size: 24pt; margin: 0 0 4pt; }
  .sub { color: #5b6b62; font-size: 9.5pt; margin-bottom: 18pt; }
  h2 { font-size: 15pt; margin: 20pt 0 6pt; padding-left: 8pt; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  .meta { color: #5b6b62; font-size: 9pt; margin: 0 0 8pt; }
  p { margin: 0 0 8pt; }
  pre.code { background: #0f1a14; color: #b9f6d0; padding: 10pt; font-family: Consolas, monospace; font-size: 9.5pt; white-space: pre-wrap; }
  pre.table { background: #f2f7f3; border-left: 3pt solid #22c55e; padding: 8pt; font-family: Consolas, monospace; font-size: 9pt; white-space: pre-wrap; }
  blockquote { margin: 8pt 0; padding-left: 10pt; border-left: 2pt solid #22c55e; color: #3c5347; }
  code { font-family: Consolas, monospace; color: #0f766e; }
  .shot { margin: 6pt 0; }
  .shot img { max-width: 480pt; }
  .shot span { font-size: 8pt; color: #5b6b62; display: block; }
  section.card { page-break-inside: avoid; }
</style></head>
<body>
<h1>${escapeHtml(report.title)}</h1>
<div class="sub">Exported ${escapeHtml(report.generatedAt.toLocaleString())} · ${report.nodes.length} card${report.nodes.length === 1 ? "" : "s"} · BrainVault</div>
${cards}
</body></html>`;
}

// --- minimal PDF writer ------------------------------------------------------
function pdfText(s) {
  return String(s ?? "")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current.length) current = word;
    else if (current.length + 1 + word.length <= maxChars) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdf(report) {
  const pages = [];
  let ops = [];
  let y = MARGIN_TOP;

  const newPage = () => {
    pages.push(ops.join("\n"));
    ops = [];
    y = MARGIN_TOP;
  };

  const write = (text, size, font, leading, indent = 0) => {
    if (y - leading < MARGIN_BOTTOM) newPage();
    ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${MARGIN_X + indent} ${y} Tm (${pdfText(text)}) Tj ET`);
    y -= leading;
  };

  const paragraph = (text, size = 10.5, font = "F1", leading = 15, indent = 0) => {
    const maxChars = Math.max(24, Math.floor((CONTENT_W - indent) / (size * (font === "F3" ? 0.6 : 0.5))));
    for (const line of wrapLine(text, maxChars)) write(line, size, font, leading, indent);
  };

  paragraph(report.title, 21, "F2", 26);
  paragraph(`Exported ${report.generatedAt.toLocaleString()} - ${report.nodes.length} card${report.nodes.length === 1 ? "" : "s"} - BrainVault`, 9.5, "F1", 16);
  y -= 8;

  report.nodes.forEach((n, i) => {
    if (y - 120 < MARGIN_BOTTOM) newPage();
    write(`${i + 1}. ${n.title}`, 13.5, "F2", 19);
    const meta = [
      n.parent ? `Child of ${n.parent}` : "",
      n.tags.length ? `Tags: ${n.tags.join(", ")}` : "",
      n.images.length ? `Images: ${n.images.join(", ")}` : "",
    ].filter(Boolean);
    if (meta.length) paragraph(meta.join("  |  "), 8.5, "F1", 13);
    y -= 3;
    if (!n.blocks.length) {
      write("(empty card)", 10.5, "F1", 15);
    }
    for (const b of n.blocks) {
      if (b.kind === "code") {
        const lines = b.text.split("\n").slice(0, 80);
        for (const line of lines) paragraph(line || " ", 8.8, "F3", 11.5, 10);
        y -= 4;
      } else if (b.kind === "table") {
        for (const line of b.text.split("\n")) paragraph(line, 9, "F3", 12, 10);
        y -= 4;
      } else if (b.kind === "h3") {
        paragraph(b.text, 11.5, "F2", 16);
      } else if (b.kind === "quote") {
        paragraph(`"${b.text}"`, 10, "F1", 14, 10);
      } else if (b.kind === "h1" || b.kind === "h2") {
        paragraph(b.text, 12, "F2", 17);
      } else {
        paragraph(b.text, 10.5, "F1", 15);
      }
      y -= 2;
    }
    if (n.linksOut.length) paragraph(`Links to: ${n.linksOut.join("; ")}`, 9, "F1", 13);
    if (n.linksIn.length) paragraph(`Linked from: ${n.linksIn.join("; ")}`, 9, "F1", 13);
    y -= 14;
  });

  pages.push(ops.join("\n"));

  const pageIds = [];
  const contentIds = [];
  let nextId = 6;
  for (let i = 0; i < pages.length; i++) {
    pageIds.push(nextId++);
    contentIds.push(nextId++);
  }

  const objects = new Map();
  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.set(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  objects.set(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  objects.set(5, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");

  pages.forEach((content, i) => {
    objects.set(
      pageIds[i],
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentIds[i]} 0 R >>`
    );
    objects.set(contentIds[i], `<< /Length ${byteLength(content)} >>\nstream\n${content}\nendstream`);
  });

  const count = nextId - 1;
  let pdf = "%PDF-1.4\n";
  const offsets = new Array(count + 1).fill(0);
  for (let id = 1; id <= count; id++) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${count + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= count; id++) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return pdf;
}

function download(content, type, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// --- Pure Offline Client-Side ZIP Archive Generator --------------------------
const crcTable = (() => {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function calculateCrc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function createZipBlob(files) {
  const encoder = new TextEncoder();
  const fileRecords = [];
  let offset = 0;
  const parts = [];

  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const f of files) {
    const nameBytes = encoder.encode(f.path.replace(/\\/g, "/"));
    const dataBytes = typeof f.content === "string" ? encoder.encode(f.content) : new Uint8Array(f.content);
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name length + data)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0, true); // General purpose bit flag
    lv.setUint16(8, 0, true); // Compression method (0 = STORED)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // Compressed size
    lv.setUint32(22, size, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    parts.push(localHeader);
    parts.push(dataBytes);

    fileRecords.push({
      nameBytes,
      crc,
      size,
      offset,
      dosTime,
      dosDate,
    });

    offset += localHeader.length + size;
  }

  const centralDirStart = offset;
  let centralDirSize = 0;

  for (const rec of fileRecords) {
    // Central directory header (46 bytes + name length)
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0, true); // Flag
    cv.setUint16(10, 0, true); // Compression method (0 = STORED)
    cv.setUint16(12, rec.dosTime, true);
    cv.setUint16(14, rec.dosDate, true);
    cv.setUint32(16, rec.crc, true);
    cv.setUint32(20, rec.size, true); // Compressed size
    cv.setUint32(24, rec.size, true); // Uncompressed size
    cv.setUint16(28, rec.nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // Comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal attributes
    cv.setUint32(38, 0, true); // External attributes
    cv.setUint32(42, rec.offset, true); // Relative offset of local header
    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central dir signature
  ev.setUint16(4, 0, true); // Disk number
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, fileRecords.length, true); // Number of records on this disk
  ev.setUint16(10, fileRecords.length, true); // Total number of central dir records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, centralDirStart, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  parts.push(eocd);

  return new Blob(parts, { type: "application/zip" });
}

// --- Standalone Interactive HTML Export Generator ----------------------------
export function buildInteractiveHtml({ workspace, nodes = [], links = [], stickies = [] }) {
  const wsName = workspace?.name || "BrainVault Research Workspace";
  const exportedAt = new Date().toLocaleString();
  const safeData = JSON.stringify({
    workspace: { name: wsName, id: workspace?.id || "ws-export" },
    nodes: nodes.map((n) => ({
      id: n.id,
      prompt: n.prompt,
      text: n.text || "",
      color: n.color || "#e0f2fe",
      tags: n.tags || [],
      x: n.x || 0,
      y: n.y || 0,
      width: n.width || 760,
      height: n.height || 580,
      parentId: n.parentId || null,
    })),
    links: links.map((l) => ({
      sourceId: l.sourceId,
      targetId: l.targetId,
      color: l.color || "#38bdf8",
      style: l.style || "solid",
    })),
    stickies: stickies.map((s) => ({
      id: s.id,
      text: s.text || "",
      color: s.color || "#FEF08A",
      x: s.x || 0,
      y: s.y || 0,
    })),
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(wsName)} · Interactive BrainVault Dossier</title>
  <style>
    :root {
      --bg: #000000;
      --bg-soft: #030804;
      --panel: rgba(6, 14, 10, 0.94);
      --line: rgba(0, 255, 102, 0.22);
      --ink: #e6ffe6;
      --muted: #4ade80;
      --cyan: #00ff66;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      --font-mono: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; padding: 0; background: var(--bg); color: var(--ink); font-family: var(--font-sans); overflow: hidden; }
    
    /* Topbar */
    .topbar {
      position: fixed; top: 0; left: 0; right: 0; height: 56px;
      background: rgba(0,0,0,0.85); backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--line);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; z-index: 100;
    }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: 0.05em; color: var(--cyan); }
    .badge { font-family: var(--font-mono); font-size: 11px; background: rgba(0,255,102,0.15); border: 1px solid var(--cyan); padding: 3px 8px; border-radius: 4px; }
    .search-box { display: flex; align-items: center; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 12px; }
    .search-input { background: transparent; border: none; color: #fff; font-family: inherit; font-size: 13px; outline: none; width: 220px; }
    .search-input::placeholder { color: #888; }
    .top-actions { display: flex; align-items: center; gap: 10px; font-family: var(--font-mono); font-size: 12px; }
    .btn { background: rgba(0,255,102,0.12); border: 1px solid var(--cyan); color: var(--cyan); border-radius: 6px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn:hover { background: var(--cyan); color: #000; }
    
    /* Viewport & Canvas */
    .viewport { position: absolute; top: 56px; left: 0; right: 0; bottom: 0; overflow: hidden; cursor: grab; background: radial-gradient(circle at 50% 50%, #031509 0%, #000000 80%); }
    .viewport:active { cursor: grabbing; }
    .stage { position: absolute; top: 0; left: 0; width: 10000px; height: 10000px; transform-origin: 0 0; }
    
    /* SVG Links */
    svg.link-layer { position: absolute; top: 0; left: 0; width: 10000px; height: 10000px; pointer-events: none; overflow: visible; }
    .line-conduit { fill: none; stroke: rgba(0, 255, 102, 0.4); stroke-width: 2.5; stroke-dasharray: 6 3; }
    
    /* Concept Cards */
    .card {
      position: absolute; border-radius: 12px; background: rgba(12, 18, 14, 0.95);
      border: 1px solid rgba(0, 255, 102, 0.35); box-shadow: 0 16px 40px rgba(0,0,0,0.85);
      display: flex; flex-direction: column; overflow: hidden; transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 24px 60px rgba(0,255,102,0.25); border-color: var(--cyan); }
    .card.is-dimmed { opacity: 0.15; filter: grayscale(1); }
    .card.is-highlighted { border-color: #00ff66; box-shadow: 0 0 30px #00ff66; }
    .card-head { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: rgba(255,255,255,0.02); }
    .card-title { font-weight: 700; font-size: 15px; color: #fff; margin: 0; }
    .card-pill { width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
    .card-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px 0; }
    .tag-chip { font-family: var(--font-mono); font-size: 10.5px; background: rgba(0,255,102,0.1); border: 1px solid rgba(0,255,102,0.3); color: #86efac; padding: 2px 8px; border-radius: 12px; }
    .card-body { padding: 12px 16px 16px; font-size: 13.5px; line-height: 1.6; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; flex: 1; }
    .card-footer { padding: 8px 16px; border-top: 1px solid rgba(255,255,255,0.06); font-family: var(--font-mono); font-size: 11px; color: #64748b; display: flex; justify-content: space-between; }
    
    /* Sticky Notes */
    .sticky { position: absolute; width: 220px; padding: 14px; border-radius: 8px; font-size: 13px; color: #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5); font-weight: 500; }
    
    /* Detail Reading Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px; }
    .modal-box { width: 850px; max-width: 95vw; max-height: 85vh; background: #0c120e; border: 1px solid var(--cyan); border-radius: 12px; box-shadow: 0 24px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0,255,102,0.2); display: flex; flex-direction: column; overflow: hidden; }
    .modal-head { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; justify-content: space-between; align-items: center; }
    .modal-title { font-size: 18px; font-weight: 700; color: #fff; margin: 0; }
    .modal-close { background: none; border: none; color: #888; font-size: 20px; cursor: pointer; }
    .modal-close:hover { color: #fff; }
    .modal-body { padding: 20px; overflow-y: auto; font-size: 14.5px; line-height: 1.7; color: #e2e8f0; white-space: pre-wrap; }
    .is-hidden { display: none !important; }
    
    /* HUD controls */
    .hud-controls { position: fixed; bottom: 20px; left: 20px; background: rgba(0,0,0,0.85); border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; display: flex; gap: 8px; font-family: var(--font-mono); font-size: 12px; z-index: 100; }
    .hud-btn { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 4px; padding: 4px 8px; cursor: pointer; }
    .hud-btn:hover { background: var(--cyan); color: #000; }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span>🧠 BRAINVAULT</span>
      <span class="badge">OFFLINE INTERACTIVE DOSSIER</span>
    </div>
    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="Search cards, tags, topics..." />
    </div>
    <div class="top-actions">
      <span>${escapeHtml(wsName)} · ${nodes.length} Cards · ${stickies.length} Memos</span>
      <button class="btn" id="btnFit">Center View</button>
    </div>
  </header>

  <main class="viewport" id="viewport">
    <div class="stage" id="stage">
      <svg class="link-layer" id="svgLinks"></svg>
      <div id="cardsLayer"></div>
      <div id="stickiesLayer"></div>
    </div>
  </main>

  <div class="hud-controls">
    <button class="hud-btn" id="btnZoomIn">+</button>
    <button class="hud-btn" id="btnZoomOut">-</button>
    <span id="zoomLabel" style="line-height:24px;color:#86efac;">100%</span>
    <button class="hud-btn" id="btnResetPan">Reset View</button>
  </div>

  <div class="modal-overlay is-hidden" id="modalOverlay">
    <div class="modal-box">
      <div class="modal-head">
        <h2 class="modal-title" id="modalCardTitle">Card Detail</h2>
        <button class="modal-close" id="modalClose">&times;</button>
      </div>
      <div class="modal-body" id="modalCardBody"></div>
    </div>
  </div>

  <script id="vaultData" type="application/json">
    ${safeData}
  </script>

  <script>
    (function() {
      const data = JSON.parse(document.getElementById("vaultData").textContent);
      const viewport = document.getElementById("viewport");
      const stage = document.getElementById("stage");
      const svgLinks = document.getElementById("svgLinks");
      const cardsLayer = document.getElementById("cardsLayer");
      const stickiesLayer = document.getElementById("stickiesLayer");
      const searchInput = document.getElementById("searchInput");
      const zoomLabel = document.getElementById("zoomLabel");
      const modalOverlay = document.getElementById("modalOverlay");
      const modalCardTitle = document.getElementById("modalCardTitle");
      const modalCardBody = document.getElementById("modalCardBody");
      const modalClose = document.getElementById("modalClose");

      let scale = 0.8;
      let panX = 100;
      let panY = 100;
      let isDragging = false;
      let startX = 0, startY = 0;

      function updateTransform() {
        stage.style.transform = \`translate(\${panX}px, \${panY}px) scale(\${scale})\`;
        zoomLabel.textContent = Math.round(scale * 100) + "%";
      }

      viewport.addEventListener("mousedown", (e) => {
        if (e.target.closest(".card") || e.target.closest(".modal-box")) return;
        isDragging = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
      });

      window.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        updateTransform();
      });

      window.addEventListener("mouseup", () => { isDragging = false; });

      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.08 : 0.92;
        scale = Math.max(0.15, Math.min(2.5, scale * factor));
        updateTransform();
      }, { passive: false });

      document.getElementById("btnZoomIn").addEventListener("click", () => { scale = Math.min(2.5, scale * 1.15); updateTransform(); });
      document.getElementById("btnZoomOut").addEventListener("click", () => { scale = Math.max(0.15, scale * 0.85); updateTransform(); });
      document.getElementById("btnResetPan").addEventListener("click", fitToCenter);
      document.getElementById("btnFit").addEventListener("click", fitToCenter);

      function fitToCenter() {
        if (!data.nodes.length) {
          scale = 0.8; panX = 100; panY = 100;
          updateTransform();
          return;
        }
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        data.nodes.forEach(n => {
          minX = Math.min(minX, n.x);
          minY = Math.min(minY, n.y);
          maxX = Math.max(maxX, n.x + (n.width || 760));
          maxY = Math.max(maxY, n.y + (n.height || 580));
        });
        const w = maxX - minX;
        const h = maxY - minY;
        const vpW = window.innerWidth;
        const vpH = window.innerHeight - 56;
        scale = Math.min(1.2, Math.max(0.2, Math.min((vpW - 80) / w, (vpH - 80) / h)));
        panX = (vpW - w * scale) / 2 - minX * scale;
        panY = (vpH - h * scale) / 2 - minY * scale;
        updateTransform();
      }

      // Render Cards
      cardsLayer.innerHTML = data.nodes.map(n => {
        const w = n.width || 760;
        const h = n.height || 580;
        const tags = (n.tags || []).map(t => \`<span class="tag-chip">#\${t}</span>\`).join("");
        return \`
          <article class="card" data-id="\${n.id}" style="left:\${n.x}px;top:\${n.y}px;width:\${w}px;height:\${h}px;">
            <div class="card-head">
              <h3 class="card-title">\${escapeHtml(n.prompt)}</h3>
              <span class="card-pill" style="color:\${n.color};background:\${n.color};"></span>
            </div>
            \${tags ? \`<div class="card-tags">\${tags}</div>\` : ""}
            <div class="card-body">\${escapeHtml(n.text || "(No content)")}</div>
            <div class="card-footer">
              <span>\${n.parentId ? "SUB-NODE" : "ROOT NODE"}</span>
              <span>Click for Full Dossier &rarr;</span>
            </div>
          </article>
        \`;
      }).join("");

      // Render Stickies
      stickiesLayer.innerHTML = data.stickies.map(s => \`
        <div class="sticky" style="left:\${s.x}px;top:\${s.y}px;background:\${s.color};">
          \${escapeHtml(s.text || "")}
        </div>
      \`).join("");

      // Render Curved Links
      const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
      let svgHtml = "";
      
      // Parent -> child hierarchy links
      data.nodes.forEach(n => {
        if (n.parentId && nodeMap.has(n.parentId)) {
          const p = nodeMap.get(n.parentId);
          const x1 = p.x + (p.width || 760);
          const y1 = p.y + (p.height || 580) / 2;
          const x2 = n.x;
          const y2 = n.y + (n.height || 580) / 2;
          const dx = Math.abs(x2 - x1) * 0.5;
          svgHtml += \`<path class="line-conduit" d="M \${x1} \${y1} C \${x1 + dx} \${y1}, \${x2 - dx} \${y2}, \${x2} \${y2}" stroke="\${p.color || '#00ff66'}" />\`;
        }
      });

      // Explicit links
      data.links.forEach(l => {
        if (nodeMap.has(l.sourceId) && nodeMap.has(l.targetId)) {
          const s = nodeMap.get(l.sourceId);
          const t = nodeMap.get(l.targetId);
          const x1 = s.x + (s.width || 760) / 2;
          const y1 = s.y + (s.height || 580) / 2;
          const x2 = t.x + (t.width || 760) / 2;
          const y2 = t.y + (t.height || 580) / 2;
          svgHtml += \`<path class="line-conduit" d="M \${x1} \${y1} Q \${(x1+x2)/2} \${(y1+y2)/2 - 80} \${x2} \${y2}" stroke="\${l.color || '#38bdf8'}" />\`;
        }
      });
      svgLinks.innerHTML = svgHtml;

      // Card Click: Open Modal
      cardsLayer.addEventListener("click", (e) => {
        const card = e.target.closest(".card");
        if (!card) return;
        const id = card.dataset.id;
        const node = nodeMap.get(id);
        if (!node) return;
        modalCardTitle.textContent = node.prompt;
        modalCardBody.textContent = node.text || "No extended notes.";
        modalOverlay.classList.remove("is-hidden");
      });

      modalClose.addEventListener("click", () => modalOverlay.classList.add("is-hidden"));
      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) modalOverlay.classList.add("is-hidden");
      });

      // Search Filter
      searchInput.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".card").forEach(c => {
          const id = c.dataset.id;
          const n = nodeMap.get(id);
          if (!q) {
            c.classList.remove("is-dimmed", "is-highlighted");
            return;
          }
          const match = n.prompt.toLowerCase().includes(q) || (n.text || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q));
          c.classList.toggle("is-dimmed", !match);
          c.classList.toggle("is-highlighted", match);
        });
      });

      function escapeHtml(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }

      fitToCenter();
    })();
  </script>
</body>
</html>`;
}

// --- Obsidian Markdown Vault Generator ---------------------------------------
function safeObsidianFilename(title) {
  return String(title || "Untitled Note")
    .replace(/[/\\:*?"<>|#^[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "Untitled Note";
}

function escapeYamlString(val) {
  return String(val || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildObsidianVaultZip({ workspace, nodes = [], links = [], stickies = [] }) {
  const wsName = workspace?.name || "BrainVault";
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const files = [];

  // Helper to compute node hierarchy depth & breadcrumb path
  function getHierarchyInfo(node) {
    let level = 0;
    let curr = node;
    const pathItems = [node.prompt];
    const visited = new Set([node.id]);
    while (curr.parentId && byId.has(curr.parentId) && level < 25) {
      curr = byId.get(curr.parentId);
      if (visited.has(curr.id)) break; // cycle protection
      visited.add(curr.id);
      pathItems.unshift(curr.prompt);
      level++;
    }
    return { level, path: pathItems.join(" / ") };
  }

  // 1. Individual Card Notes in Notes/
  for (const n of nodes) {
    const parentNode = n.parentId ? byId.get(n.parentId) : null;
    const childNodes = nodes.filter((cand) => cand.parentId === n.id);
    
    // Explicit linked concepts
    const outlinks = links
      .filter((l) => l.sourceId === n.id && byId.has(l.targetId))
      .map((l) => byId.get(l.targetId));
    const inlinks = links
      .filter((l) => l.targetId === n.id && byId.has(l.sourceId))
      .map((l) => byId.get(l.sourceId));
    const relatedMap = new Map();
    [...outlinks, ...inlinks].forEach((r) => {
      if (r.id !== n.id) relatedMap.set(r.id, r);
    });
    const relatedNodes = Array.from(relatedMap.values());

    const { level, path } = getHierarchyInfo(n);
    const safeTitle = safeObsidianFilename(n.prompt);
    const parentSafe = parentNode ? safeObsidianFilename(parentNode.prompt) : null;

    // Preserving hierarchical relationships as YAML frontmatter links
    const cardFrontmatter = [
      "---",
      `id: "${n.id}"`,
      `title: "${escapeYamlString(n.prompt)}"`,
      `type: "${n.isCustom ? "custom_note" : n.parentId ? "sub_node" : "primary_node"}"`,
      `workspace: "${escapeYamlString(wsName)}"`,
      `hierarchy_level: ${level}`,
      `hierarchy_path: "${escapeYamlString(path)}"`,
      parentNode ? `parent: "[[Notes/${parentSafe}|${escapeYamlString(parentNode.prompt)}]]"` : "parent: null",
      parentNode ? `parent_title: "${escapeYamlString(parentNode.prompt)}"` : null,
      "children:",
      ...(childNodes.length
        ? childNodes.map((c) => `  - "[[Notes/${safeObsidianFilename(c.prompt)}|${escapeYamlString(c.prompt)}]]"`)
        : ["  []"]),
      "connected_links:",
      ...(relatedNodes.length
        ? relatedNodes.map((r) => `  - "[[Notes/${safeObsidianFilename(r.prompt)}|${escapeYamlString(r.prompt)}]]"`)
        : ["  []"]),
      "tags:",
      "  - brainvault",
      "  - spatial-canvas",
      ...(n.tags && n.tags.length ? n.tags.map((t) => `  - "${escapeYamlString(t.replace(/^#/, ""))}"`) : ["  - research"]),
      `color: "${n.color || "#00ff66"}"`,
      `created: "${new Date().toISOString()}"`,
      `updated: "${new Date().toISOString()}"`,
      "aliases:",
      `  - "${escapeYamlString(n.prompt)}"`,
      "---",
    ].filter((l) => l !== null);

    const bodyLines = [
      ...cardFrontmatter,
      "",
      `# ${n.prompt}`,
      "",
      `> [!info] 🌿 Hierarchical Knowledge Branch`,
      `> - **Workspace:** [[00-Workspace-Index|${wsName}]]`,
      `> - **Hierarchy Depth:** Level ${level} (${n.isCustom ? "Custom Note" : n.parentId ? "Sub-Node" : "Primary Root Node"})`,
      `> - **Knowledge Path:** \`${path}\``,
      parentNode ? `> - **Parent Branch:** [[Notes/${parentSafe}|${parentNode.prompt}]]` : `> - **Parent:** *(Root Constellation Node)*`,
      "",
    ];

    if (childNodes.length) {
      bodyLines.push(
        `### 🌿 Sub-Node Branches (${childNodes.length})`,
        ...childNodes.map((c) => `- [[Notes/${safeObsidianFilename(c.prompt)}|${c.prompt}]]`),
        ""
      );
    }

    if (relatedNodes.length) {
      bodyLines.push(
        `### 🔗 Connected Concepts (${relatedNodes.length})`,
        ...relatedNodes.map((r) => `- [[Notes/${safeObsidianFilename(r.prompt)}|${r.prompt}]]`),
        ""
      );
    }

    bodyLines.push(
      "---",
      "",
      "## 📖 Research Notes & Intelligence",
      "",
      n.text ? n.text.trim() : "*(No extended research notes written yet)*",
      "",
      "---",
      `*Exported from BrainVault Spatial Knowledge Engine on ${new Date().toLocaleString()}*`
    );

    files.push({
      path: `Notes/${safeTitle}.md`,
      content: bodyLines.join("\n"),
    });
  }

  // 2. Sticky Memos in Memos/
  stickies.forEach((s, idx) => {
    const memoContent = [
      "---",
      `id: "${s.id || `memo-${idx + 1}`}"`,
      `type: "sticky_memo"`,
      `workspace: "${escapeYamlString(wsName)}"`,
      `color: "${s.color || "#FEF08A"}"`,
      "tags:",
      "  - brainvault",
      "  - sticky-memo",
      `created: "${new Date().toISOString()}"`,
      "---",
      "",
      `# 📌 Sticky Memo ${idx + 1}`,
      "",
      `> [!note] Workspace Memo`,
      `> Recorded in **[[00-Workspace-Index|${wsName}]]**`,
      "",
      s.text ? s.text.trim() : "*(Empty memo)*",
      "",
      "---",
      `*BrainVault Memo #${idx + 1}*`,
    ].join("\n");

    files.push({
      path: `Memos/memo-${idx + 1}.md`,
      content: memoContent,
    });
  });

  // 3. Hierarchical Constellation Tree for Index
  const rootNodes = nodes.filter((n) => !n.parentId);
  const orphanSubNodes = nodes.filter((n) => n.parentId && !byId.has(n.parentId));

  function renderTree(node, depth = 0) {
    const indent = "  ".repeat(depth);
    const safeTitle = safeObsidianFilename(node.prompt);
    const badge = node.isCustom ? "[Custom Note]" : node.parentId ? "[Sub-Node]" : "[Primary Root]";
    const children = nodes.filter((c) => c.parentId === node.id);
    let str = `${indent}- ${depth === 0 ? "🌿" : "🔗"} **[[Notes/${safeTitle}|${node.prompt}]]** \`${badge}\`\n`;
    for (const child of children) {
      str += renderTree(child, depth + 1);
    }
    return str;
  }

  let hierarchyMarkdownTree = "";
  for (const root of rootNodes) {
    hierarchyMarkdownTree += renderTree(root, 0);
  }
  if (orphanSubNodes.length) {
    hierarchyMarkdownTree += "\n### Unattached Nodes\n";
    for (const orphan of orphanSubNodes) {
      hierarchyMarkdownTree += renderTree(orphan, 0);
    }
  }

  // 4. Index Note (00-Workspace-Index.md)
  const indexLines = [
    "---",
    `title: "${escapeYamlString(wsName)}"`,
    `vault_type: "brainvault-obsidian-vault"`,
    `total_nodes: ${nodes.length}`,
    `total_stickies: ${stickies.length}`,
    `total_links: ${links.length}`,
    `exported_at: "${new Date().toISOString()}"`,
    "tags:",
    "  - brainvault",
    "  - knowledge-graph",
    "  - obsidian-vault",
    "  - index",
    "---",
    "",
    `# 🧠 ${wsName} — Master Index & Knowledge Orbit`,
    "",
    `> **BrainVault Spatial Knowledge Engine** · Offline Obsidian Vault Archive  `,
    `> Exported on **${new Date().toLocaleString()}** | Total Topics: **${nodes.length}** | Memos: **${stickies.length}**`,
    "",
    "## 📊 Vault Structure Overview",
    `- **📂 Notes/** — Individual concept cards with YAML frontmatter links (\`parent:\`, \`children:\`, \`connected_links:\`)`,
    `- **📂 Memos/** — Floating sticky memos with frontmatter and tags`,
    `- **📂 Canvas/** — Native \`BrainVault.canvas\` 2D spatial layout with visual node coordinates and connectors`,
    `- **📂 .obsidian/** — Vault configuration with pre-styled Graph View colors and Properties types`,
    "",
    "## 🌳 Hierarchical Knowledge Tree",
    hierarchyMarkdownTree || "*(No nodes recorded in this workspace)*",
    "",
    "## 📑 Master Catalog Table",
    "| Concept Note | Hierarchy Type | Parent Branch | Sub-Branches | Tags |",
    "|---|---|---|---|---|",
    ...nodes.map((n) => {
      const safeTitle = safeObsidianFilename(n.prompt);
      const parentNode = n.parentId ? byId.get(n.parentId) : null;
      const parentLink = parentNode ? `[[Notes/${safeObsidianFilename(parentNode.prompt)}|${parentNode.prompt}]]` : "*(Root)*";
      const childCount = nodes.filter((c) => c.parentId === n.id).length;
      const tagStr = (n.tags || []).map((t) => `#${t.replace(/^#/, "")}`).join(" ") || "#research";
      const typeStr = n.isCustom ? "Custom Note" : n.parentId ? "Sub-Node" : "Primary";
      return `| [[Notes/${safeTitle}|${n.prompt}]] | \`${typeStr}\` | ${parentLink} | ${childCount} children | ${tagStr} |`;
    }),
    "",
  ];

  if (stickies.length) {
    indexLines.push(
      "## 📝 Sticky Memos",
      ...stickies.map((s, idx) => `- [[Memos/memo-${idx + 1}|Memo ${idx + 1}]]: ${(s.text || "").replace(/\n/g, " ").slice(0, 90)}...`),
      ""
    );
  }

  indexLines.push(
    "## 🚀 Obsidian Quick-Start Guide",
    "1. **Open in Obsidian**: Click *Open folder as vault* in Obsidian and choose this unzipped folder.",
    "2. **Interactive Canvas**: Open `Canvas/BrainVault.canvas` to see your 2D spatial cards arranged visually with directional arrows.",
    "3. **Graph View**: Press `Ctrl+G` (or `Cmd+G` on Mac) to explore the full neural graph colored by hierarchy.",
    "4. **Properties & Backlinks**: All notes include rich YAML frontmatter linking parent, child, and related notes.",
    "",
    "---",
    `*Generated by BrainVault v3.0 · Neural Spatial Knowledge & Cognitive OS*`
  );

  files.push({
    path: "00-Workspace-Index.md",
    content: indexLines.join("\n"),
  });

  // 5. Native Obsidian Visual Canvas (Canvas/BrainVault.canvas)
  const canvasNodes = [];
  const canvasEdges = [];

  nodes.forEach((n, idx) => {
    const safeTitle = safeObsidianFilename(n.prompt);
    canvasNodes.push({
      id: `node-${n.id || idx}`,
      type: "file",
      file: `Notes/${safeTitle}.md`,
      x: Math.round(n.x || (idx % 4) * 440),
      y: Math.round(n.y || Math.floor(idx / 4) * 360),
      width: Math.round(n.width || 420),
      height: Math.round(n.height || 280),
      color: n.parentId ? "4" : "2", // 2 = green, 4 = cyan in Obsidian
    });

    if (n.parentId && byId.has(n.parentId)) {
      canvasEdges.push({
        id: `edge-parent-${n.id}`,
        fromNode: `node-${n.parentId}`,
        fromSide: "right",
        toNode: `node-${n.id}`,
        toSide: "left",
        color: "2",
      });
    }
  });

  // Add explicit links to canvas
  links.forEach((l, idx) => {
    if (byId.has(l.sourceId) && byId.has(l.targetId)) {
      canvasEdges.push({
        id: `edge-link-${idx}`,
        fromNode: `node-${l.sourceId}`,
        fromSide: "bottom",
        toNode: `node-${l.targetId}`,
        toSide: "top",
        color: "5", // 5 = violet in Obsidian
      });
    }
  });

  // Add sticky memos to canvas
  stickies.forEach((s, idx) => {
    canvasNodes.push({
      id: `sticky-${s.id || idx}`,
      type: "text",
      text: s.text || "Memo",
      x: Math.round(s.x || idx * 260),
      y: Math.round(s.y || -320),
      width: 240,
      height: 180,
      color: "6", // 6 = yellow in Obsidian
    });
  });

  files.push({
    path: "Canvas/BrainVault.canvas",
    content: JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2),
  });

  // 6. Obsidian Settings (.obsidian/app.json & graph.json & types.json)
  files.push({
    path: ".obsidian/app.json",
    content: JSON.stringify(
      {
        attachmentFolderPath: "Attachments",
        newFileFolderPath: "Notes",
        livePreview: true,
        showLineNumber: true,
        foldHeading: true,
        foldIndent: true,
        readableLineLength: true,
        strictLineBreaks: false,
      },
      null,
      2
    ),
  });

  files.push({
    path: ".obsidian/graph.json",
    content: JSON.stringify(
      {
        "collapse-filter": false,
        search: "",
        colorGroups: [
          { query: 'path:Notes "type: primary_node"', color: { a: 1, rgb: 65482 } },
          { query: 'path:Notes "type: sub_node"', color: { a: 1, rgb: 3719160 } },
          { query: "path:Memos", color: { a: 1, rgb: 16439829 } },
          { query: "file:00-Workspace-Index", color: { a: 1, rgb: 12616956 } },
        ],
        lineSizeMultiplier: 1.5,
        nodeSizeMultiplier: 1.25,
      },
      null,
      2
    ),
  });

  files.push({
    path: ".obsidian/types.json",
    content: JSON.stringify(
      {
        types: {
          parent: "link",
          children: "multitext",
          connected_links: "multitext",
          hierarchy_level: "number",
          hierarchy_path: "text",
          tags: "tags",
          workspace: "text",
          color: "text",
          created: "datetime",
          updated: "datetime",
        },
      },
      null,
      2
    ),
  });

  return createZipBlob(files);
}

// --- Single Consolidated Obsidian Markdown Dossier Generator ----------------
export function buildObsidianSingleMarkdown({ workspace, nodes = [], links = [], stickies = [] }) {
  const wsName = workspace?.name || "BrainVault";
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const now = new Date().toISOString();

  const lines = [
    "---",
    `title: "${escapeYamlString(wsName)} — Research Dossier"`,
    `workspace: "${escapeYamlString(wsName)}"`,
    `total_nodes: ${nodes.length}`,
    `total_stickies: ${stickies.length}`,
    `total_links: ${links.length}`,
    `exported_at: "${now}"`,
    "tags:",
    "  - brainvault",
    "  - research-dossier",
    "  - obsidian-compatible",
    "---",
    "",
    `# 🧠 ${wsName} — Master Research Dossier`,
    "",
    `> Exported from BrainVault Spatial Knowledge Engine on **${new Date().toLocaleString()}**  `,
    `> Includes **${nodes.length}** concept cards, **${stickies.length}** sticky memos, and **${links.length}** relationship links.`,
    "",
    "## 📑 Table of Contents",
    "",
  ];

  nodes.forEach((n, idx) => {
    const slugAnchor = n.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const badge = n.isCustom ? "[Custom Note]" : n.parentId ? "[Sub-Node]" : "[Primary Root]";
    lines.push(`${idx + 1}. [[#${slugAnchor}|${n.prompt}]] \`${badge}\``);
  });

  lines.push("", "---", "", "## 🌳 Hierarchical Overview", "");

  const rootNodes = nodes.filter((n) => !n.parentId);
  function renderTreeList(node, depth = 0) {
    const indent = "  ".repeat(depth);
    const slugAnchor = node.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const children = nodes.filter((c) => c.parentId === node.id);
    let str = `${indent}- ${depth === 0 ? "🌿" : "🔗"} [[#${slugAnchor}|${node.prompt}]]\n`;
    for (const c of children) {
      str += renderTreeList(c, depth + 1);
    }
    return str;
  }
  for (const r of rootNodes) {
    lines.push(renderTreeList(r, 0).trimEnd());
  }

  if (stickies.length) {
    lines.push("", "---", "", "## 📌 Sticky Memos", "");
    stickies.forEach((s, idx) => {
      lines.push(
        `### Sticky Memo #${idx + 1}`,
        `> [!note] Memo #${idx + 1}`,
        `> ${(s.text || "").replace(/\n/g, "\n> ")}`,
        ""
      );
    });
  }

  lines.push("", "---", "", "## 📖 Detailed Notes & Concept Branches", "");

  nodes.forEach((n, idx) => {
    const parentNode = n.parentId ? byId.get(n.parentId) : null;
    const childNodes = nodes.filter((c) => c.parentId === n.id);
    const outlinks = links
      .filter((l) => l.sourceId === n.id && byId.has(l.targetId))
      .map((l) => byId.get(l.targetId));

    lines.push(
      `### ${n.prompt}`,
      "",
      `> [!info] Concept Metadata`,
      `> - **Type:** ${n.isCustom ? "Custom Note" : n.parentId ? "Sub-Node" : "Primary Topic"} #${idx + 1}`,
      parentNode ? `> - **Parent Branch:** [[#${parentNode.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}|${parentNode.prompt}]]` : `> - **Parent:** *(Root Topic)*`,
      `> - **Tags:** ${(n.tags || []).map((t) => `#${t.replace(/^#/, "")}`).join(" ") || "#research"}`,
      ""
    );

    if (childNodes.length) {
      lines.push(
        `**Sub-Node Branches:**`,
        ...childNodes.map((c) => `- [[#${c.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}|${c.prompt}]]`),
        ""
      );
    }

    if (outlinks.length) {
      lines.push(
        `**Connected Concepts:**`,
        ...outlinks.map((r) => `- [[#${r.prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-")}|${r.prompt}]]`),
        ""
      );
    }

    lines.push(
      n.text ? n.text.trim() : "*(No notes recorded)*",
      "",
      "---",
      ""
    );
  });

  lines.push(`*BrainVault Spatial Dossier · Export complete.*`);
  return lines.join("\n");
}

export function exportReport(report, format, extra = {}) {
  const base = slug(report.title);
  if (format === "txt") {
    download(reportToText(report), "text/plain;charset=utf-8", `${base}-cards.txt`);
    return `${base}-cards.txt`;
  }
  if (format === "doc") {
    download(reportToHtml(report), "application/msword;charset=utf-8", `${base}-cards.doc`);
    return `${base}-cards.doc`;
  }
  if (format === "html") {
    const html = buildInteractiveHtml(extra);
    download(html, "text/html;charset=utf-8", `${base}-interactive-workspace.html`);
    return `${base}-interactive-workspace.html`;
  }
  if (format === "obsidian" || format === "obsidian-zip") {
    const zipBlob = buildObsidianVaultZip(extra);
    download(zipBlob, "application/zip", `${base}-obsidian-vault.zip`);
    return `${base}-obsidian-vault.zip`;
  }
  if (format === "obsidian-md" || format === "markdown") {
    const md = buildObsidianSingleMarkdown(extra);
    download(md, "text/markdown;charset=utf-8", `${base}-obsidian-notes.md`);
    return `${base}-obsidian-notes.md`;
  }
  const pdf = buildPdf(report);
  download(pdf, "application/pdf", `${base}-cards.pdf`);
  return `${base}-cards.pdf`;
}

// exposed for tests/tools
export { buildPdf };
