const InterviewReportModel = require('../models/interviewReport.model');

/**
 * @name saveReport
 * @description Persists the full AI-generated report to MongoDB, linked to the user.
 * @param {object} params
 * @param {string}  params.userId         - Authenticated user's ObjectId
 * @param {string}  params.resumeText     - Cleaned resume text
 * @param {string}  params.selfDescription
 * @param {string}  params.jobDescription
 * @param {object}  params.aiResult       - Validated Zod-parsed AI response
 * @returns {Promise<Document>} Saved Mongoose document
 */
async function saveReport({ userId, resumeText, selfDescription, jobDescription, aiResult }) {
    const report = await InterviewReportModel.create({
        userId,
        resumeText,
        selfDescription: selfDescription || '',
        jobDescription,

        candidateSummary:        aiResult.candidateSummary,
        atsAnalysis:             aiResult.atsAnalysis,
        resumeScore:             aiResult.resumeScore,
        interviewReadinessScore: aiResult.interviewReadinessScore,
        confidenceLevel:         aiResult.confidenceLevel,
        hiringRecommendation:    aiResult.hiringRecommendation,

        strengths:               aiResult.strengths,
        weaknesses:              aiResult.weaknesses,
        improvementSuggestions:  aiResult.improvementSuggestions,

        technicalQuestions:    aiResult.technicalQuestions,
        behavioralQuestions:   aiResult.behavioralQuestions,
        hrQuestions:           aiResult.hrQuestions,
        systemDesignQuestions: aiResult.systemDesignQuestions,
        projectBasedQuestions: aiResult.projectBasedQuestions,

        skillGapAnalysis:        aiResult.skillGapAnalysis,
        learningRecommendations: aiResult.learningRecommendations,
        learningRoadmap:         aiResult.learningRoadmap,
    });

    return report;
}

/**
 * @name getReportById
 * @description Fetches one report by ID, scoped to the requesting user.
 * @param {string} reportId
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function getReportById(reportId, userId) {
    return InterviewReportModel.findOne({ _id: reportId, userId }).lean();
}

/**
 * @name getReportsByUser
 * @description Returns a lightweight list of all reports for the user, newest first.
 *              Only selects the fields needed for a report history list view.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function getReportsByUser(userId) {
    return InterviewReportModel
        .find({ userId })
        .select('_id candidateSummary jobDescription atsAnalysis.overallScore interviewReadinessScore confidenceLevel createdAt')
        .sort({ createdAt: -1 })
        .lean();
}

module.exports = { saveReport, getReportById, getReportsByUser };
