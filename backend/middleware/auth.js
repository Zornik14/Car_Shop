// This protects routes and checks if user has valid tokens

const { verifyAccessToken } = require('../config/jwt');

// Main authentication middleware
const checkAuth = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Remove 'Bearer ' prefix

  if (!token) {
    return res.status(401).json({ message: 'Access token is required' });
  }

  try {
    // Verify the token and get user data
    const decodedUser = verifyAccessToken(token);
    req.user = decodedUser; // Add user info to request object
    next(); // Continue to next middleware/route handler
  } catch (error) {
    // Handle different types of token errors
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Access token has expired',
        expired: true 
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Invalid access token' });
    } else {
      return res.status(403).json({ message: 'Token verification failed' });
    }
  }
};

// Admin-only middleware - use after checkAuth
const requireAdmin = (req, res, next) => {
  // Check if user has admin role
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges required' });
  }
  next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null; // No user logged in
    return next();
  }

  try {
    const decodedUser = verifyAccessToken(token);
    req.user = decodedUser;
  } catch (error) {
    req.user = null; // Invalid token, treat as not logged in
  }
  next();
};

module.exports = {
  authenticateToken: checkAuth,
  requireAdmin,
  optionalAuth
};