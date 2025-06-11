const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/homeController');

console.log('Home routes loaded'); // Debug log

// Main pages
router.get('/', HomeController.index);                    // GET / (trang chủ)
router.get('/about', HomeController.about);              // GET /about
router.get('/contact', HomeController.contact);          // GET /contact

// Search
router.get('/search', HomeController.search);            // GET /search
router.get('/search/suggestions', HomeController.searchSuggestions); // GET /search/suggestions

// Contact form
router.post('/contact', HomeController.submitContact);   // POST /contact

// API endpoints
router.get('/api/stats', HomeController.getStats);       // GET /api/stats

module.exports = router;