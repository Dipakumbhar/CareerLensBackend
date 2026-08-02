const { Router } = require('express');

const interviewRouter      = Router();
const interviewController  = require('../controllers/interview.controller');
const authMiddleware       = require('../middlewares/auth.middleware');
const upload               = require('../middlewares/upload.middleware');

/**
 * @route  POST /api/interview/generate
 * @desc   Upload resume PDF + text inputs → run full AI pipeline → return report
 * @access Private  (JWT cookie required)
 * @body   multipart/form-data: resume (PDF), selfDescription (string), jobDescription (string)
 */
interviewRouter.post(
    '/generate',
    authMiddleware.authUser,
    upload.single('resume'),
    interviewController.generateReportController
);

/**
 * @route  GET /api/interview/reports
 * @desc   Fetch lightweight list of all reports for the logged-in user
 * @access Private
 */
interviewRouter.get(
    '/reports',
    authMiddleware.authUser,
    interviewController.getUserReportsController
);

/**
 * @route  GET /api/interview/reports/:reportId
 * @desc   Fetch one full report by ID (scoped to authenticated user)
 * @access Private
 */
interviewRouter.get(
    '/reports/:reportId',
    authMiddleware.authUser,
    interviewController.getReportController
);

module.exports = interviewRouter;
