/**
 * @name truncateText
 * @description Truncates text to maxChars at a clean word boundary.
 *              Keeps the first 60% and last 40% of the budget (head + tail)
 *              so both the opening summary and closing details survive.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncateText(text, maxChars) {
    if (!text || text.length <= maxChars) return text || '';

    const headBudget = Math.floor(maxChars * 0.6);
    const tailBudget = maxChars - headBudget - 5; // 5 chars for ' ... '

    let head = text.slice(0, headBudget);
    const lastSpaceHead = head.lastIndexOf(' ');
    if (lastSpaceHead > headBudget * 0.8) head = head.slice(0, lastSpaceHead);

    let tail = text.slice(text.length - tailBudget);
    const firstSpaceTail = tail.indexOf(' ');
    if (firstSpaceTail > 0 && firstSpaceTail < tailBudget * 0.2) tail = tail.slice(firstSpaceTail + 1);

    return `${head} ... ${tail}`;
}

/**
 * @name buildInterviewPrompt
 * @description Constructs a compact prompt that instructs the LLM to act as
 *              Senior Recruiter, Engineering Manager, ATS Scanner, Interview Panel,
 *              and Career Coach — while staying within Groq's 12,000 TPM limit.
 *
 *              Input fields are truncated so the entire prompt stays well under
 *              ~4,000 tokens (approx 16,000 characters).
 *
 * @param {object} params
 * @param {string} params.resumeText      - Cleaned resume text
 * @param {string} params.selfDescription - Candidate's self-description (may be empty)
 * @param {string} params.jobDescription  - Full job description
 * @returns {string} The complete prompt string
 */
function buildInterviewPrompt({ resumeText, selfDescription, jobDescription }) {
    const resume  = truncateText(resumeText,      2000);
    const jd      = truncateText(jobDescription,  1500);
    const self    = truncateText(selfDescription,  300);
    const hasSelf = self && self.trim().length > 0;

    return `You are acting as: Senior Technical Recruiter, Engineering Manager, ATS Scanner, Interview Panel, and Career Coach.
Be specific to THIS candidate, THIS resume, and THIS job. No generic content.

=== RESUME (max 2000 chars) ===
${resume}

=== CANDIDATE SELF-DESCRIPTION ===
${hasSelf ? self : 'Not provided — infer from resume.'}

=== JOB DESCRIPTION (max 1500 chars) ===
${jd}

=== TASK ===
Return ONLY a single valid JSON object — no markdown, no code fences.
Every field below is required. Ground all content in the actual resume and JD.
COUNTS REQUIRED: technicalQuestions=4, behavioralQuestions=3, hrQuestions=2, systemDesignQuestions=1, projectBasedQuestions=2, learningRoadmap=4 weeks.

{
  "candidateSummary": "<2-3 sentence professional summary specific to this candidate and role>",

  "atsAnalysis": {
    "overallScore": <0-100 weighted average>,
    "keywordMatch": <0-100>,
    "skillMatch": <0-100>,
    "experienceMatch": <0-100>,
    "educationMatch": <0-100>,
    "matchingSkills": ["<skill in BOTH resume and JD>"],
    "missingSkills": ["<skill required by JD but absent from resume>"],
    "missingKeywords": ["<important JD keyword absent from resume>"],
    "explanation": "<paragraph explaining scores>"
  },

  "resumeScore": <0-100>,

  "strengths": ["<specific strength 1>", "<strength 2>", "<strength 3>", "<strength 4>", "<strength 5>"],

  "weaknesses": ["<gap 1>", "<gap 2>", "<gap 3>"],

  "improvementSuggestions": ["<actionable suggestion 1>", "<suggestion 2>", "<suggestion 3>", "<suggestion 4>", "<suggestion 5>"],

  "technicalQuestions": [
    {
      "question": "<technical question specific to resume tech stack vs JD>",
      "difficulty": "easy|medium|hard",
      "intention": "<what the interviewer probes>",
      "idealAnswer": "<comprehensive model answer>",
      "commonMistakes": ["<mistake 1>", "<mistake 2>"]
    }
    // exactly 4 items
  ],

  "behavioralQuestions": [
    {
      "question": "<STAR-format behavioral question tied to candidate resume>",
      "difficulty": "easy|medium|hard",
      "intention": "<behaviour/trait being assessed>",
      "idealAnswer": "<STAR-structured ideal response guidance>",
      "commonMistakes": ["<mistake>"]
    }
    // exactly 3 items
  ],

  "hrQuestions": [
    {
      "question": "<HR/culture-fit question>",
      "difficulty": "easy|medium|hard",
      "intention": "<what HR evaluates>",
      "idealAnswer": "<ideal answer framing>",
      "commonMistakes": ["<mistake>"]
    }
    // exactly 2 items
  ],

  "systemDesignQuestions": [
    {
      "question": "<system design question relevant to this role and candidate experience level>",
      "difficulty": "easy|medium|hard",
      "intention": "<architectural thinking being tested>",
      "idealAnswer": "<structured answer: requirements, design, components, trade-offs>",
      "commonMistakes": ["<common design mistake>"]
    }
    // exactly 1 item
  ],

  "projectBasedQuestions": [
    {
      "question": "<question about a SPECIFIC project in the candidate resume>",
      "difficulty": "easy|medium|hard",
      "intention": "<depth of ownership/understanding being probed>",
      "idealAnswer": "<ideal answer referencing actual project details>",
      "commonMistakes": ["<mistake>"]
    }
    // exactly 2 items
  ],

  "skillGapAnalysis": [
    {
      "skill": "<missing skill>",
      "category": "technology|framework|softSkill|certification",
      "priority": "high|medium|low",
      "reason": "<why this skill matters for this role>"
    }
  ],

  "learningRecommendations": [
    "<specific resource or action for the most critical gap>",
    "<recommendation 2>",
    "<recommendation 3>",
    "<recommendation 4>",
    "<recommendation 5>"
  ],

  "learningRoadmap": [
    {
      "weekTitle": "<e.g. Week 1: Foundations>",
      "focus": "<primary focus area for this week>",
      "tasks": ["<specific task 1>", "<task 2>", "<task 3>"],
      "resources": ["<resource URL or name>"]
    }
    // exactly 4 week objects
  ],

  "interviewReadinessScore": <0-100>,
  "confidenceLevel": "low|moderate|high|very high",
  "hiringRecommendation": "<2-3 sentence hiring recommendation from a hiring manager perspective>"
}`;
}

module.exports = { buildInterviewPrompt };
