// routes/admin.js - ENHANCED WITH REVENUE TRACKING
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
router.post('/orders/bulk-update', AdminController.bulkUpdateOrderStatus);
router.get('/orders/search', AdminController.searchOrders);
router.get('/orders/export', AdminController.exportOrders);

// Quản lý người dùng
router.get('/users', AdminController.listUsers);
router.get('/users/:id', AdminController.viewUser);
router.post('/users/:id/status', AdminController.updateUserStatus);

// Cài đặt hệ thống
router.get('/settings', AdminController.showSettings);
router.get('/api/settings', AdminController.getSettings);
router.get('/api/settings/:type', AdminController.getSettings);
router.post('/settings/:type', AdminController.updateSettings);
router.post('/settings/:type/reset', AdminController.resetSettings);

// Thống kê và báo cáo
router.get('/statistics', AdminController.statistics);

// API endpoints
router.get('/api/stats/overview', AdminController.getStatsOverview);
router.get('/api/stats/sales', AdminController.getSalesStats);
router.get('/api/revenue-stats', AdminController.getRevenueStats); // 🎯 NEW: Revenue API
router.get('/api/quick-stats', AdminController.getQuickStats);
router.get('/api/global-search', AdminController.globalSearch);
router.get('/api/health-check', AdminController.healthCheck);

// Export & Maintenance
router.get('/export/all-data', AdminController.exportAllData);
router.post('/maintenance/cleanup', AdminController.cleanupData);

module.exports = router;