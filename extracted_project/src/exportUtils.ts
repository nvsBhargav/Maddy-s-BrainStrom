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

