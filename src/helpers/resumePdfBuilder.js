const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COLORS = {
  text: '#1F2937',
  muted: '#6B7280',
  accent: '#0F766E',
  accentSoft: '#E6F7F5',
  line: '#D1D5DB',
  sidebar: '#F7FAFC',
  white: '#FFFFFF'
};

function trimHeadline(value = '') {
  return String(value).replace(/\s*\|\s*ATS Optimized Resume Draft\s*$/i, '').trim();
}

function sectionHeading(doc, x, y, width, title) {
  doc.font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(COLORS.accent)
    .text(title.toUpperCase(), x, y, { width });

  const lineY = y + 16;
  doc.save();
  doc.strokeColor(COLORS.line).lineWidth(1).moveTo(x, lineY).lineTo(x + width, lineY).stroke();
  doc.restore();

  return lineY + 10;
}

function paragraph(doc, x, y, width, text, options = {}) {
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 10.5)
    .fillColor(options.color || COLORS.text)
    .text(text || '', x, y, {
      width,
      lineGap: options.lineGap ?? 3
    });

  return doc.y;
}

function bulletList(doc, x, y, width, items, options = {}) {
  let currentY = y;
  const bulletColor = options.bulletColor || COLORS.accent;

  (items || []).forEach((item) => {
    doc.save();
    doc.fillColor(bulletColor).circle(x + 4, currentY + 6, 2.1).fill();
    doc.restore();

    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(options.size || 10)
      .fillColor(options.color || COLORS.text)
      .text(item, x + 14, currentY, {
        width: width - 14,
        lineGap: options.lineGap ?? 3
      });

    currentY = doc.y + 8;
  });

  return currentY;
}

function simpleList(doc, x, y, width, items) {
  let currentY = y;

  (items || []).forEach((item) => {
    doc.font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(item, x, currentY, {
        width,
        lineGap: 3
      });

    currentY = doc.y + 6;
  });

  return currentY;
}

function fitHeadline(doc, text, width, maxLines = 2) {
  let size = 22;
  const clean = text || 'ATS Optimized Resume Draft';

  while (size >= 15) {
    doc.font('Helvetica-Bold').fontSize(size);
    const height = doc.heightOfString(clean, { width });
    const lineHeight = size * 1.18;

    if (height <= lineHeight * maxLines) {
      return { text: clean, size, height };
    }

    size -= 1;
  }

  doc.font('Helvetica-Bold').fontSize(15);
  return {
    text: clean,
    size: 15,
    height: doc.heightOfString(clean, { width })
  };
}

async function createResumePdf({ baseFileName, draft, analysis }) {
  const safeBase = (baseFileName || 'resume')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const outputDir = path.join(__dirname, '../../public/generated-resumes');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${safeBase}_ats_resume.pdf`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 0,
      size: 'A4'
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 42;
    const contentTop = 128;
    const gutter = 24;
    const leftColWidth = 170;
    const rightColX = margin + leftColWidth + gutter;
    const rightColWidth = pageWidth - margin - rightColX;

    doc.rect(0, 0, pageWidth, pageHeight).fill(COLORS.white);

    const displayName = trimHeadline(draft.headline || safeBase) || safeBase;
    const headerInnerWidth = pageWidth - margin * 2 - 40;
    const headline = fitHeadline(doc, displayName, headerInnerWidth, 2);
    const headerHeight = Math.max(88, 24 + headline.height + 34);

    doc.save();
    doc.roundedRect(margin, 34, pageWidth - margin * 2, headerHeight, 16).fill(COLORS.accent);
    doc.restore();

    const titleY = 48;
    const subtitleY = titleY + headline.height + 6;
    const metricsY = 34 + headerHeight - 18;

    doc.font('Helvetica-Bold')
      .fontSize(headline.size)
      .fillColor(COLORS.white)
      .text(headline.text, margin + 20, titleY, {
        width: headerInnerWidth
      });

    doc.font('Helvetica')
      .fontSize(10)
      .fillColor('#D7FFFA')
      .text('ATS-optimized resume draft generated from your uploaded CV and target job description', margin + 20, subtitleY, {
        width: headerInnerWidth
      });

    doc.font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(COLORS.white)
      .text(`ATS SCORE ${analysis.score}/100`, margin + 20, metricsY);

    doc.text(`FIT ${analysis.fitBand.toUpperCase()}`, margin + 150, metricsY);

    doc.save();
    doc.roundedRect(margin, contentTop, leftColWidth, pageHeight - contentTop - margin, 14).fill(COLORS.sidebar);
    doc.restore();

    let leftY = contentTop + 18;
    let rightY = contentTop;

    leftY = sectionHeading(doc, margin + 16, leftY, leftColWidth - 32, 'Professional Summary');
    leftY = paragraph(doc, margin + 16, leftY, leftColWidth - 32, draft.summary || 'Resume summary unavailable.', {
      size: 10,
      lineGap: 3
    }) + 16;

    leftY = sectionHeading(doc, margin + 16, leftY, leftColWidth - 32, 'Core Skills');
    leftY = bulletList(doc, margin + 16, leftY, leftColWidth - 32, draft.skills, {
      size: 9.7
    }) + 8;

    leftY = sectionHeading(doc, margin + 16, leftY, leftColWidth - 32, 'Target Keywords');
    leftY = bulletList(doc, margin + 16, leftY, leftColWidth - 32, draft.keywordHighlights, {
      size: 9.5
    }) + 8;

    leftY = sectionHeading(doc, margin + 16, leftY, leftColWidth - 32, 'Job Match');
    leftY = simpleList(doc, margin + 16, leftY, leftColWidth - 32, [
      `Fit Band: ${analysis.fitBand}`,
      `Score: ${analysis.score}/100`,
      `Matched: ${(analysis.matchedKeywords || []).slice(0, 6).join(', ') || 'None'}`
    ]) + 6;

    rightY = sectionHeading(doc, rightColX, rightY, rightColWidth, 'Experience Highlights');
    rightY = bulletList(doc, rightColX, rightY, rightColWidth, draft.experienceBullets, {
      size: 10.4
    }) + 10;

    rightY = sectionHeading(doc, rightColX, rightY, rightColWidth, 'Project Highlights');
    rightY = bulletList(doc, rightColX, rightY, rightColWidth, draft.projects, {
      size: 10.4
    }) + 10;

    rightY = sectionHeading(doc, rightColX, rightY, rightColWidth, 'Resume Update Guidance');
    rightY = bulletList(doc, rightColX, rightY, rightColWidth, [
      'Use this draft as a stronger base version, then personalize each bullet before applying.',
      'Keep only truthful claims, technologies, metrics, and responsibilities from your real work.',
      'Move the strongest role-matching projects and skills toward the top of your final resume.'
    ], {
      size: 10.1
    }) + 10;

    doc.font('Helvetica')
      .fontSize(9.2)
      .fillColor(COLORS.muted)
      .text(
        'Generated by Telegram ATS Bot. This is an improved draft, not a final verified resume.',
        rightColX,
        pageHeight - 48,
        {
          width: rightColWidth,
          align: 'left'
        }
      );

    doc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return outputPath;
}

module.exports = {
  createResumePdf
};
