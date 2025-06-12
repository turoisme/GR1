// routes/admin.js
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const AdminController = require('../controllers/adminController');

// Tất cả routes admin đều yêu cầu phân quyền admin
router.use(requireAdmin);

// Dashboard
router.get('/', AdminController.dashboard);
router.get('/dashboard', AdminController.dashboard);

// Quản lý sản phẩm
router.get('/products', AdminController.listProducts);
router.get('/products/add', AdminController.showAddProduct);
router.post('/products/add', AdminController.addProduct);
router.get('/products/:id/edit', AdminController.showEditProduct);
router.post('/products/:id/edit', AdminController.editProduct);
router.delete('/products/:id', AdminController.deleteProduct);

// Quản lý đơn hàng
router.get('/orders', AdminController.listOrders);
router.get('/orders/:id', AdminController.viewOrder);
router.post('/orders/:id/status', AdminController.updateOrderStatus);

// Quản lý người dùng
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.viewUser);
router.post('/users/:id/status', AdminController.updateUserStatus);

// Thống kê
router.get('/statistics', AdminController.statistics);

// API endpoints
router.get('/api/stats/overview', AdminController.getStatsOverview);
router.get('/api/stats/sales', AdminController.getSalesStats);

module.exports = router;