// Handles creation and verification of access and refresh tokens

const jwt = require('jsonwebtoken');

// JWT secrets - in production these should be much longer and random
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'TODO';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'TODO';

// Token expiration times
const ACCESS_TOKEN_EXPIRES = '15m'; // Short lived for security
const REFRESH_TOKEN_EXPIRES = '7d'; // Longer lived for convenience

// Function to generate both tokens at once
const createTokenPair = (userPayload) => {
  // Create access token with short expiration
  const accessToken = jwt.sign(userPayload, ACCESS_TOKEN_SECRET, { 
    expiresIn: ACCESS_TOKEN_EXPIRES 
  });
  
  // Create refresh token with longer expiration
  const refreshToken = jwt.sign(userPayload, REFRESH_TOKEN_SECRET, { 
    expiresIn: REFRESH_TOKEN_EXPIRES 
  });

  return { accessToken, refreshToken };
};

// Verify access token
const validateAccessToken = (token) => {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET);
  } catch (error) {
    throw error; // Let the calling function handle the error
  }
};

// Verify refresh token
const validateRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
  } catch (error) {
    throw error;
  }
};

module.exports = {
  generateTokens: createTokenPair,
  verifyAccessToken: validateAccessToken,
  verifyRefreshToken: validateRefreshToken,
  JWT_ACCESS_SECRET: ACCESS_TOKEN_SECRET,
  JWT_REFRESH_SECRET: REFRESH_TOKEN_SECRET,
  JWT_ACCESS_EXPIRES_IN: ACCESS_TOKEN_EXPIRES,
  JWT_REFRESH_EXPIRES_IN: REFRESH_TOKEN_EXPIRES
};