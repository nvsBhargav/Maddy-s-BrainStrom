import { GridNodeData, StickyNoteData } from './types';
import { jsPDF } from 'jspdf';

export function generateMarkdown(nodes: GridNodeData[]): string {
  if (nodes.length === 0) return "# Maddy's BrainVault\n\nNo nodes created yet.";

  const now = new Date().toLocaleString();
  let md = `# Maddy's BrainVault - Knowledge & Research Dossier\n\n`;
  md += `*Exported on: ${now} | Total Topics & Notes: ${nodes.length}*\n\n`;
  md += `---\n\n`;

  md += `## Table of Contents\n\n`;
  nodes.forEach((node, i) => {
    const title = node.prompt.replace(/[^\w\s-]/g, '').trim();
    const anchor = title.toLowerCase().replace(/\s+/g, '-');
    const badge = node.isCustom ? '[Extra Details Note]' : (node.parentId ? '[Sub-Node]' : '[Primary Node]');
    md += `${i + 1}. [${node.prompt}](#${anchor}) ${badge}\n`;
  });
  md += `\n---\n\n`;

  // Sort nodes so root nodes come first, followed by their children/notes
  const rootNodes = nodes.filter(n => !n.parentId);
  const childNodes = nodes.filter(n => Boolean(n.parentId));

  const renderedIds = new Set<string>();

  const renderNodeSection = (node: GridNodeData, level: number = 2) => {
    renderedIds.add(node.id);
    const hashes = '#'.repeat(level);
    const version = node.versions[node.versionIndex] || node;
    const parent = nodes.find(p => p.id === node.parentId);

    md += `${hashes} ${node.prompt}\n\n`;
    
    if (parent) {
      md += `*Branch of: **${parent.prompt}*** | `;
    }
    md += `*Type: ${node.isCustom ? 'Custom Details Note' : 'AI Topic'}* | *${(version.text?.length || 0)} Characters*\n\n`;

    if (version.text) {
      md += `${version.text}\n\n`;
    } else {
      md += `*No detailed notes written yet.*\n\n`;
    }

    if (version.prompts && version.prompts.length > 0) {
      md += `**Suggested Sub-Topic Explorations:**\n`;
      version.prompts.forEach(p => {
        md += `- ${p}\n`;
      });
      md += `\n`;
    }

    md += `---\n\n`;

    // Render children attached to this node
    const attachedChildren = nodes.filter(c => c.parentId === node.id);
    attachedChildren.forEach(child => {
      renderNodeSection(child, Math.min(level + 1, 4));
    });
  };

  rootNodes.forEach(node => renderNodeSection(node, 2));

  // Render any orphaned nodes not yet rendered
  childNodes.forEach(node => {
    if (!renderedIds.has(node.id)) {
      renderNodeSection(node, 3);
    }
  });

  return md;
}

export function generatePlainText(nodes: GridNodeData[]): string {
  if (nodes.length === 0) return "Maddy's BrainVault - No notes created yet.";

  const now = new Date().toLocaleString();
  let txt = `================================================================================\n`;
  txt += `MADDY'S BRAINVAULT - KNOWLEDGE & RESEARCH DOSSIER\n`;
  txt += `Exported: ${now} | Nodes & Notes: ${nodes.length}\n`;
  txt += `================================================================================\n\n`;

  nodes.forEach((node, i) => {
    const version = node.versions[node.versionIndex] || node;
    const parent = nodes.find(p => p.id === node.parentId);
    const typeLabel = node.isCustom ? 'CUSTOM NOTE / EXTRA DETAILS' : (node.parentId ? 'SUB-NODE TOPIC' : 'PRIMARY NODE TOPIC');

    txt += `[${i + 1}] ${node.prompt.toUpperCase()}\n`;
    txt += `CATEGORY: ${typeLabel}\n`;
    if (parent) {
      txt += `LINKED TO: ${parent.prompt}\n`;
    }
    txt += `--------------------------------------------------------------------------------\n`;
    txt += `${version.text || '(No text content)'}\n\n`;

    if (version.prompts && version.prompts.length > 0) {
      txt += `EXPLORATION BRANCHES:\n`;
      version.prompts.forEach(p => {
        txt += `  * ${p}\n`;
      });
      txt += `\n`;
    }

    txt += `================================================================================\n\n`;
  });

  return txt;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateWordDoc(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []): string {
  const now = new Date().toLocaleString();
  let html = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset='utf-8'>
<title>Maddy's BrainVault - ${escapeHtml(workspaceName)}</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111827; margin: 40px; }
h1.title { font-size: 24pt; color: #0F0E47; border-bottom: 3px solid #0F0E47; padding-bottom: 8px; margin-bottom: 6px; }
.meta { font-size: 10pt; color: #4B5563; margin-bottom: 24px; font-style: italic; }
.toc { background-color: #F3F4F6; border: 1px solid #D1D5DB; padding: 16px; margin-bottom: 30px; }
.toc-title { font-weight: bold; font-size: 12pt; color: #0F0E47; margin-bottom: 10px; }
.toc-item { font-size: 10pt; margin: 4px 0; }
.node-card { border-left: 4px solid #8686AC; padding-left: 16px; margin-bottom: 28px; page-break-inside: avoid; }
.node-header { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; font-weight: bold; margin-bottom: 4px; }
h2.node-title { font-size: 15pt; color: #0F0E47; margin-top: 0; margin-bottom: 10px; }
.node-body { font-size: 11pt; color: #1F2937; margin-bottom: 12px; }
.branches { background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 10px 14px; margin-top: 10px; }
.branches-title { font-size: 9pt; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 6px; }
.sticky-box { background-color: #FEF9C3; border: 1px solid #FACC15; padding: 12px; margin-bottom: 16px; border-radius: 6px; }
.sticky-title { font-weight: bold; font-size: 10pt; color: #854D0E; margin-bottom: 4px; }
ul { margin-top: 4px; margin-bottom: 4px; }
</style>
</head>
<body>
<h1 class='title'>Maddy's BrainVault</h1>
<div class='meta'>Workspace: <strong>${escapeHtml(workspaceName)}</strong> &bull; Exported: ${now} &bull; Total Topics &amp; Notes: ${nodes.length} &bull; Sticky Memos: ${stickyNotes.length}</div>

${nodes.length > 0 ? `
<div class='toc'>
<div class='toc-title'>TABLE OF CONTENTS (${nodes.length} Items)</div>
${nodes.map((node, i) => `
  <div class='toc-item'>${i + 1}. <strong>${escapeHtml(node.prompt)}</strong> &mdash; <em>${node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node'}</em></div>
`).join('')}
</div>
` : '<p>No nodes recorded in this workspace.</p>'}

${stickyNotes.length > 0 ? `
<div style='margin-bottom: 24px;'>
  <h3 style='color: #854D0E; border-bottom: 1px solid #FACC15; padding-bottom: 4px;'>STICKY MEMOS (${stickyNotes.length})</h3>
  ${stickyNotes.map((s, idx) => `
    <div class='sticky-box'>
      <div class='sticky-title'>Sticky Note #${idx + 1}</div>
      <div>${escapeHtml(s.text || '(Empty sticky note)')}</div>
    </div>
  `).join('')}
</div>
` : ''}

${nodes.map((node, i) => {
  const version = node.versions[node.versionIndex] || node;
  const parent = nodes.find(p => p.id === node.parentId);
  const typeLabel = node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node';
  return `
<div class='node-card'>
  <div class='node-header'>${typeLabel} #${i + 1} ${parent ? `&bull; Branched from: ${escapeHtml(parent.prompt)}` : ''}</div>
  <h2 class='node-title'>${escapeHtml(node.prompt)}</h2>
  <div class='node-body'>${escapeHtml(version.text || 'No text recorded.')}</div>
  ${version.prompts && version.prompts.length > 0 ? `
    <div class='branches'>
      <div class='branches-title'>Suggested Exploration Branches:</div>
      <ul>
        ${version.prompts.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
      </ul>
    </div>
  ` : ''}
</div>
`;
}).join('')}

</body>
</html>`;
  return html;
}

export function downloadWordDoc(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []) {
  const docHtml = generateWordDoc(nodes, workspaceName, stickyNotes);
  const safeName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `maddys-brainvault-${safeName}-${new Date().toISOString().slice(0, 10)}.doc`;
  downloadFile(docHtml, filename, 'application/msword;charset=utf-8');
}

export function downloadWordDocx(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []) {
  const docHtml = generateWordDoc(nodes, workspaceName, stickyNotes);
  const safeName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `maddys-brainvault-${safeName}-${new Date().toISOString().slice(0, 10)}.docx`;
  downloadFile(docHtml, filename, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8');
}

/**
 * Creates a professional, styled, multi-page jsPDF document for the active workspace
 */
export function createPdfDocument(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      drawHeaderAndFooter();
      return true;
    }
    return false;
  };

  const drawHeaderAndFooter = () => {
    // Header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 160);
    doc.text("Maddy's BrainVault | Knowledge & Research Dossier", margin, 24);
    doc.text(workspaceName, pageWidth - margin, 24, { align: 'right' });
    doc.setDrawColor(210, 210, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, 28, pageWidth - margin, 28);
  };

  // --- COVER / HEADER SECTION ---
  doc.setFillColor(15, 14, 71); // #0F0E47
  doc.rect(margin, currentY, contentWidth, 75, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Maddy's BrainVault", margin + 18, currentY + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(203, 203, 230);
  doc.text(`Selected Workspace: ${workspaceName}`, margin + 18, currentY + 48);

  const now = new Date().toLocaleString();
  doc.setFontSize(9);
  doc.setTextColor(180, 180, 210);
  doc.text(`Exported: ${now}  |  Nodes: ${nodes.length}  |  Sticky Memos: ${stickyNotes.length}`, margin + 18, currentY + 64);

  currentY += 90;

  // --- TABLE OF CONTENTS ---
  if (nodes.length > 0) {
    checkPageBreak(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 14, 71);
    doc.text(`TABLE OF CONTENTS (${nodes.length} TOPICS & NOTES)`, margin, currentY);
    currentY += 8;

    doc.setDrawColor(134, 134, 172);
    doc.setLineWidth(1);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 14;

    nodes.forEach((node, i) => {
      checkPageBreak(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 14, 71);
      doc.text(`${i + 1}.`, margin + 6, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 60);
      const truncatedPrompt = node.prompt.length > 60 ? node.prompt.slice(0, 58) + '...' : node.prompt;
      doc.text(truncatedPrompt, margin + 24, currentY);

      const typeLabel = node.isCustom ? 'Custom Note' : node.parentId ? 'Sub-Node' : 'Primary Node';
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 140);
      doc.text(`[${typeLabel}]`, pageWidth - margin - 10, currentY, { align: 'right' });

      currentY += 14;
    });

    currentY += 16;
  }

  // --- STICKY NOTES SECTION ---
  if (stickyNotes.length > 0) {
    checkPageBreak(50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(180, 83, 9);
    doc.text(`STICKY MEMOS (${stickyNotes.length})`, margin, currentY);
    currentY += 8;
    doc.setDrawColor(251, 191, 36);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 14;

    stickyNotes.forEach((sticky, idx) => {
      const textLines = doc.splitTextToSize(sticky.text || '(Empty memo)', contentWidth - 24);
      const boxHeight = textLines.length * 13 + 22;
      checkPageBreak(boxHeight + 10);

      doc.setFillColor(254, 249, 195);
      doc.setDrawColor(250, 204, 21);
      doc.setLineWidth(1);
      doc.roundedRect(margin, currentY, contentWidth, boxHeight, 4, 4, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14);
      doc.text(`STICKY NOTE #${idx + 1}`, margin + 10, currentY + 12);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(textLines, margin + 10, currentY + 24);

      currentY += boxHeight + 10;
    });

    currentY += 10;
  }

  // --- NODES SECTIONS ---
  nodes.forEach((node, i) => {
    const version = node.versions[node.versionIndex] || node;
    const parent = nodes.find(p => p.id === node.parentId);
    const typeLabel = node.isCustom ? 'Custom Note / Extra Details' : node.parentId ? 'Sub-Node Topic' : 'Primary Node Topic';

    checkPageBreak(80);

    // Node Card Header Bar
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(node.parentId ? 203 : 134, node.parentId ? 203 : 134, node.parentId ? 203 : 172);
    doc.setLineWidth(1.5);
    doc.rect(margin, currentY, contentWidth, 26, 'FD');

    // Left border accent
    doc.setFillColor(15, 14, 71);
    doc.rect(margin, currentY, 4, 26, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(75, 85, 99);
    doc.text(`${typeLabel.toUpperCase()} #${i + 1}${parent ? ` | Branch of: ${parent.prompt}` : ''}`, margin + 12, currentY + 16);

    currentY += 34;

    // Node Title
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(15, 14, 71);
    const titleLines = doc.splitTextToSize(node.prompt, contentWidth);
    doc.text(titleLines, margin + 6, currentY);
    currentY += titleLines.length * 15 + 6;

    // Body text
    const textContent = version.text || 'No additional text recorded.';
    const bodyLines = doc.splitTextToSize(textContent, contentWidth - 10);
    
    // We can output body lines with pagination
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 41, 55);

    for (let l = 0; l < bodyLines.length; l++) {
      checkPageBreak(13);
      doc.text(bodyLines[l], margin + 6, currentY);
      currentY += 13;
    }

    currentY += 6;

    // Code Snippet if present
    if (node.codeSnippet?.code) {
      const codeLines = doc.splitTextToSize(node.codeSnippet.code, contentWidth - 20);
      const codeBoxHeight = codeLines.length * 12 + 18;
      checkPageBreak(Math.min(codeBoxHeight, 150));

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin + 6, currentY, contentWidth - 12, codeBoxHeight, 3, 3, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`CODE (${node.codeSnippet.language})`, margin + 14, currentY + 11);

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(codeLines, margin + 14, currentY + 22);

      currentY += codeBoxHeight + 8;
    }

    // Suggested exploration branches
    if (version.prompts && version.prompts.length > 0) {
      checkPageBreak(25 + version.prompts.length * 13);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Suggested Exploration Branches:", margin + 6, currentY);
      currentY += 11;

      version.prompts.forEach(p => {
        checkPageBreak(13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`•  ${p}`, margin + 14, currentY);
        currentY += 12;
      });

      currentY += 6;
    }

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 18;
  });

  // Footer for each page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 170);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 16, { align: 'right' });
    doc.text("Maddy's BrainVault • Spatial Knowledge Engine", margin, pageHeight - 16);
  }

  return doc;
}

/**
 * Downloads a genuine .pdf file
 */
export function downloadPdfFile(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []) {
  const doc = createPdfDocument(nodes, workspaceName, stickyNotes);
  const safeName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `maddys-brainvault-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

/**
 * Generates Blob URL for PDF preview in an iframe / object
 */
export function generatePdfBlobUrl(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []): string {
  const doc = createPdfDocument(nodes, workspaceName, stickyNotes);
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
}

export function downloadPdfDossier(nodes: GridNodeData[], workspaceName: string = 'Current Workspace', stickyNotes: StickyNoteData[] = []) {
  downloadPdfFile(nodes, workspaceName, stickyNotes);
}

export function printDossier(nodes: GridNodeData[]) {
  try {
    window.print();
  } catch {}
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Pure Offline Client-Side ZIP Generator for Obsidian Vault ---
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

export function createZipBlob(files: { path: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBytes: Uint8Array;
    crc: number;
    size: number;
    offset: number;
    dosTime: number;
    dosDate: number;
  }[] = [];
  let offset = 0;
  const parts: (Uint8Array | ArrayBuffer)[] = [];

  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff;

  for (const f of files) {
    const nameBytes = encoder.encode(f.path.replace(/\\/g, '/'));
    const dataBytes = encoder.encode(f.content);
    const crc = calculateCrc32(dataBytes);
    const size = dataBytes.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
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
    const cdHeader = new Uint8Array(46 + rec.nameBytes.length);
    const cv = new DataView(cdHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, rec.dosTime, true);
    cv.setUint16(14, rec.dosDate, true);
    cv.setUint32(16, rec.crc, true);
    cv.setUint32(20, rec.size, true);
    cv.setUint32(24, rec.size, true);
    cv.setUint16(28, rec.nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, rec.offset, true);
    cdHeader.set(rec.nameBytes, 46);

    parts.push(cdHeader);
    centralDirSize += cdHeader.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, fileRecords.length, true);
  ev.setUint16(10, fileRecords.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirStart, true);
  ev.setUint16(20, 0, true);

  parts.push(eocd);
  return new Blob(parts, { type: 'application/zip' });
}

function safeObsidianFilename(title: string): string {
  return String(title || 'Untitled Note')
    .replace(/[/\\:*?"<>|#^[\]]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Untitled Note';
}

function escapeYamlString(val: string): string {
  return String(val || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Builds an Obsidian-compatible Markdown vault folder structure with YAML frontmatter links,
 * breadcrumbs, native Canvas visual file, and custom Graph view settings.
 */
export function generateObsidianVaultZip(
  nodes: GridNodeData[],
  workspaceName: string = 'Current Workspace',
  stickyNotes: StickyNoteData[] = []
): Blob {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const files: { path: string; content: string }[] = [];

  function getHierarchyInfo(node: GridNodeData) {
    let level = 0;
    let curr = node;
    const pathItems = [node.prompt];
    const visited = new Set([node.id]);
    while (curr.parentId && byId.has(curr.parentId) && level < 25) {
      curr = byId.get(curr.parentId)!;
      if (visited.has(curr.id)) break;
      visited.add(curr.id);
      pathItems.unshift(curr.prompt);
      level++;
    }
    return { level, path: pathItems.join(' / ') };
  }

  // 1. Individual Note Files in Notes/
  for (const n of nodes) {
    const version = n.versions[n.versionIndex] || n;
    const parentNode = n.parentId ? byId.get(n.parentId) : null;
    const childNodes = nodes.filter((cand) => cand.parentId === n.id);
    const { level, path } = getHierarchyInfo(n);
    const safeTitle = safeObsidianFilename(n.prompt);
    const parentSafe = parentNode ? safeObsidianFilename(parentNode.prompt) : null;

    // Preserving hierarchical relationships as YAML frontmatter links
    const cardFrontmatter = [
      '---',
      `id: "${n.id}"`,
      `title: "${escapeYamlString(n.prompt)}"`,
      `type: "${n.isCustom ? 'custom_note' : n.parentId ? 'sub_node' : 'primary_node'}"`,
      `workspace: "${escapeYamlString(workspaceName)}"`,
      `hierarchy_level: ${level}`,
      `hierarchy_path: "${escapeYamlString(path)}"`,
      parentNode ? `parent: "[[Notes/${parentSafe}|${escapeYamlString(parentNode.prompt)}]]"` : 'parent: null',
      parentNode ? `parent_title: "${escapeYamlString(parentNode.prompt)}"` : null,
      'children:',
      ...(childNodes.length
        ? childNodes.map((c) => `  - "[[Notes/${safeObsidianFilename(c.prompt)}|${escapeYamlString(c.prompt)}]]"`)
        : ['  []']),
      'tags:',
      '  - brainvault',
      '  - spatial-canvas',
      ...(n.isCustom ? ['  - custom-note'] : n.parentId ? ['  - sub-node'] : ['  - primary-topic']),
      `created: "${new Date().toISOString()}"`,
      'aliases:',
      `  - "${escapeYamlString(n.prompt)}"`,
      '---',
    ].filter(Boolean);

    const bodyLines = [
      ...cardFrontmatter,
      '',
      `# ${n.prompt}`,
      '',
      `> [!info] 🌿 Hierarchical Knowledge Branch`,
      `> - **Workspace:** [[00-Workspace-Index|${workspaceName}]]`,
      `> - **Hierarchy Depth:** Level ${level} (${n.isCustom ? 'Custom Note' : n.parentId ? 'Sub-Node' : 'Primary Root Node'})`,
      `> - **Knowledge Path:** \`${path}\``,
      parentNode ? `> - **Parent Branch:** [[Notes/${parentSafe}|${parentNode.prompt}]]` : `> - **Parent:** *(Root Constellation Node)*`,
      '',
    ];

    if (childNodes.length) {
      bodyLines.push(
        `### 🌿 Sub-Node Branches (${childNodes.length})`,
        ...childNodes.map((c) => `- [[Notes/${safeObsidianFilename(c.prompt)}|${c.prompt}]]`),
        ''
      );
    }

    bodyLines.push(
      '---',
      '',
      '## 📖 Research Notes & Intelligence',
      '',
      version.text ? version.text.trim() : '*(No extended research notes written yet)*',
      ''
    );

    if (n.codeSnippet?.code) {
      bodyLines.push(
        `\`\`\`${n.codeSnippet.language || 'text'}`,
        n.codeSnippet.code,
        '```',
        ''
      );
    }

    if (version.prompts && version.prompts.length > 0) {
      bodyLines.push(
        '### 💡 Exploration Branches',
        ...version.prompts.map((p) => `- ${p}`),
        ''
      );
    }

    bodyLines.push(
      '---',
      `*Exported from BrainVault Spatial Knowledge Engine on ${new Date().toLocaleString()}*`
    );

    files.push({
      path: `Notes/${safeTitle}.md`,
      content: bodyLines.join('\n'),
    });
  }

  // 2. Sticky Memos in Memos/
  stickyNotes.forEach((s, idx) => {
    const memoContent = [
      '---',
      `id: "${s.id || `memo-${idx + 1}`}"`,
      `type: "sticky_memo"`,
      `workspace: "${escapeYamlString(workspaceName)}"`,
      `color: "${s.color || '#FEF08A'}"`,
      'tags:',
      '  - brainvault',
      '  - sticky-memo',
      `created: "${new Date().toISOString()}"`,
      '---',
      '',
      `# 📌 Sticky Memo ${idx + 1}`,
      '',
      `> [!note] Workspace Memo`,
      `> Recorded in **[[00-Workspace-Index|${workspaceName}]]**`,
      '',
      s.text ? s.text.trim() : '*(Empty memo)*',
      '',
      '---',
      `*BrainVault Memo #${idx + 1}*`,
    ].join('\n');

    files.push({
      path: `Memos/memo-${idx + 1}.md`,
      content: memoContent,
    });
  });

  // 3. Hierarchical Constellation Tree for Index
  const rootNodes = nodes.filter((n) => !n.parentId);
  const orphanSubNodes = nodes.filter((n) => n.parentId && !byId.has(n.parentId));

  function renderTree(node: GridNodeData, depth = 0): string {
    const indent = '  '.repeat(depth);
    const safeTitle = safeObsidianFilename(node.prompt);
    const badge = node.isCustom ? '[Custom Note]' : node.parentId ? '[Sub-Node]' : '[Primary Root]';
    const children = nodes.filter((c) => c.parentId === node.id);
    let str = `${indent}- ${depth === 0 ? '🌿' : '🔗'} **[[Notes/${safeTitle}|${node.prompt}]]** \`${badge}\`\n`;
    for (const child of children) {
      str += renderTree(child, depth + 1);
    }
    return str;
  }

  let hierarchyMarkdownTree = '';
  for (const root of rootNodes) {
    hierarchyMarkdownTree += renderTree(root, 0);
  }
  if (orphanSubNodes.length) {
    hierarchyMarkdownTree += '\n### Unattached Nodes\n';
    for (const orphan of orphanSubNodes) {
      hierarchyMarkdownTree += renderTree(orphan, 0);
    }
  }

  // 4. Index Note (00-Workspace-Index.md)
  const indexLines = [
    '---',
    `title: "${escapeYamlString(workspaceName)}"`,
    `vault_type: "brainvault-obsidian-vault"`,
    `total_nodes: ${nodes.length}`,
    `total_stickies: ${stickyNotes.length}`,
    `exported_at: "${new Date().toISOString()}"`,
    'tags:',
    '  - brainvault',
    '  - knowledge-graph',
    '  - obsidian-vault',
    '  - index',
    '---',
    '',
    `# 🧠 ${workspaceName} — Master Index & Knowledge Orbit`,
    '',
    `> **BrainVault Spatial Knowledge Engine** · Offline Obsidian Vault Archive  `,
    `> Exported on **${new Date().toLocaleString()}** | Total Topics: **${nodes.length}** | Memos: **${stickyNotes.length}**`,
    '',
    '## 📊 Vault Structure Overview',
    `- **📂 Notes/** — Individual concept cards with YAML frontmatter links (\`parent:\`, \`children:\`)`,
    `- **📂 Memos/** — Floating sticky memos with frontmatter and tags`,
    `- **📂 Canvas/** — Native \`BrainVault.canvas\` 2D spatial layout with visual node coordinates and connectors`,
    `- **📂 .obsidian/** — Vault configuration with pre-styled Graph View colors and Properties types`,
    '',
    '## 🌳 Hierarchical Knowledge Tree',
    hierarchyMarkdownTree || '*(No nodes recorded in this workspace)*',
    '',
    '## 📑 Master Catalog Table',
    '| Concept Note | Hierarchy Type | Parent Branch | Sub-Branches |',
    '|---|---|---|---|',
    ...nodes.map((n) => {
      const safeTitle = safeObsidianFilename(n.prompt);
      const parentNode = n.parentId ? byId.get(n.parentId) : null;
      const parentLink = parentNode ? `[[Notes/${safeObsidianFilename(parentNode.prompt)}|${parentNode.prompt}]]` : '*(Root)*';
      const childCount = nodes.filter((c) => c.parentId === n.id).length;
      const typeStr = n.isCustom ? 'Custom Note' : n.parentId ? 'Sub-Node' : 'Primary';
      return `| [[Notes/${safeTitle}|${n.prompt}]] | \`${typeStr}\` | ${parentLink} | ${childCount} children |`;
    }),
    '',
  ];

  if (stickyNotes.length) {
    indexLines.push(
      '## 📝 Sticky Memos',
      ...stickyNotes.map((s, idx) => `- [[Memos/memo-${idx + 1}|Memo ${idx + 1}]]: ${(s.text || '').replace(/\n/g, ' ').slice(0, 90)}...`),
      ''
    );
  }

  indexLines.push(
    '## 🚀 Obsidian Quick-Start Guide',
    '1. **Open in Obsidian**: Click *Open folder as vault* in Obsidian and select this unzipped folder.',
    '2. **Interactive Canvas**: Open `Canvas/BrainVault.canvas` to see your 2D spatial cards arranged visually with directional arrows.',
    '3. **Graph View**: Press `Ctrl+G` (or `Cmd+G` on Mac) to explore the full neural graph colored by hierarchy.',
    '4. **Properties & Backlinks**: All notes include rich YAML frontmatter linking parent, child, and related notes.',
    '',
    '---',
    `*Generated by BrainVault · Neural Spatial Knowledge & Cognitive OS*`
  );

  files.push({
    path: '00-Workspace-Index.md',
    content: indexLines.join('\n'),
  });

  // 5. Native Obsidian Visual Canvas (Canvas/BrainVault.canvas)
  const canvasNodes: any[] = [];
  const canvasEdges: any[] = [];

  nodes.forEach((n, idx) => {
    const safeTitle = safeObsidianFilename(n.prompt);
    canvasNodes.push({
      id: `node-${n.id || idx}`,
      type: 'file',
      file: `Notes/${safeTitle}.md`,
      x: Math.round(n.x || (idx % 4) * 440),
      y: Math.round(n.y || Math.floor(idx / 4) * 360),
      width: Math.round(n.width || 420),
      height: Math.round(n.height || 280),
      color: n.parentId ? '4' : '2',
    });

    if (n.parentId && byId.has(n.parentId)) {
      canvasEdges.push({
        id: `edge-parent-${n.id}`,
        fromNode: `node-${n.parentId}`,
        fromSide: 'right',
        toNode: `node-${n.id}`,
        toSide: 'left',
        color: '2',
      });
    }
  });

  stickyNotes.forEach((s, idx) => {
    canvasNodes.push({
      id: `sticky-${s.id || idx}`,
      type: 'text',
      text: s.text || 'Memo',
      x: Math.round(s.x || idx * 260),
      y: Math.round(s.y || -320),
      width: 240,
      height: 180,
      color: '6',
    });
  });

  files.push({
    path: 'Canvas/BrainVault.canvas',
    content: JSON.stringify({ nodes: canvasNodes, edges: canvasEdges }, null, 2),
  });

  // 6. Obsidian Configuration Files
  files.push({
    path: '.obsidian/app.json',
    content: JSON.stringify(
      {
        attachmentFolderPath: 'Attachments',
        newFileFolderPath: 'Notes',
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
    path: '.obsidian/graph.json',
    content: JSON.stringify(
      {
        collapseFilter: false,
        search: '',
        colorGroups: [
          { query: 'path:Notes "type: primary_node"', color: { a: 1, rgb: 65482 } },
          { query: 'path:Notes "type: sub_node"', color: { a: 1, rgb: 3719160 } },
          { query: 'path:Memos', color: { a: 1, rgb: 16439829 } },
          { query: 'file:00-Workspace-Index', color: { a: 1, rgb: 12616956 } },
        ],
        lineSizeMultiplier: 1.5,
        nodeSizeMultiplier: 1.25,
      },
      null,
      2
    ),
  });

  files.push({
    path: '.obsidian/types.json',
    content: JSON.stringify(
      {
        types: {
          parent: 'link',
          children: 'multitext',
          hierarchy_level: 'number',
          hierarchy_path: 'text',
          tags: 'tags',
          workspace: 'text',
          created: 'datetime',
        },
      },
      null,
      2
    ),
  });

  return createZipBlob(files);
}

export function downloadObsidianVaultZip(
  nodes: GridNodeData[],
  workspaceName: string = 'Current Workspace',
  stickyNotes: StickyNoteData[] = []
) {
  const blob = generateObsidianVaultZip(nodes, workspaceName, stickyNotes);
  const safeName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `brainvault-${safeName}-${new Date().toISOString().slice(0, 10)}-obsidian-vault.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

