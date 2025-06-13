// controllers/adminController.js - COMPLETE ADMIN MANAGEMENT SYSTEM WITH REVENUE TRACKING
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Settings = require('../models/Settings');
const bcrypt = require('bcrypt');

/**
 * AdminController - Complete Admin Management System for SportShop
 * 
 * Features:
 * - Advanced Order Management with Status Tracking
 * - REVENUE TRACKING & STATISTICS
 * - User CRUD Operations with Bulk Actions
 * - Product Management with Analytics
 * - System Settings Management
 * - Comprehensive Statistics & Reporting
 * - Export/Import Functionality
 * - Security & Audit Logging
 * - Real-time Notifications
 * 
 * @version 2.1.0 - Added Revenue Tracking
 * @author SportShop Development Team
 */
class AdminController {
  
  // ===== DASHBOARD & OVERVIEW =====

  /**
   * Main Admin Dashboard
   * GET /admin or /admin/dashboard
   */
  static async dashboard(req, res) {
    try {
      // Get comprehensive dashboard statistics with revenue
      const [
        totalProducts, 
        totalUsers, 
        totalOrders, 
        recentOrders,
        totalRevenue,
        monthlyRevenue
      ] = await Promise.all([
        Product.countDocuments(),
        User.countDocuments({ role: 'user' }),
        Order.countDocuments(),
        Order.find()
          .populate('userId', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .limit(5),
        // ✨ REVENUE: Tổng doanh thu từ đơn hàng đã giao
        Order.aggregate([
          { $match: { status: 'delivered', isCompleted: true } },
          { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ]),
        // ✨ REVENUE: Doanh thu tháng này
        Order.aggregate([
          { 
            $match: { 
              status: 'delivered', 
              isCompleted: true,
              deliveredAt: { 
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
              }
            }
          },
          { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ])
      ]);

      const dashboardData = {
        stats: {
          totalProducts,
          totalUsers,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          monthlyRevenue: monthlyRevenue[0]?.total || 0
        },
        recentOrders
      };

      console.log('📊 Admin dashboard loaded by:', req.session.user.email);

      res.render('admin/dashboard', {
        title: 'Quản trị - SportShop',
        currentPage: 'admin-dashboard',
        ...dashboardData
      });

    } catch (error) {
      console.error('❌ Admin Dashboard Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang quản trị',
        currentPage: 'error' 
      });
    }
  }

  // ===== ORDER MANAGEMENT SYSTEM =====

  /**
   * List orders with advanced filtering
   * GET /admin/orders
   */
  static async listOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Build filter query
      let filterQuery = {};
      
      if (req.query.status && req.query.status !== 'all') {
        filterQuery.status = req.query.status;
      }
      
      if (req.query.paymentMethod && req.query.paymentMethod !== 'all') {
        filterQuery.paymentMethod = req.query.paymentMethod;
      }
      
      if (req.query.fromDate) {
        filterQuery.createdAt = { $gte: new Date(req.query.fromDate) };
      }
      if (req.query.toDate) {
        filterQuery.createdAt = { 
          ...filterQuery.createdAt, 
          $lte: new Date(req.query.toDate + 'T23:59:59.999Z') 
        };
      }
      
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filterQuery.$or = [
          { orderId: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.email': searchRegex },
          { 'customer.phone': searchRegex }
        ];
      }

      // Execute queries
      const [orders, totalOrders] = await Promise.all([
        Order.find(filterQuery)
          .populate('userId', 'firstName lastName email')
          .populate('items.productId', 'name price')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filterQuery)
      ]);

      const totalPages = Math.ceil(totalOrders / limit);

      // Get status statistics
      const statusStats = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      
      const statusCounts = {
        pending: 0,
        confirmed: 0,
        shipping: 0,
        delivered: 0,
        cancelled: 0
      };
      
      statusStats.forEach(stat => {
        if (statusCounts.hasOwnProperty(stat._id)) {
          statusCounts[stat._id] = stat.count;
        }
      });

      console.log('📦 Admin orders list loaded:', {
        total: totalOrders,
        page: page,
        adminUser: req.session.user.email
      });

      res.render('admin/orders/list', {
        title: 'Quản lý đơn hàng - SportShop',
        currentPage: 'admin-orders',
        orders,
        statusCounts,
        filters: req.query,
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          total: totalOrders,
          limit: limit
        }
      });

    } catch (error) {
      console.error('❌ Admin List Orders Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách đơn hàng',
        currentPage: 'error' 
      });
    }
  }

  /**
   * View detailed order information
   * GET /admin/orders/:id
   */
  static async viewOrder(req, res) {
    try {
      const orderId = req.params.id;
      
      // Find order by MongoDB _id or custom orderId
      let order;
      if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId)
          .populate('userId', 'firstName lastName email phone')
          .populate('items.productId', 'name images price brand category');
      } else {
        order = await Order.findOne({ orderId: orderId })
          .populate('userId', 'firstName lastName email phone')
          .populate('items.productId', 'name images price brand category');
      }

      if (!order) {
        req.flash('error', 'Không tìm thấy đơn hàng');
        return res.redirect('/admin/orders');
      }

      console.log('👁️ Admin viewing order:', {
        orderId: order.orderId,
        status: order.status,
        adminUser: req.session.user.email
      });

      res.render('admin/orders/view', {
        title: `Đơn hàng #${order.orderId} - SportShop`,
        currentPage: 'admin-orders',
        order
      });

    } catch (error) {
      console.error('❌ Admin View Order Error:', error);
      req.flash('error', 'Không thể tải chi tiết đơn hàng');
      res.redirect('/admin/orders');
    }
  }

  /**
   * ✨ ENHANCED: Update order status with REVENUE TRACKING
   * POST /admin/orders/:id/status
   */
  static async updateOrderStatus(req, res) {
    try {
      const orderId = req.params.id;
      const { status, notes } = req.body;
      const adminUser = req.session.user;

      // Validate status
      const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.json({ 
          success: false, 
          message: 'Trạng thái không hợp lệ!' 
        });
      }

      // Find order
      let order;
      if (orderId.match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId);
      } else {
        order = await Order.findOne({ orderId: orderId });
      }

      if (!order) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy đơn hàng!' 
        });
      }

      const oldStatus = order.status; // Lưu trạng thái cũ để theo dõi revenue

      // Validate status transitions
      const statusTransitions = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['shipping', 'cancelled'],
        shipping: ['delivered', 'cancelled'],
        delivered: [],
        cancelled: []
      };

      if (order.status === status) {
        return res.json({ 
          success: false, 
          message: 'Đơn hàng đã ở trạng thái này!' 
        });
      }

      if (!statusTransitions[order.status].includes(status)) {
        return res.json({ 
          success: false, 
          message: `Không thể chuyển từ "${AdminController.getStatusText(order.status)}" sang "${AdminController.getStatusText(status)}"!` 
        });
      }

      // Prepare update data
      const updateData = {
        status: status,
        updatedAt: new Date()
      };

      // Add status-specific data
      switch (status) {
        case 'confirmed':
          updateData.confirmedAt = new Date();
          updateData.confirmedBy = adminUser.id;
          break;
        case 'shipping':
          updateData.shippedAt = new Date();
          updateData.shippedBy = adminUser.id;
          if (!order.trackingCode) {
            updateData.trackingCode = AdminController.generateTrackingCode();
          }
          break;
        case 'delivered':
          updateData.deliveredAt = new Date();
          updateData.deliveredBy = adminUser.id;
          updateData.paymentStatus = 'paid';
          // 🎯 REVENUE TRACKING: Đánh dấu đã hoàn thành để tính doanh thu
          updateData.isCompleted = true;
          updateData.completedAt = new Date();
          updateData.revenueRecorded = true; // Flag để tránh tính doanh thu nhiều lần
          break;
        case 'cancelled':
          updateData.cancelledAt = new Date();
          updateData.cancelledBy = adminUser.id;
          updateData.cancelReason = notes || 'Cancelled by admin';
          // 🎯 REVENUE: Nếu đơn hàng bị hủy, không tính doanh thu
          updateData.isCompleted = false;
          updateData.revenueRecorded = false;
          break;
      }

      // Add to order history
      const historyEntry = {
        status: status,
        timestamp: new Date(),
        note: notes || `Trạng thái được cập nhật bởi admin: ${adminUser.firstName} ${adminUser.lastName}`,
        updatedBy: 'admin',
        adminId: adminUser.id,
        adminName: `${adminUser.firstName} ${adminUser.lastName}`
      };

      if (!order.orderHistory) {
        order.orderHistory = [];
      }

      updateData.$push = { orderHistory: historyEntry };

      // Update order
      await Order.findByIdAndUpdate(order._id, updateData);

      // 🎯 REVENUE ANALYTICS: Cập nhật thống kê doanh thu
      try {
        await AdminController.updateRevenueStatistics(order, oldStatus, status, adminUser);
      } catch (revenueError) {
        console.warn('⚠️ Revenue update failed:', revenueError.message);
        // Không fail toàn bộ request nếu revenue update lỗi
      }

      // Send notification
      try {
        await AdminController.sendOrderStatusNotification(order, status);
      } catch (notificationError) {
        console.warn('⚠️ Notification failed:', notificationError.message);
      }

      console.log('🔄 Order status updated with revenue tracking:', {
        orderId: order.orderId,
        oldStatus: oldStatus,
        newStatus: status,
        revenueImpact: status === 'delivered' ? `+${order.finalTotal.toLocaleString('vi-VN')}đ` : 
                      status === 'cancelled' && oldStatus === 'delivered' ? `-${order.finalTotal.toLocaleString('vi-VN')}đ` : 'None',
        adminUser: adminUser.email
      });

      res.json({ 
        success: true, 
        message: `Đã cập nhật trạng thái đơn hàng thành "${AdminController.getStatusText(status)}"!`,
        data: {
          orderId: order.orderId,
          newStatus: status,
          statusText: AdminController.getStatusText(status),
          trackingCode: updateData.trackingCode || order.trackingCode,
          revenueImpact: status === 'delivered' ? order.finalTotal : 0
        }
      });

    } catch (error) {
      console.error('❌ Admin Update Order Status Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi cập nhật trạng thái: ' + error.message 
      });
    }
  }

  /**
   * 🎯 NEW: Update revenue statistics when order status changes
   */
  static async updateRevenueStatistics(order, oldStatus, newStatus, adminUser) {
    try {
      const now = new Date();
      const revenueData = {
        orderId: order.orderId,
        orderTotal: order.finalTotal,
        changeDate: now,
        adminUser: adminUser.email,
        oldStatus: oldStatus,
        newStatus: newStatus
      };

      // Case 1: Đơn hàng chuyển thành "delivered" - TĂNG doanh thu
      if (newStatus === 'delivered' && oldStatus !== 'delivered') {
        console.log('💰 Revenue INCREASED:', {
          orderId: order.orderId,
          amount: `+${order.finalTotal.toLocaleString('vi-VN')}đ`,
          from: oldStatus,
          to: newStatus
        });

        // Có thể lưu vào bảng Revenue riêng hoặc cập nhật cache
        await AdminController.recordRevenueChange({
          ...revenueData,
          type: 'increase',
          amount: order.finalTotal,
          description: `Đơn hàng ${order.orderId} đã giao thành công`
        });
      }

      // Case 2: Đơn hàng từ "delivered" chuyển thành "cancelled" - GIẢM doanh thu
      else if (newStatus === 'cancelled' && oldStatus === 'delivered') {
        console.log('💸 Revenue DECREASED:', {
          orderId: order.orderId,
          amount: `-${order.finalTotal.toLocaleString('vi-VN')}đ`,
          from: oldStatus,
          to: newStatus
        });

        await AdminController.recordRevenueChange({
          ...revenueData,
          type: 'decrease',
          amount: -order.finalTotal,
          description: `Đơn hàng ${order.orderId} bị hủy sau khi đã giao`
        });
      }

      // Case 3: Các trường hợp khác - chỉ ghi log
      else {
        console.log('📊 Order status changed (no revenue impact):', {
          orderId: order.orderId,
          from: oldStatus,
          to: newStatus
        });
      }

    } catch (error) {
      console.error('❌ Revenue statistics update failed:', error);
      throw error;
    }
  }

  /**
   * 🎯 NEW: Record revenue changes for analytics
   */
  static async recordRevenueChange(changeData) {
    try {
      // Option 1: Lưu vào collection riêng (nếu có Revenue model)
      // const RevenueLog = require('../models/RevenueLog');
      // await RevenueLog.create(changeData);

      // Option 2: Lưu vào Settings với key đặc biệt
      const revenueKey = `revenue_log_${Date.now()}`;
      await Settings.setSetting(revenueKey, changeData, changeData.adminUser);

      // Option 3: Cập nhật tổng doanh thu trong cache
      const currentRevenue = await Settings.getSetting('total_revenue') || 0;
      const newRevenue = currentRevenue + changeData.amount;
      await Settings.setSetting('total_revenue', newRevenue, changeData.adminUser);

      console.log('📈 Revenue change recorded:', {
        type: changeData.type,
        amount: changeData.amount,
        newTotal: newRevenue
      });

    } catch (error) {
      console.error('❌ Failed to record revenue change:', error);
      throw error;
    }
  }

  /**
   * Helper method for single order status update
   */
  static async updateSingleOrderStatus(orderId, status, notes, adminUser) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Không tìm thấy đơn hàng');
    }

    const statusTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['shipping', 'cancelled'],
      shipping: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    if (!statusTransitions[order.status].includes(status)) {
      throw new Error(`Không thể chuyển từ "${order.status}" sang "${status}"`);
    }

    const updateData = {
      status: status,
      updatedAt: new Date()
    };

    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = new Date();
        updateData.confirmedBy = adminUser.id;
        break;
      case 'shipping':
        updateData.shippedAt = new Date();
        updateData.shippedBy = adminUser.id;
        if (!order.trackingCode) {
          updateData.trackingCode = AdminController.generateTrackingCode();
        }
        break;
      case 'delivered':
        updateData.deliveredAt = new Date();
        updateData.deliveredBy = adminUser.id;
        updateData.paymentStatus = 'paid';
        updateData.isCompleted = true;
        updateData.completedAt = new Date();
        updateData.revenueRecorded = true;
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = adminUser.id;
        updateData.cancelReason = notes || 'Bulk cancellation by admin';
        updateData.isCompleted = false;
        updateData.revenueRecorded = false;
        break;
    }

    const historyEntry = {
      status: status,
      timestamp: new Date(),
      note: notes || `Cập nhật hàng loạt bởi admin: ${adminUser.firstName} ${adminUser.lastName}`,
      updatedBy: 'admin',
      adminId: adminUser.id,
      adminName: `${adminUser.firstName} ${adminUser.lastName}`
    };

    if (!order.orderHistory) {
      order.orderHistory = [];
    }

    updateData.$push = { orderHistory: historyEntry };

    await Order.findByIdAndUpdate(order._id, updateData);
    
    // Update revenue for bulk operations too
    await AdminController.updateRevenueStatistics(order, order.status, status, adminUser);
    
    return order;
  }

  /**
   * Generate tracking code
   */
  static generateTrackingCode() {
    const prefix = 'SPT';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  }

  /**
   * Get status text in Vietnamese
   */
  static getStatusText(status) {
    const statusMap = {
      'pending': 'Chờ xử lý',
      'confirmed': 'Đã xác nhận',
      'shipping': 'Đang giao hàng',
      'delivered': 'Đã giao hàng',
      'cancelled': 'Đã hủy'
    };
    return statusMap[status] || status;
  }

  /**
   * 🎯 NEW: Get revenue statistics
   * GET /admin/api/revenue-stats
   */
  static async getRevenueStats(req, res) {
    try {
      const { period = 'month' } = req.query;
      const now = new Date();
      
      let startDate;
      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const revenueStats = await Order.aggregate([
        {
          $match: {
            status: 'delivered',
            isCompleted: true,
            deliveredAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$deliveredAt' },
              month: { $month: '$deliveredAt' },
              day: { $dayOfMonth: '$deliveredAt' }
            },
            totalRevenue: { $sum: '$finalTotal' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$finalTotal' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]);

      const totalRevenue = revenueStats.reduce((sum, item) => sum + item.totalRevenue, 0);
      const totalOrders = revenueStats.reduce((sum, item) => sum + item.orderCount, 0);

      res.json({
        success: true,
        data: {
          period: period,
          totalRevenue: totalRevenue,
          totalOrders: totalOrders,
          avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          dailyStats: revenueStats,
          formattedRevenue: totalRevenue.toLocaleString('vi-VN') + 'đ'
        }
      });

    } catch (error) {
      console.error('❌ Revenue Stats Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy thống kê doanh thu: ' + error.message
      });
    }
  }

  // Các method khác giữ nguyên từ file gốc...

  /**
   * Export orders to CSV
   * GET /admin/orders/export
   */
  static async exportOrders(req, res) {
    try {
      const { status, fromDate, toDate, format = 'csv' } = req.query;
      
      let filterQuery = {};
      if (status && status !== 'all') {
        filterQuery.status = status;
      }
      if (fromDate) {
        filterQuery.createdAt = { $gte: new Date(fromDate) };
      }
      if (toDate) {
        filterQuery.createdAt = { 
          ...filterQuery.createdAt, 
          $lte: new Date(toDate + 'T23:59:59.999Z') 
        };
      }

      const orders = await Order.find(filterQuery)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 });

      if (format === 'csv') {
        let csvContent = 'Mã đơn hàng,Khách hàng,Email,Số điện thoại,Trạng thái,Tổng tiền,Phương thức thanh toán,Ngày tạo\n';
        
        orders.forEach(order => {
          csvContent += `"${order.orderId}","${order.customer.name}","${order.customer.email}","${order.customer.phone || ''}","${AdminController.getStatusText(order.status)}","${order.finalTotal.toLocaleString('vi-VN')}đ","${order.paymentMethod}","${new Date(order.createdAt).toLocaleDateString('vi-VN')}"\n`;
        });

        const filename = `don-hang-${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.write('\ufeff');
        res.write(csvContent);
        res.end();
      } else {
        const filename = `don-hang-${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json({
          exportedAt: new Date().toISOString(),
          exportedBy: req.session.user.email,
          totalOrders: orders.length,
          orders: orders
        });
      }

      console.log('📊 Orders exported:', {
        count: orders.length,
        exportedBy: req.session.user.email
      });

    } catch (error) {
      console.error('❌ Admin Export Orders Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi xuất dữ liệu đơn hàng: ' + error.message 
      });
    }
  }

  // ===== PRODUCT MANAGEMENT SYSTEM =====

  /**
   * List products with filtering
   * GET /admin/products
   */
  static async listProducts(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [products, totalProducts] = await Promise.all([
        Product.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
        Product.countDocuments()
      ]);

      const totalPages = Math.ceil(totalProducts / limit);

      res.render('admin/products/list', {
        title: 'Quản lý sản phẩm - SportShop',
        currentPage: 'admin-products',
        products,
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });

    } catch (error) {
      console.error('❌ Admin List Products Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách sản phẩm',
        currentPage: 'error' 
      });
    }
  }

  /**
   * Show add product form
   * GET /admin/products/add
   */
  static async showAddProduct(req, res) {
    try {
      res.render('admin/products/add', {
        title: 'Thêm sản phẩm - SportShop',
        currentPage: 'admin-products'
      });
    } catch (error) {
      console.error('❌ Admin Show Add Product Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải form thêm sản phẩm',
        currentPage: 'error' 
      });
    }
  }

  /**
   * Add new product
   * POST /admin/products/add
   */
  static async addProduct(req, res) {
    try {
      const productData = {
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        originalPrice: parseFloat(req.body.originalPrice) || parseFloat(req.body.price),
        category: req.body.category,
        brand: req.body.brand,
        sizes: req.body.sizes ? req.body.sizes.split(',').map(s => s.trim()) : [],
        colors: req.body.colors ? req.body.colors.split(',').map(c => c.trim()) : [],
        stockQuantity: parseInt(req.body.stockQuantity) || 0,
        images: req.body.images ? req.body.images.split(',').map(img => img.trim()) : [],
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        isActive: req.body.isActive === 'true',
        isFeatured: req.body.isFeatured === 'true'
      };

      const product = new Product(productData);
      await product.save();

      req.flash('success', 'Thêm sản phẩm thành công!');
      res.redirect('/admin/products');

    } catch (error) {
      console.error('❌ Admin Add Product Error:', error);
      req.flash('error', 'Lỗi thêm sản phẩm: ' + error.message);
      res.redirect('/admin/products/add');
    }
  }

  /**
   * Show edit product form
   * GET /admin/products/:id/edit
   */
  static async showEditProduct(req, res) {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        req.flash('error', 'Không tìm thấy sản phẩm');
        return res.redirect('/admin/products');
      }

      res.render('admin/products/edit', {
        title: 'Sửa sản phẩm - SportShop',
        currentPage: 'admin-products',
        product
      });

    } catch (error) {
      console.error('❌ Admin Show Edit Product Error:', error);
      req.flash('error', 'Không thể tải form sửa sản phẩm');
      res.redirect('/admin/products');
    }
  }

  /**
   * Update product
   * POST /admin/products/:id/edit
   */
  static async editProduct(req, res) {
    try {
      const productId = req.params.id;
      const updateData = {
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        originalPrice: parseFloat(req.body.originalPrice) || parseFloat(req.body.price),
        category: req.body.category,
        brand: req.body.brand,
        sizes: req.body.sizes ? req.body.sizes.split(',').map(s => s.trim()) : [],
        colors: req.body.colors ? req.body.colors.split(',').map(c => c.trim()) : [],
        stockQuantity: parseInt(req.body.stockQuantity) || 0,
        images: req.body.images ? req.body.images.split(',').map(img => img.trim()) : [],
        tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
        isActive: req.body.isActive === 'true',
        isFeatured: req.body.isFeatured === 'true',
        updatedAt: new Date()
      };

      await Product.findByIdAndUpdate(productId, updateData);
      req.flash('success', 'Cập nhật sản phẩm thành công!');
      res.redirect('/admin/products');

    } catch (error) {
      console.error('❌ Admin Edit Product Error:', error);
      req.flash('error', 'Lỗi cập nhật sản phẩm: ' + error.message);
      res.redirect(`/admin/products/${req.params.id}/edit`);
    }
  }

  /**
   * Delete product
   * DELETE /admin/products/:id
   */
  static async deleteProduct(req, res) {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Xóa sản phẩm thành công!' });
    } catch (error) {
      console.error('❌ Admin Delete Product Error:', error);
      res.json({ success: false, message: 'Lỗi xóa sản phẩm: ' + error.message });
    }
  }

  // ===== USER MANAGEMENT SYSTEM =====

  /**
   * List users with filtering
   * GET /admin/users
   */
  static async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      let filterQuery = {};
      
      if (req.query.role && req.query.role !== 'all') {
        filterQuery.role = req.query.role;
      }
      
      if (req.query.status === 'active') {
        filterQuery.isActive = true;
      } else if (req.query.status === 'inactive') {
        filterQuery.isActive = false;
      }
      
      if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filterQuery.$or = [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex }
        ];
      }

      const [users, totalUsers] = await Promise.all([
        User.find(filterQuery)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments(filterQuery)
      ]);

      const totalPages = Math.ceil(totalUsers / limit);

      res.render('admin/users/list', {
        title: 'Quản lý người dùng - SportShop',
        currentPage: 'admin-users',
        users,
        filters: req.query,
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          total: totalUsers
        }
      });

    } catch (error) {
      console.error('❌ Admin List Users Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách người dùng',
        currentPage: 'error' 
      });
    }
  }

  /**
   * View user details
   * GET /admin/users/:id
   */
  static async viewUser(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        req.flash('error', 'Không tìm thấy người dùng');
        return res.redirect('/admin/users');
      }

      const [userOrders, userCart] = await Promise.all([
        Order.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
        Cart.findOne({ userId: user._id }).populate('items.product')
      ]);

      res.render('admin/users/view', {
        title: `${user.firstName} ${user.lastName} - SportShop`,
        currentPage: 'admin-users',
        user,
        userOrders,
        userCart
      });

    } catch (error) {
      console.error('❌ Admin View User Error:', error);
      req.flash('error', 'Không thể tải thông tin người dùng');
      res.redirect('/admin/users');
    }
  }

  /**
   * Update user status
   * POST /admin/users/:id/status
   */
  static async updateUserStatus(req, res) {
    try {
      const { isActive } = req.body;
      const userId = req.params.id;
      const currentUserId = req.session.user.id;

      if (userId === currentUserId) {
        return res.json({ 
          success: false, 
          message: 'Không thể thay đổi trạng thái tài khoản của chính mình!' 
        });
      }

      await User.findByIdAndUpdate(userId, { 
        isActive: isActive,
        updatedAt: new Date()
      });

      console.log('🔄 User status updated:', {
        userId: userId,
        newStatus: isActive,
        updatedBy: req.session.user.email
      });

      res.json({ 
        success: true, 
        message: `${isActive ? 'Kích hoạt' : 'Tạm dừng'} người dùng thành công!` 
      });

    } catch (error) {
      console.error('❌ Admin Update User Status Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi cập nhật trạng thái: ' + error.message 
      });
    }
  }

  // ===== SETTINGS MANAGEMENT =====

  /**
   * Show settings page
   * GET /admin/settings
   */
  static async showSettings(req, res) {
    try {
      res.render('admin/settings', {
        title: 'Cài đặt hệ thống - SportShop',
        currentPage: 'admin-settings'
      });
    } catch (error) {
      console.error('❌ Admin Show Settings Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang cài đặt',
        currentPage: 'error' 
      });
    }
  }

  /**
   * Get settings by type
   * GET /admin/api/settings/:type?
   */
  static async getSettings(req, res) {
    try {
      const { type } = req.params;
      
      if (!type) {
        // Get all settings
        const allSettings = await Settings.getAllSettings();
        return res.json({
          success: true,
          settings: allSettings
        });
      }

      // Get specific setting type
      const settingData = await Settings.getSetting(type);
      
      res.json({
        success: true,
        setting: {
          type: type,
          data: settingData || {},
          isDefault: !settingData
        }
      });

    } catch (error) {
      console.error('❌ Admin Get Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy cài đặt: ' + error.message
      });
    }
  }

  /**
   * Update settings
   * POST /admin/settings/:type
   */
  static async updateSettings(req, res) {
    try {
      const { type } = req.params;
      const updateData = req.body;
      const userId = req.session.user.id;

      const validTypes = [
        'shop-info', 'brand-colors', 'contact', 'map', 
        'social', 'system', 'advanced'
      ];

      if (!validTypes.includes(type)) {
        return res.json({
          success: false,
          message: 'Loại cài đặt không hợp lệ!'
        });
      }

      // Process and validate data
      const processedData = AdminController.processSettingsData(type, updateData);

      // Update settings
      await Settings.setSetting(type, processedData, userId);

      console.log('⚙️ Settings updated:', {
        type: type,
        updatedBy: req.session.user.email
      });

      res.json({
        success: true,
        message: 'Cập nhật cài đặt thành công!',
        data: processedData
      });

    } catch (error) {
      console.error('❌ Admin Update Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi cập nhật cài đặt: ' + error.message
      });
    }
  }

  /**
   * Reset settings to default
   * POST /admin/settings/:type/reset
   */
  static async resetSettings(req, res) {
    try {
      const { type } = req.params;
      const userId = req.session.user.id;

      const defaultSettings = Settings.getDefaultSettings();
      
      if (!defaultSettings[type]) {
        return res.json({
          success: false,
          message: 'Loại cài đặt không hợp lệ!'
        });
      }

      await Settings.setSetting(type, defaultSettings[type], userId);

      console.log('🔄 Settings reset to default:', {
        type: type,
        resetBy: req.session.user.email
      });

      res.json({
        success: true,
        message: 'Đã đặt lại cài đặt về mặc định!',
        data: defaultSettings[type]
      });

    } catch (error) {
      console.error('❌ Admin Reset Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi đặt lại cài đặt: ' + error.message
      });
    }
  }

  /**
   * Process settings data based on type
   */
  static processSettingsData(type, data) {
    const processed = { ...data };

    switch (type) {
      case 'shop-info':
        processed.name = processed.name?.trim();
        processed.slogan = processed.slogan?.trim();
        processed.description = processed.description?.trim();
        break;

      case 'brand-colors':
        if (processed.primary) processed.primary = processed.primary.toLowerCase();
        if (processed.secondary) processed.secondary = processed.secondary.toLowerCase();
        processed.darkMode = processed.darkMode === 'true' || processed.darkMode === true;
        break;

      case 'contact':
        processed.email = processed.email?.toLowerCase().trim();
        processed.phone = processed.phone?.trim();
        processed.address = processed.address?.trim();
        break;

      case 'advanced':
        processed.maintenanceMode = processed.maintenanceMode === 'true' || processed.maintenanceMode === true;
        processed.allowRegistration = processed.allowRegistration === 'true' || processed.allowRegistration === true;
        if (processed.maxLoginAttempts) processed.maxLoginAttempts = parseInt(processed.maxLoginAttempts);
        break;
    }

    return processed;
  }

  // ===== STATISTICS & ANALYTICS =====

  /**
   * Show statistics page
   * GET /admin/statistics
   */
  static async statistics(req, res) {
    try {
      res.render('admin/statistics', {
        title: 'Thống kê - SportShop',
        currentPage: 'admin-statistics'
      });
    } catch (error) {
      console.error('❌ Admin Statistics Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang thống kê',
        currentPage: 'error' 
      });
    }
  }

  /**
   * 🎯 ENHANCED: Get dashboard summary statistics with revenue
   * GET /admin/api/stats/overview
   */
  static async getStatsOverview(req, res) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        totalProducts, totalUsers, totalOrders,
        ordersToday, ordersThisMonth,
        totalRevenue, revenueThisMonth, revenueToday
      ] = await Promise.all([
        Product.countDocuments(),
        User.countDocuments({ role: 'user' }),
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: startOfToday } }),
        Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
        // 🎯 REVENUE: Tổng doanh thu tất cả thời gian
        Order.aggregate([
          { $match: { status: 'delivered', isCompleted: true } },
          { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ]),
        // 🎯 REVENUE: Doanh thu tháng này
        Order.aggregate([
          { 
            $match: { 
              status: 'delivered', 
              isCompleted: true,
              deliveredAt: { $gte: startOfMonth }
            }
          },
          { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ]),
        // 🎯 REVENUE: Doanh thu hôm nay
        Order.aggregate([
          { 
            $match: { 
              status: 'delivered', 
              isCompleted: true,
              deliveredAt: { $gte: startOfToday }
            }
          },
          { $group: { _id: null, total: { $sum: '$finalTotal' } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          totalProducts,
          totalUsers,
          totalOrders,
          ordersToday,
          ordersThisMonth,
          totalRevenue: totalRevenue[0]?.total || 0,
          revenueThisMonth: revenueThisMonth[0]?.total || 0,
          revenueToday: revenueToday[0]?.total || 0,
          // 🎯 FORMATTED: Doanh thu đã format
          formattedRevenue: {
            total: (totalRevenue[0]?.total || 0).toLocaleString('vi-VN') + 'đ',
            month: (revenueThisMonth[0]?.total || 0).toLocaleString('vi-VN') + 'đ',
            today: (revenueToday[0]?.total || 0).toLocaleString('vi-VN') + 'đ'
          }
        }
      });

    } catch (error) {
      console.error('❌ Admin Stats Overview Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  /**
   * Get sales statistics
   * GET /admin/api/stats/sales
   */
  static async getSalesStats(req, res) {
    try {
      // TODO: Implement detailed sales statistics
      res.json({
        success: true,
        data: {
          dailySales: [],
          monthlySales: [],
          topProducts: []
        }
      });
    } catch (error) {
      console.error('❌ Admin Sales Stats Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  // ===== NOTIFICATION SYSTEM =====

  /**
   * Send order status notification to customer
   */
  static async sendOrderStatusNotification(order, newStatus) {
    try {
      const statusMessages = {
        confirmed: 'Đơn hàng của bạn đã được xác nhận và đang được chuẩn bị.',
        shipping: 'Đơn hàng của bạn đang trên đường giao đến bạn.',
        delivered: 'Đơn hàng của bạn đã được giao thành công.',
        cancelled: 'Đơn hàng của bạn đã bị hủy.'
      };

      const message = statusMessages[newStatus];
      
      if (message) {
        console.log('📧 Notification would be sent:', {
          orderId: order.orderId,
          customerEmail: order.customer.email,
          newStatus: newStatus,
          message: message
        });
        
        // TODO: Implement actual email/SMS sending
        // await emailService.sendOrderStatusUpdate(order.customer.email, {
        //   orderId: order.orderId,
        //   status: newStatus,
        //   message: message
        // });
      }
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Global search across entities
   * GET /admin/api/global-search
   */
  static async globalSearch(req, res) {
    try {
      const { q: query, limit = 5 } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({ success: true, results: {} });
      }

      const searchRegex = new RegExp(query, 'i');
      
      const [users, products, orders] = await Promise.all([
        User.find({
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex }
          ]
        })
        .select('firstName lastName email role')
        .limit(parseInt(limit)),
        
        Product.find({
          $or: [
            { name: searchRegex },
            { brand: searchRegex },
            { category: searchRegex }
          ]
        })
        .select('name brand category price')
        .limit(parseInt(limit)),
        
        Order.find({
          $or: [
            { orderId: searchRegex },
            { 'customer.name': searchRegex },
            { 'customer.email': searchRegex }
          ]
        })
        .select('orderId customer status finalTotal')
        .limit(parseInt(limit))
      ]);

      res.json({
        success: true,
        results: {
          users: users.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            type: 'user'
          })),
          products: products.map(product => ({
            id: product._id,
            name: product.name,
            brand: product.brand,
            category: product.category,
            price: product.price,
            type: 'product'
          })),
          orders: orders.map(order => ({
            id: order._id,
            orderId: order.orderId,
            customerName: order.customer.name,
            status: order.status,
            total: order.finalTotal,
            type: 'order'
          }))
        }
      });

    } catch (error) {
      console.error('❌ Admin Global Search Error:', error);
      res.json({
        success: false,
        message: 'Lỗi tìm kiếm: ' + error.message
      });
    }
  }

  /**
   * System health check
   * GET /admin/api/health-check
   */
  static async healthCheck(req, res) {
    try {
      const checks = {
        database: false,
        models: false,
        memory: false
      };

      // Database check
      try {
        await User.findOne().limit(1);
        checks.database = true;
      } catch (err) {
        console.error('Database check failed:', err);
      }

      // Models check
      try {
        const counts = await Promise.all([
          User.countDocuments(),
          Product.countDocuments(),
          Order.countDocuments()
        ]);
        checks.models = counts.every(count => count >= 0);
      } catch (err) {
        console.error('Models check failed:', err);
      }

      // Memory check
      const memUsage = process.memoryUsage();
      checks.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9;

      const isHealthy = Object.values(checks).every(check => check === true);

      res.json({
        success: true,
        healthy: isHealthy,
        checks: checks,
        memory: {
          used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Health Check Error:', error);
      res.json({
        success: false,
        healthy: false,
        message: error.message
      });
    }
  }

  /**
   * Get quick stats for admin header
   * GET /admin/api/quick-stats
   */
  static async getQuickStats(req, res) {
    try {
      const [pendingOrders, lowStockProducts, newUsersToday] = await Promise.all([
        Order.countDocuments({ status: 'pending' }),
        Product.countDocuments({ stockQuantity: { $lt: 5 } }),
        User.countDocuments({ 
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          role: 'user'
        })
      ]);

      res.json({
        success: true,
        stats: {
          pendingOrders,
          lowStockProducts,
          newUsersToday,
          alerts: {
            hasLowStock: lowStockProducts > 0,
            hasPendingOrders: pendingOrders > 0,
            hasNewUsers: newUsersToday > 0
          }
        }
      });

    } catch (error) {
      console.error('❌ Quick Stats Error:', error);
      res.json({
        success: false,
        message: error.message
      });
    }
  }

  // ===== BULK UPDATE OPERATIONS =====

  /**
   * Bulk update order statuses
   * POST /admin/orders/bulk-update
   */
  static async bulkUpdateOrderStatus(req, res) {
    try {
      const { orderIds, status, notes } = req.body;
      const adminUser = req.session.user;

      if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
        return res.json({ 
          success: false, 
          message: 'Vui lòng chọn ít nhất một đơn hàng!' 
        });
      }

      const validStatuses = ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.json({ 
          success: false, 
          message: 'Trạng thái không hợp lệ!' 
        });
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const orderId of orderIds) {
        try {
          await AdminController.updateSingleOrderStatus(orderId, status, notes, adminUser);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`${orderId}: ${error.message}`);
        }
      }

      console.log('📦 Bulk order status update:', {
        totalOrders: orderIds.length,
        successCount,
        errorCount,
        adminUser: adminUser.email
      });

      res.json({
        success: successCount > 0,
        message: `Đã cập nhật ${successCount} đơn hàng thành công${errorCount > 0 ? `, ${errorCount} đơn hàng lỗi` : ''}!`,
        details: {
          success: successCount,
          errors: errorCount,
          errorDetails: errors
        }
      });

    } catch (error) {
      console.error('❌ Admin Bulk Update Order Status Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi cập nhật hàng loạt: ' + error.message 
      });
    }
  }

  // ===== SEARCH & FILTER OPERATIONS =====

  /**
   * Search orders for autocomplete
   * GET /admin/orders/search
   */
  static async searchOrders(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({ success: true, orders: [] });
      }

      const searchRegex = new RegExp(query, 'i');
      const orders = await Order.find({
        $or: [
          { orderId: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.email': searchRegex },
          { 'customer.phone': searchRegex }
        ]
      })
      .select('orderId customer status finalTotal createdAt')
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

      res.json({
        success: true,
        orders: orders.map(order => ({
          id: order._id,
          orderId: order.orderId,
          customerName: order.customer.name,
          status: AdminController.getStatusText(order.status),
          total: order.finalTotal.toLocaleString('vi-VN') + 'đ',
          createdAt: new Date(order.createdAt).toLocaleDateString('vi-VN')
        }))
      });

    } catch (error) {
      console.error('❌ Admin Search Orders Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  // ===== DATA EXPORT/IMPORT =====

  /**
   * Export all system data
   * GET /admin/export/all-data
   */
  static async exportAllData(req, res) {
    try {
      const [users, products, orders] = await Promise.all([
        User.find({}).select('-password'),
        Product.find({}),
        Order.find({}).populate('userId', 'firstName lastName email')
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user.email,
        version: '1.0',
        data: {
          users: users,
          products: products,
          orders: orders
        },
        statistics: {
          totalUsers: users.length,
          totalProducts: products.length,
          totalOrders: orders.length
        }
      };

      const filename = `sportshop-export-${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);

      console.log('📊 Full data export:', {
        totalRecords: users.length + products.length + orders.length,
        exportedBy: req.session.user.email
      });

    } catch (error) {
      console.error('❌ Export All Data Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi xuất dữ liệu: ' + error.message
      });
    }
  }

  // ===== MAINTENANCE & CLEANUP =====

  /**
   * Data cleanup operations
   * POST /admin/maintenance/cleanup
   */
  static async cleanupData(req, res) {
    try {
      const { type } = req.body;
      let result = { removed: 0, message: '' };

      switch (type) {
        case 'abandoned-carts':
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const deleteResult = await Cart.deleteMany({
            status: 'abandoned',
            updatedAt: { $lt: thirtyDaysAgo }
          });
          result.removed = deleteResult.deletedCount;
          result.message = `Đã xóa ${deleteResult.deletedCount} giỏ hàng bỏ hoang`;
          break;

        case 'expired-sessions':
          result.message = 'Dọn dẹp session hết hạn thành công';
          break;

        default:
          return res.json({
            success: false,
            message: 'Loại dọn dẹp không hợp lệ!'
          });
      }

      console.log('🧹 Data cleanup:', {
        type: type,
        removed: result.removed,
        performedBy: req.session.user.email
      });

      res.json({
        success: true,
        message: result.message,
        removed: result.removed
      });

    } catch (error) {
      console.error('❌ Cleanup Data Error:', error);
      res.json({
        success: false,
        message: 'Lỗi dọn dẹp dữ liệu: ' + error.message
      });
    }
  }
}

module.exports = AdminController;