const { sendError } = require('../utils/response');

// Middleware to validate request body is not empty
const validateRequestBody = (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return sendError(
            res,
            'Request body is required',
            'VALIDATION_ERROR',
            400
        );
    }
    next();
};

// Validate register endpoint
const validateRegister = (req, res, next) => {
    const { organisationName, name, email, password } = req.body;

    // Check all required fields are present
    if (!organisationName || !name || !email || !password) {
        return sendError(
            res,
            'Organisation name, your name, email and password are required',
            'VALIDATION_ERROR',
            400
        );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return sendError(
            res,
            'Invalid email format',
            'VALIDATION_ERROR',
            400
        );
    }

    // Validate password length
    if (password.length < 6) {
        return sendError(
            res,
            'Password must be at least 6 characters long',
            'VALIDATION_ERROR',
            400
        );
    }

    next();
};

// Validate login endpoint
const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return sendError(
            res,
            'Email and password are required',
            'VALIDATION_ERROR',
            400
        );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return sendError(
            res,
            'Invalid email format',
            'VALIDATION_ERROR',
            400
        );
    }

    next();
};

// Validate forgot-password endpoint
const validateForgotPassword = (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return sendError(
            res,
            'Email is required',
            'VALIDATION_ERROR',
            400
        );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return sendError(
            res,
            'Invalid email format',
            'VALIDATION_ERROR',
            400
        );
    }

    next();
};

// Validate reset-password endpoint
const validateResetPassword = (req, res, next) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return sendError(
            res,
            'Token and new password are required',
            'VALIDATION_ERROR',
            400
        );
    }

    if (password.length < 6) {
        return sendError(
            res,
            'Password must be at least 6 characters long',
            'VALIDATION_ERROR',
            400
        );
    }

    next();
};

module.exports = {
    validateRequestBody,
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword
};
