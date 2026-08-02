const { extractTextFromPDF }    = require('../services/resumeParser.service');
const { buildInterviewPrompt }  = require('../services/promptBuilder.service');
const { generateInterviewReport } = require('../services/ai.service');
const { saveReport, getReportById, getReportsByUser } = require('../services/report.service');

/**
 * @name generateReportController
 * @description Coordinates the full AI pipeline:
 *   1. Validate inputs
 *   2. Extract + clean resume text (resumeParser.service)
 *   3. Build AI prompt (promptBuilder.service)
 *   4. Call Gemini + validate response (ai.service)
 *   5. Save to MongoDB (report.service)
 *   6. Return clean API response
 * @route POST /api/interview/generate
 * @access Private
 */
async function generateReportController(req, res) {
    try {
        const { selfDescription, jobDescription } = req.body;
        const userId = req.user.id;

        // ── Input validation ────────────────────────────────────────────────
        if (!req.file) {
            return res.status(400).json({ message: 'Resume PDF is required.' });
        }
        if (!jobDescription || jobDescription.trim().length < 20) {
            return res.status(400).json({ message: 'A valid job description is required (minimum 20 characters).' });
        }

        // ── Stage 1: Extract + clean resume text ────────────────────────────
        const resumeText = await extractTextFromPDF(req.file.buffer);

        // ── Stage 2: Build prompt ────────────────────────────────────────────
        const prompt = buildInterviewPrompt({
            resumeText,
            selfDescription: selfDescription || '',
            jobDescription: jobDescription.trim()
        });

        // ── Stage 3: Gemini AI call + schema validation ──────────────────────
        const aiResult = await generateInterviewReport({ prompt });

        // ── Stage 4: Persist to MongoDB ──────────────────────────────────────
        const report = await saveReport({
            userId,
            resumeText,
            selfDescription: selfDescription || '',
            jobDescription: jobDescription.trim(),
            aiResult
        });

        // ── Stage 5: Clean API response ──────────────────────────────────────
        return res.status(201).json({
            success:  true,
            reportId: report._id,
            analysis: aiResult
        });

    } catch (error) {
        // Zod validation failure — AI returned wrong shape
        if (error.name === 'ZodError') {
            return res.status(422).json({
                message: 'AI returned an invalid response structure. Please try again.'
            });
        }
        // PDF-related errors — use only user-safe messages produced by resumeParser.service
        if (error.message && (
            error.message.toLowerCase().includes('pdf') ||
            error.message.toLowerCase().includes('password-protected') ||
            error.message.toLowerCase().includes('scanned image')
        )) {
            // These messages are controlled by resumeParser.service and are user-safe
            const safePdfMessages = [
                'PDF appears to be empty',
                'PDF is password-protected',
                'does not appear to be a valid PDF',
                'PDF could not be read',
            ];
            const isSafe = safePdfMessages.some(s => error.message.includes(s));
            const clientMessage = isSafe
                ? error.message
                : 'Could not read the uploaded PDF. Please ensure it is a valid, text-based PDF file.';
            return res.status(400).json({ message: clientMessage });
        }
        // Rate-limit errors (429)
        if (error.status === 429 || error.code === 'rate_limit_exceeded' || (error.message && error.message.toLowerCase().includes('rate limit'))) {
            return res.status(429).json({
                message: 'AI service rate limit reached. Please wait a moment and try again.'
            });
        }
        // Token limit exceeded (Groq 413)
        if (
            error.status === 413 ||
            (error.message && (
                error.message.includes('Request too large') ||
                error.message.includes('tokens per minute') ||
                error.message.includes('TPM')
            ))
        ) {
            return res.status(413).json({
                message: 'Your resume or job description is too long for the AI to process. Please shorten your job description to under 2000 characters and try again.'
            });
        }
        // Generic server error
        console.error('[interview.controller] Unhandled error:', error.message || error);
        return res.status(500).json({ message: 'Report generation failed. Please try again.' });
    }
}

/**
 * @name getReportController
 * @description Fetches one full report by ID, scoped to the authenticated user.
 * @route GET /api/interview/reports/:reportId
 * @access Private
 */
async function getReportController(req, res) {
    try {
        const { reportId } = req.params;
        const userId = req.user.id;

        const report = await getReportById(reportId, userId);

        if (!report) {
            return res.status(404).json({ message: 'Report not found.' });
        }

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error('[interview.controller] getReport error:', error.message);
        return res.status(500).json({ message: 'Failed to retrieve report.' });
    }
}

/**
 * @name getUserReportsController
 * @description Returns a lightweight list of all reports for the authenticated user.
 * @route GET /api/interview/reports
 * @access Private
 */
async function getUserReportsController(req, res) {
    try {
        const reports = await getReportsByUser(req.user.id);
        return res.status(200).json({ success: true, reports });
    } catch (error) {
        console.error('[interview.controller] getUserReports error:', error.message);
        return res.status(500).json({ message: 'Failed to retrieve reports.' });
    }
}

module.exports = {
    generateReportController,
    getReportController,
    getUserReportsController
};
