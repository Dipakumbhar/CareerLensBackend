const { z }    = require('zod');
const Groq     = require('groq-sdk');

if (!process.env.GROQ_API_KEY) {
    throw new Error('[ai.service] GROQ_API_KEY is not set. Cannot initialise AI service.');
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Zod schema — mirrors interviewReport.model.js exactly ───────────────────

const questionSchema = z.object({
    question:       z.string().describe('The interview question'),
    difficulty:     z.enum(['easy', 'medium', 'hard']),
    intention:      z.string().describe('What the interviewer is probing or testing'),
    idealAnswer:    z.string().describe('A comprehensive model answer'),
    commonMistakes: z.array(z.string()).describe('Mistakes candidates commonly make')
});

const roadmapWeekSchema = z.object({
    weekTitle: z.string().describe('e.g. Week 1: Foundations'),
    focus:     z.string().describe('Primary focus area for this week'),
    tasks:     z.array(z.string()),
    resources: z.array(z.string())
});

const aiResponseSchema = z.object({
    candidateSummary: z
        .string()
        .describe('2–3 sentence professional summary specific to this candidate and role'),

    atsAnalysis: z.object({
        overallScore:    z.number().min(0).max(100).describe('Weighted ATS match score'),
        keywordMatch:    z.number().min(0).max(100),
        skillMatch:      z.number().min(0).max(100),
        experienceMatch: z.number().min(0).max(100),
        educationMatch:  z.number().min(0).max(100),
        matchingSkills:  z.array(z.string()),
        missingSkills:   z.array(z.string()),
        missingKeywords: z.array(z.string()),
        explanation:     z.string()
    }),

    resumeScore:            z.number().min(0).max(100).describe('Overall resume quality score'),
    strengths:              z.array(z.string()).describe('Candidate strengths relative to this JD'),
    weaknesses:             z.array(z.string()),
    improvementSuggestions: z.array(z.string()),

    technicalQuestions:    z.array(questionSchema).describe('4 technical questions'),
    behavioralQuestions:   z.array(questionSchema).describe('3 behavioral questions'),
    hrQuestions:           z.array(questionSchema).describe('2 HR questions'),
    systemDesignQuestions: z.array(questionSchema).describe('1 system design question'),
    projectBasedQuestions: z.array(questionSchema).describe('2 project-based questions'),

    skillGapAnalysis: z.array(
        z.object({
            skill:    z.string(),
            category: z.enum(['technology', 'framework', 'softSkill', 'certification']),
            priority: z.enum(['high', 'medium', 'low']),
            reason:   z.string().describe('Why this skill matters for this specific role')
        })
    ),

    learningRecommendations: z.array(z.string()),

    learningRoadmap: z.array(roadmapWeekSchema).describe('4-week personalised preparation roadmap'),

    interviewReadinessScore: z.number().min(0).max(100),
    confidenceLevel:         z.enum(['low', 'moderate', 'high', 'very high']),
    hiringRecommendation:    z.string().describe('Final hiring recommendation paragraph')
});

// ─── Retry helpers ────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 5_000;

/**
 * Checks whether an error is a retriable rate-limit (HTTP 429).
 */
function isRateLimitError(err) {
    const status = err?.status || err?.statusCode || err?.error?.code;
    const msg    = (err?.message || '').toLowerCase();

    // 429 rate limit
    if (status === 429 || msg.includes('429') || msg.includes('rate_limit')) return true;

    // 413 / Request too large — treat as non-retriable but surface clearly
    if (status === 413 || msg.includes('request too large') || msg.includes('413')) {
        throw new Error(
            'Your resume or job description is too large for the AI to process. '
            + 'Please shorten the inputs and try again.'
        );
    }

    return false;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── System prompt — forces strict JSON output ───────────────────────────────

const SYSTEM_PROMPT = `You are an expert technical recruiter and career analyst AI.
You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanations, no text before or after the JSON.
Your response must be a single JSON object that strictly follows the schema provided in the user message.
Every field in the schema is required. Do not omit any field.
Do not wrap the JSON in backticks or markdown code blocks.
Output raw JSON only.`;

// ─── Service function ─────────────────────────────────────────────────────────

/**
 * @name generateInterviewReport
 * @description Sends the pre-built prompt to Groq (llama-3.3-70b-versatile),
 *              enforces JSON-only output via system prompt, then validates
 *              the parsed response against the Zod schema.
 *              Includes automatic retry with exponential backoff for 429 errors.
 *
 * @param {object} params
 * @param {string} params.prompt - The complete prompt from promptBuilder.service.js
 * @returns {Promise<object>} Validated AI report conforming to aiResponseSchema
 * @throws {Error} On API failure, JSON parse failure, or schema validation failure
 */
async function generateInterviewReport({ prompt }) {
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const chatCompletion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user',   content: prompt }
                ],
                temperature: 0.4,
                max_tokens: 8192,
                response_format: { type: 'json_object' },
            });

            const rawText = chatCompletion.choices?.[0]?.message?.content;

            if (!rawText) {
                throw new Error('Groq returned an empty response. Please try again.');
            }

            // Parse — will throw SyntaxError if response is malformed JSON
            const parsed = JSON.parse(rawText);

            // Validate — will throw ZodError if shape doesn't match
            const validated = aiResponseSchema.parse(parsed);

            return validated;

        } catch (err) {
            lastError = err;

            if (isRateLimitError(err) && attempt < MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
                console.warn(
                    `[ai.service] Rate limited (attempt ${attempt}/${MAX_RETRIES}). `
                    + `Retrying in ${(delay / 1000).toFixed(0)}s…`
                );
                await sleep(delay);
                continue;
            }

            // Non-retriable errors — throw immediately
            throw err;
        }
    }

    // All retries exhausted
    throw lastError;
}

module.exports = { generateInterviewReport };