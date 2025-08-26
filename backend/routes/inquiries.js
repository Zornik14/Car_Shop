const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Inquiry validation rules
const inquiryValidation = [
  body('car_id')
    .isInt({ min: 1 })
    .withMessage('Valid car ID is required'),
  body('message')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Message must be between 10 and 1000 characters')
];

// Get user's inquiries
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE i.user_id = ?';
    const params = [userId];

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM inquiries i 
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    // Get inquiries with car details
    const inquiriesQuery = `
      SELECT 
        i.*,
        c.make,
        c.model,
        c.year,
        c.price,
        c.image_url
      FROM inquiries i
      JOIN cars c ON i.car_id = c.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const inquiries = await query(inquiriesQuery, [...params, parseInt(limit), offset]);

    res.json({
      inquiries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ message: 'Failed to fetch inquiries' });
  }
});

// Get all inquiries (admin only)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (userId) {
      whereClause += ' AND i.user_id = ?';
      params.push(userId);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM inquiries i 
      ${whereClause}
    `;
    const countResult = await query(countQuery, params);
    const total = countResult[0].total;

    // Get inquiries with user and car details
    const inquiriesQuery = `
      SELECT 
        i.*,
        u.username,
        u.email,
        c.make,
        c.model,
        c.year,
        c.price,
        c.image_url
      FROM inquiries i
      JOIN users u ON i.user_id = u.id
      JOIN cars c ON i.car_id = c.id
      ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const inquiries = await query(inquiriesQuery, [...params, parseInt(limit), offset]);

    res.json({
      inquiries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get all inquiries error:', error);
    res.status(500).json({ message: 'Failed to fetch inquiries' });
  }
});

// Get single inquiry
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let inquiryQuery = `
      SELECT 
        i.*,
        u.username,
        u.email,
        c.make,
        c.model,
        c.year,
        c.price,
        c.image_url,
        c.description
      FROM inquiries i
      JOIN users u ON i.user_id = u.id
      JOIN cars c ON i.car_id = c.id
      WHERE i.id = ?
    `;

    const params = [id];

    // Non-admin users can only see their own inquiries
    if (!isAdmin) {
      inquiryQuery += ' AND i.user_id = ?';
      params.push(userId);
    }

    const inquiries = await query(inquiryQuery, params);

    if (inquiries.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    res.json(inquiries[0]);

  } catch (error) {
    console.error('Get inquiry error:', error);
    res.status(500).json({ message: 'Failed to fetch inquiry' });
  }
});

// Create inquiry
router.post('/', authenticateToken, inquiryValidation, handleValidationErrors, async (req, res) => {
  try {
    const { car_id, message } = req.body;
    const userId = req.user.id;

    // Check if car exists and is available
    const cars = await query('SELECT id, is_available FROM cars WHERE id = ?', [car_id]);
    
    if (cars.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    if (!cars[0].is_available) {
      return res.status(400).json({ message: 'Car is not available for inquiries' });
    }

    // Check if user already has a pending inquiry for this car
    const existingInquiries = await query(
      'SELECT id FROM inquiries WHERE user_id = ? AND car_id = ? AND status = ?',
      [userId, car_id, 'pending']
    );

    if (existingInquiries.length > 0) {
      return res.status(409).json({ 
        message: 'You already have a pending inquiry for this car' 
      });
    }

    // Create inquiry
    const result = await query(
      'INSERT INTO inquiries (user_id, car_id, message) VALUES (?, ?, ?)',
      [userId, car_id, message]
    );

    // Get the created inquiry with car details
    const newInquiry = await query(`
      SELECT 
        i.*,
        c.make,
        c.model,
        c.year,
        c.price,
        c.image_url
      FROM inquiries i
      JOIN cars c ON i.car_id = c.id
      WHERE i.id = ?
    `, [result.insertId]);

    res.status(201).json({
      message: 'Inquiry created successfully',
      inquiry: newInquiry[0]
    });

  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(500).json({ message: 'Failed to create inquiry' });
  }
});

// Update inquiry status (admin only)
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'responded', 'closed'].includes(status)) {
      return res.status(400).json({ 
        message: 'Status must be pending, responded, or closed' 
      });
    }

    // Check if inquiry exists
    const existingInquiries = await query('SELECT id FROM inquiries WHERE id = ?', [id]);
    
    if (existingInquiries.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    // Update inquiry status
    await query(
      'UPDATE inquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    // Get updated inquiry with details
    const updatedInquiry = await query(`
      SELECT 
        i.*,
        u.username,
        u.email,
        c.make,
        c.model,
        c.year,
        c.price
      FROM inquiries i
      JOIN users u ON i.user_id = u.id
      JOIN cars c ON i.car_id = c.id
      WHERE i.id = ?
    `, [id]);

    res.json({
      message: 'Inquiry status updated successfully',
      inquiry: updatedInquiry[0]
    });

  } catch (error) {
    console.error('Update inquiry status error:', error);
    res.status(500).json({ message: 'Failed to update inquiry status' });
  }
});

// Delete inquiry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if inquiry exists
    const inquiries = await query('SELECT user_id FROM inquiries WHERE id = ?', [id]);
    
    if (inquiries.length === 0) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    // Non-admin users can only delete their own inquiries
    if (!isAdmin && inquiries[0].user_id !== userId) {
      return res.status(403).json({ message: 'You can only delete your own inquiries' });
    }

    await query('DELETE FROM inquiries WHERE id = ?', [id]);

    res.json({ message: 'Inquiry deleted successfully' });

  } catch (error) {
    console.error('Delete inquiry error:', error);
    res.status(500).json({ message: 'Failed to delete inquiry' });
  }
});

// Get inquiry statistics (admin only)
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_inquiries,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_inquiries,
        COUNT(CASE WHEN status = 'responded' THEN 1 END) as responded_inquiries,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_inquiries
      FROM inquiries
    `);

    const recentInquiries = await query(`
      SELECT COUNT(*) as recent_inquiries
      FROM inquiries 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    const topCars = await query(`
      SELECT 
        c.make,
        c.model,
        c.year,
        COUNT(i.id) as inquiry_count
      FROM cars c
      JOIN inquiries i ON c.id = i.car_id
      GROUP BY c.id, c.make, c.model, c.year
      ORDER BY inquiry_count DESC
      LIMIT 5
    `);

    res.json({
      overview: {
        ...stats[0],
        recent_inquiries: recentInquiries[0].recent_inquiries
      },
      most_inquired_cars: topCars
    });

  } catch (error) {
    console.error('Get inquiry stats error:', error);
    res.status(500).json({ message: 'Failed to fetch inquiry statistics' });
  }
});

module.exports = router;