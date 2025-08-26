const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { generateTokens, verifyRefreshToken } = require('../config/jwt');

// Store refresh tokens in memory (in real app would use Redis or database)
let validRefreshTokens = [];

// User registration
const registerUser = async (req, res) => {
  try {
    const { username, email, password, role = 'customer' } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username or email already taken' });
    }

    // Hash the password before storing
    const saltRounds = 12; // Higher number = more secure but slower
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user into database
    const insertResult = await query(
      'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
      [username, email, hashedPassword, role]
    );

    const newUserId = insertResult.insertId;

    // Generate tokens for immediate login after registration
    const tokenPayload = { 
      id: newUserId, 
      username, 
      email, 
      role 
    };
    const tokens = generateTokens(tokenPayload);

    // Store refresh token
    validRefreshTokens.push(tokens.refreshToken);

    // Set refresh token as secure cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true, // HTTPS only
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    res.status(201).json({
      message: 'User registered successfully',
      accessToken: tokens.accessToken,
      user: { id: newUserId, username, email, role }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

// User login
const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Find user by username or email
    const users = await query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }

    const user = users[0];

    // Check if password matches
    const passwordMatches = await bcrypt.compare(password, user.password);
    
    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid login credentials' });
    }

    // Create tokens
    const tokenPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    const tokens = generateTokens(tokenPayload);

    // Store refresh token
    validRefreshTokens.push(tokens.refreshToken);

    // Set refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

// Refresh access token using refresh token
const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    // Check if refresh token is in our valid tokens list
    if (!validRefreshTokens.includes(refreshToken)) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    try {
      // Verify the refresh token
      const decodedToken = verifyRefreshToken(refreshToken);
      
      // Generate new token pair
      const newTokens = generateTokens({
        id: decodedToken.id,
        username: decodedToken.username,
        email: decodedToken.email,
        role: decodedToken.role
      });

      // Replace old refresh token with new one
      const tokenIndex = validRefreshTokens.indexOf(refreshToken);
      validRefreshTokens[tokenIndex] = newTokens.refreshToken;

      // Update cookie
      res.cookie('refreshToken', newTokens.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        accessToken: newTokens.accessToken,
        user: {
          id: decodedToken.id,
          username: decodedToken.username,
          email: decodedToken.email,
          role: decodedToken.role
        }
      });

    } catch (error) {
      return res.status(403).json({ message: 'Refresh token expired or invalid' });
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

// Logout user
const logoutUser = (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (refreshToken) {
      // Remove refresh token from valid tokens list
      validRefreshTokens = validRefreshTokens.filter(token => token !== refreshToken);
    }

    // Clear the cookie
    res.clearCookie('refreshToken');
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Logout failed' });
  }
};

module.exports = {
  register: registerUser,
  login: loginUser,
  refreshToken: refreshAccessToken,
  logout: logoutUser
};