const path = require('path');

let pdfParse = null;
let mammoth = null;

try {
  pdfParse = require('pdf-parse');
} catch (error) {
  pdfParse = null;
}

try {
  mammoth = require('mammoth');
} catch (error) {
  mammoth = null;
}

async function getTelegramFileBuffer(ctx, fileId) {
  const fileLink = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(fileLink.href);

  if (!response.ok) {
    throw new Error('Unable to download the resume file from Telegram.');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractResumeText({ buffer, fileName = '', mimeType = '' }) {
  const extension = path.extname(fileName).toLowerCase();

  if (mimeType === 'text/plain' || extension === '.txt') {
    return buffer.toString('utf8');
  }

  if (mimeType === 'application/pdf' || extension === '.pdf') {
    if (!pdfParse) {
      throw new Error('PDF parsing dependency is missing. Run npm install.');
    }

    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  ) {
    if (!mammoth) {
      throw new Error('DOCX parsing dependency is missing. Run npm install.');
    }

    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }

  throw new Error('Unsupported resume format. Please upload PDF, DOCX, or TXT.');
}

module.exports = {
  getTelegramFileBuffer,
  extractResumeText
};
