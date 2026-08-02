const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const tokenBlacklistModel = require("../models/blacklist.model");

const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: isProduction,           // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-domain (Vercel → Render)
    maxAge: 24 * 60 * 60 * 1000    // 1 day in ms — matches JWT expiresIn: "1d"
};

/**
 * @name generateToken
 * @description Sign a JWT for the given user document
 */
function generateToken(user) {
    return jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    );
}

/**
 * @name formatUser
 * @description Return a safe, consistent user shape for API responses
 */
function formatUser(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email
    };
}

/**
 * @name registerUserController
 * @description Register a new user
 * @access Public
 */
async function registerUserController(req, res) {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const isUserAlreadyExist = await userModel.findOne({
            $or: [{ username }, { email }]
        });

        if (isUserAlreadyExist) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const user = await userModel.create({
            username,
            email,
            password: hash
        });

        const token = generateToken(user);
        res.cookie("token", token, COOKIE_OPTIONS);

        return res.status(201).json({
            message: "User created successfully",
            user: formatUser(user)
        });
    } catch (error) {
        console.error('[auth] Register error:', error.message);
        return res.status(500).json({
            message: 'Registration failed. Please try again.'
        });
    }
}

/**
 * @name loginUserController
 * @description Login a user
 * @access Public
 */
async function loginUserController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and Password are required"
            });
        }

        const user = await userModel.findOne({ email });

        // Combined check — same message for "no account" and "wrong password"
        // to prevent user enumeration attacks
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                message: 'Invalid email or password.'
            });
        }

        const token = generateToken(user);
        res.cookie("token", token, COOKIE_OPTIONS);

        return res.status(200).json({
            message: "Login successful",
            user: formatUser(user)
        });
    } catch (error) {
        console.error('[auth] Login error:', error.message);
        return res.status(500).json({
            message: 'Login failed. Please try again.'
        });
    }
}

/**
 * @name logoutUserController
 * @description Logout a user
 * @access Public
 */
async function logoutUserController(req, res) {
    const token = req.cookies.token;
    if (token) {
        await tokenBlacklistModel.create({ token: token });
    }
    res.clearCookie('token', {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    });
    res.status(200).json({
        message: "Logout successful"
    });
}

/**
 * @name getMeController
 * @description Get the logged in user's details
 * @access Private
 */
async function getMeController(req, res) {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({
            message: 'User fetched successfully',
            user: formatUser(user)
        });
    } catch (error) {
        console.error('[auth] GetMe error:', error.message);
        res.status(500).json({ message: 'Failed to fetch user.' });
    }
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController
};