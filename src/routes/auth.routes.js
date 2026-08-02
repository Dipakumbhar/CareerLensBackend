const {Router}= require('express');
const authRouter = Router();
const authController=require('../controllers/auth.controller');
const authMiddleware=require('../middlewares/auth.middleware');
/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */

authRouter.post("/register",authController.registerUserController)
authRouter.post("/login",authController.loginUserController)

/**
 * @route GET /api/auth/logout
 * @desc Logout a user
 * @access Public
 */
authRouter.get("/logout",authController.logoutUserController);

/**
 * @route GET /api/auth/blacklist
 * @desc Get all blacklisted tokens
 * @access private
 */
authRouter.get("/get-me",authMiddleware.authUser,authController.getMeController);
module.exports = authRouter
