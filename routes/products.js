const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/productController');

console.log('Product routes loaded'); // Debug log

// Web routes
router.get('/', ProductController.index);                    // GET /products
router.get('/search', ProductController.index);             // GET /products/search (same as index with search param)
router.get('/:id', ProductController.show);                 // GET /products/:id

// API routes
router.get('/api/featured', ProductController.getFeatured);           // GET /products/api/featured
router.get('/api/search', ProductController.search);                 // GET /products/api/search
router.get('/api/filters', ProductController.getFilters);            // GET /products/api/filters
router.get('/api/category/:category', ProductController.getByCategory); // GET /products/api/category/:category
router.get('/api/:id', ProductController.getProductInfo);            // GET /products/api/:id

module.exports = router;