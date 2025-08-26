// Handles all car-related operations (CRUD)

const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Validation error handler
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      message: 'Input validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Car input validation rules
const carValidationRules = [
  body('make')
    .isLength({ min: 1, max: 50 })
    .withMessage('Car make is required (max 50 chars)'),
  body('model')
    .isLength({ min: 1, max: 50 })
    .withMessage('Car model is required (max 50 chars)'),
  body('year')
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Enter valid year'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be positive number'),
  body('mileage')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Mileage must be positive'),
  body('color')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Color too long (max 30 chars)'),
  body('fuel_type')
    .optional()
    .isIn(['gasoline', 'diesel', 'electric', 'hybrid'])
    .withMessage('Invalid fuel type'),
  body('transmission')
    .optional()
    .isIn(['manual', 'automatic'])
    .withMessage('Transmission must be manual or automatic'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description too long (max 1000 chars)'),
  body('image_url')
    .optional()
    .isURL()
    .withMessage('Must be valid URL')
];

// GET /api/cars - Get all cars with optional filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      make, 
      model, 
      minPrice, 
      maxPrice, 
      fuelType, 
      transmission,
      available = 'true'
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = 'WHERE 1=1'; // Always true condition to start
    const queryParams = [];

    // Build dynamic WHERE clause based on filters
    if (available === 'true') {
      whereConditions += ' AND is_available = ?';
      queryParams.push(1);
    }

    if (make) {
      whereConditions += ' AND make LIKE ?';
      queryParams.push(`%${make}%`);
    }

    if (model) {
      whereConditions += ' AND model LIKE ?';
      queryParams.push(`%${model}%`);
    }

    if (minPrice) {
      whereConditions += ' AND price >= ?';
      queryParams.push(minPrice);
    }

    if (maxPrice) {
      whereConditions += ' AND price <= ?';
      queryParams.push(maxPrice);
    }

    if (fuelType) {
      whereConditions += ' AND fuel_type = ?';
      queryParams.push(fuelType);
    }

    if (transmission) {
      whereConditions += ' AND transmission = ?';
      queryParams.push(transmission);
    }

    // Get total count for pagination
    const countSQL = `SELECT COUNT(*) as total FROM cars ${whereConditions}`;
    const countResult = await query(countSQL, queryParams);
    const totalCars = countResult[0].total;

    // Get cars with pagination
    const carsSQL = `
      SELECT * FROM cars 
      ${whereConditions} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const cars = await query(carsSQL, [...queryParams, parseInt(limit), offset]);

    res.json({
      cars,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCars,
        pages: Math.ceil(totalCars / limit)
      }
    });

  } catch (error) {
    console.error('Get cars error:', error);
    res.status(500).json({ message: 'Failed to fetch cars' });
  }
});

// GET /api/cars/:id - Get single car by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const cars = await query('SELECT * FROM cars WHERE id = ?', [id]);
    
    if (cars.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    res.json(cars[0]);

  } catch (error) {
    console.error('Get car by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch car details' });
  }
});

// POST /api/cars - Create new car (admin only)
router.post('/', authenticateToken, requireAdmin, carValidationRules, handleValidation, async (req, res) => {
  try {
    const {
      make,
      model,
      year,
      price,
      mileage = 0,
      color,
      fuel_type = 'gasoline',
      transmission = 'manual',
      description,
      image_url,
      is_available = true
    } = req.body;

    // Insert new car
    const result = await query(
      `INSERT INTO cars (make, model, year, price, mileage, color, fuel_type, transmission, description, image_url, is_available) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [make, model, year, price, mileage, color, fuel_type, transmission, description, image_url, is_available]
    );

    // Get the created car
    const newCar = await query('SELECT * FROM cars WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'Car added successfully',
      car: newCar[0]
    });

  } catch (error) {
    console.error('Create car error:', error);
    res.status(500).json({ message: 'Failed to create car' });
  }
});

// PUT /api/cars/:id - Update car (admin only)
router.put('/:id', authenticateToken, requireAdmin, carValidationRules, handleValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      make,
      model,
      year,
      price,
      mileage,
      color,
      fuel_type,
      transmission,
      description,
      image_url,
      is_available
    } = req.body;

    // Check if car exists first
    const existingCar = await query('SELECT id FROM cars WHERE id = ?', [id]);
    
    if (existingCar.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Update the car
    await query(
      `UPDATE cars SET 
       make = ?, model = ?, year = ?, price = ?, mileage = ?, 
       color = ?, fuel_type = ?, transmission = ?, description = ?, 
       image_url = ?, is_available = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [make, model, year, price, mileage, color, fuel_type, transmission, description, image_url, is_available, id]
    );

    // Get updated car
    const updatedCar = await query('SELECT * FROM cars WHERE id = ?', [id]);

    res.json({
      message: 'Car updated successfully',
      car: updatedCar[0]
    });

  } catch (error) {
    console.error('Update car error:', error);
    res.status(500).json({ message: 'Failed to update car' });
  }
});

// DELETE /api/cars/:id - Delete car (admin only)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if car exists
    const existingCar = await query('SELECT id FROM cars WHERE id = ?', [id]);
    
    if (existingCar.length === 0) {
      return res.status(404).json({ message: 'Car not found' });
    }

    // Delete the car
    await query('DELETE FROM cars WHERE id = ?', [id]);

    res.json({ message: 'Car deleted successfully' });

  } catch (error) {
    console.error('Delete car error:', error);
    res.status(500).json({ message: 'Failed to delete car' });
  }
});

// GET /api/cars/admin/statistics - Get car stats (admin only)
router.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get overview statistics
    const overviewStats = await query(`
      SELECT 
        COUNT(*) as total_cars,
        COUNT(CASE WHEN is_available = 1 THEN 1 END) as available_cars,
        AVG(price) as average_price,
        MIN(price) as lowest_price,
        MAX(price) as highest_price
      FROM cars
    `);

    // Get popular makes
    const popularMakes = await query(`
      SELECT make, COUNT(*) as count 
      FROM cars 
      GROUP BY make 
      ORDER BY count DESC 
      LIMIT 10
    `);

    res.json({
      overview: overviewStats[0],
      popular_makes: popularMakes
    });

  } catch (error) {
    console.error('Get car stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

module.exports = router;