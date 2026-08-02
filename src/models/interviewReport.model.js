const mongoose = require('mongoose');

// ─── Sub-schemas ─────────────────────────────────────────────────────────────

const questionSchema = new mongoose.Schema(
    {
        question:        { type: String, required: true },
        difficulty:      { type: String, enum: ['easy', 'medium', 'hard'], required: true },
        intention:       { type: String, required: true },
        idealAnswer:     { type: String, required: true },
        commonMistakes:  [{ type: String }]
    },
    { _id: false }
);

const atsAnalysisSchema = new mongoose.Schema(
    {
        overallScore:     { type: Number, min: 0, max: 100 },
        keywordMatch:     { type: Number, min: 0, max: 100 },
        skillMatch:       { type: Number, min: 0, max: 100 },
        experienceMatch:  { type: Number, min: 0, max: 100 },
        educationMatch:   { type: Number, min: 0, max: 100 },
        matchingSkills:   [{ type: String }],
        missingSkills:    [{ type: String }],
        missingKeywords:  [{ type: String }],
        explanation:      { type: String }
    },
    { _id: false }
);

const skillGapSchema = new mongoose.Schema(
    {
        skill:    { type: String, required: true },
        category: { type: String, enum: ['technology', 'framework', 'softSkill', 'certification'], required: true },
        priority: { type: String, enum: ['high', 'medium', 'low'], required: true },
        reason:   { type: String, required: true }
    },
    { _id: false }
);

const learningRoadmapWeekSchema = new mongoose.Schema(
    {
        weekTitle:  { type: String },
        focus:      { type: String },
        tasks:      [{ type: String }],
        resources:  [{ type: String }]
    },
    { _id: false }
);

// ─── Root schema ─────────────────────────────────────────────────────────────

const interviewReportSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required']
        },

        // Raw inputs stored for auditing / re-generation
        resumeText:      { type: String, required: true },
        selfDescription: { type: String, default: '' },
        jobDescription:  { type: String, required: true },

        // AI-generated content
        candidateSummary:       { type: String },
        atsAnalysis:            { type: atsAnalysisSchema },
        resumeScore:            { type: Number, min: 0, max: 100 },
        interviewReadinessScore:{ type: Number, min: 0, max: 100 },
        confidenceLevel:        { type: String, enum: ['low', 'moderate', 'high', 'very high'] },
        hiringRecommendation:   { type: String },

        strengths:              [{ type: String }],
        weaknesses:             [{ type: String }],
        improvementSuggestions: [{ type: String }],

        technicalQuestions:    [questionSchema],
        behavioralQuestions:   [questionSchema],
        hrQuestions:           [questionSchema],
        systemDesignQuestions: [questionSchema],
        projectBasedQuestions: [questionSchema],

        skillGapAnalysis:        [skillGapSchema],
        learningRecommendations: [{ type: String }],
        learningRoadmap:         [learningRoadmapWeekSchema]
    },
    { timestamps: true }
);

const InterviewReportModel = mongoose.model('InterviewReport', interviewReportSchema);
module.exports = InterviewReportModel;