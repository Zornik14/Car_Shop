// Handles all auth-related endpoints with validation

const express = require('express');
const { body, validationResult } = require('express-validator');
const { register, login, refreshToken, logout } = require('../controllers/authController');

const router = express.Router();

// Helper function to handle validation errors
const checkValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Validation rules for registration
const validateRegistration = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3-50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers and underscores'),
  
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase and number'),
  
  body('role')
    .optional()
    .isIn(['admin', 'customer'])
    .withMessage('Role must be admin or customer')
];

// Validation rules for login
const validateLogin = [
  body('username')
    .notEmpty()
    .withMessage('Username or email is required')
    .trim(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// POST /api/auth/register - Register new user
router.post('/register', validateRegistration, checkValidationErrors, register);

// POST /api/auth/login - Login user
router.post('/login', validateLogin, checkValidationErrors, login);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', refreshToken);

// POST /api/auth/logout - Logout user
router.post('/logout', logout);

module.exports = router;    