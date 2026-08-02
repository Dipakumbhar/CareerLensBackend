const { PDFParse, PasswordException, InvalidPDFException } = require('pdf-parse');

/**
 * @name extractTextFromPDF
 * @description Extracts raw text from a PDF buffer using pdf-parse v2 class-based API.
 * @param {Buffer} fileBuffer - Raw PDF file buffer from multer memory storage
 * @returns {Promise<string>} Cleaned resume text
 * @throws {Error} If PDF is empty, unreadable, password-protected, or corrupted
 */
async function extractTextFromPDF(fileBuffer) {
    let parser;
    try {
        parser = new PDFParse({
            data: new Uint8Array(fileBuffer),
        });

        await parser.load();
        const result = await parser.getText();
        const rawText = result?.text || '';

        if (!rawText || rawText.replace(/[\s\-–—\d]+/g, '').trim().length === 0) {
            throw new Error(
                'PDF appears to be empty or contains no extractable text. ' +
                'If your resume is a scanned image, please convert it to a text-based PDF first.'
            );
        }

        return cleanResumeText(rawText);

    } catch (err) {
        // Re-throw our own validation errors as-is
        if (err.message && err.message.startsWith('PDF appears')) {
            throw err;
        }

        // Password-protected PDF
        if (
            err instanceof PasswordException ||
            (err.message && err.message.toLowerCase().includes('password'))
        ) {
            throw new Error('This PDF is password-protected. Please remove the password and try again.');
        }

        // Invalid / corrupted PDF structure
        if (
            err instanceof InvalidPDFException ||
            (err.message && err.message.toLowerCase().includes('invalid pdf'))
        ) {
            throw new Error('This file does not appear to be a valid PDF. Please upload a standard .pdf file.');
        }

        // Anything else
        console.error('[resumeParser] PDF extraction failed:', err.message || err);
        throw new Error('PDF could not be read — the file may be corrupted or in an unsupported format.');

    } finally {
        if (parser) {
            try { parser.destroy(); } catch (_) { /* ignore cleanup errors */ }
        }
    }
}

/**
 * @name cleanResumeText
 * @description Normalises whitespace, removes page markers and invisible characters
 *              while preserving meaningful section structure.
 * @param {string} text - Raw text extracted from the PDF
 * @returns {string} Cleaned text
 */
function cleanResumeText(text) {
    return text
        .replace(/--\s*\d+\s*of\s*\d+\s*--/g, '') // remove pdf-parse v2 page markers
        .replace(/\r\n/g, '\n')                     // unify Windows line endings
        .replace(/\r/g, '\n')                        // unify old Mac line endings
        .replace(/[^\S\n]+/g, ' ')                   // collapse spaces/tabs (preserve newlines)
        .replace(/\n{3,}/g, '\n\n')                  // collapse 3+ blank lines to one
        .replace(/[\u200B-\u200D\uFEFF]/g, '')       // strip zero-width / invisible chars
        .trim();
}

module.exports = { extractTextFromPDF };
