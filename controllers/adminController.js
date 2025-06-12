// controllers/adminController.js
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

class AdminController {
  
  // Dashboard chính
  static async dashboard(req, res) {
    try {
      // Thống kê tổng quan
      const [totalProducts, totalUsers, totalOrders, recentOrders] = await Promise.all([
        Product.countDocuments(),
        User.countDocuments({ role: 'user' }),
        Order.countDocuments(),
        Order.find().populate('userId', 'firstName lastName email').sort({ createdAt: -1 }).limit(5)
      ]);

      res.render('admin/dashboard', {
        title: 'Quản trị - SportShop',
        currentPage: 'admin-dashboard',
        stats: {
          totalProducts,
          totalUsers,
          totalOrders
        },
        recentOrders
      });
    } catch (error) {
      console.error('Admin Dashboard Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang quản trị',
        currentPage: 'error' 
      });
    }
  }

  // Danh sách sản phẩm
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
      console.error('Admin List Products Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách sản phẩm',
        currentPage: 'error' 
      });
    }
  }

  // Form thêm sản phẩm
  static async showAddProduct(req, res) {
    try {
      res.render('admin/products/add', {
        title: 'Thêm sản phẩm - SportShop',
        currentPage: 'admin-products'
      });
    } catch (error) {
      console.error('Admin Show Add Product Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải form thêm sản phẩm',
        currentPage: 'error' 
      });
    }
  }

  // Xử lý thêm sản phẩm
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
      console.error('Admin Add Product Error:', error);
      req.flash('error', 'Lỗi thêm sản phẩm: ' + error.message);
      res.redirect('/admin/products/add');
    }
  }

  // Form sửa sản phẩm
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
      console.error('Admin Show Edit Product Error:', error);
      req.flash('error', 'Không thể tải form sửa sản phẩm');
      res.redirect('/admin/products');
    }
  }

  // Xử lý sửa sản phẩm
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
      console.error('Admin Edit Product Error:', error);
      req.flash('error', 'Lỗi cập nhật sản phẩm: ' + error.message);
      res.redirect(`/admin/products/${req.params.id}/edit`);
    }
  }

  // Xóa sản phẩm
  static async deleteProduct(req, res) {
    try {
      await Product.findByIdAndDelete(req.params.id);
      res.json({ success: true, message: 'Xóa sản phẩm thành công!' });
    } catch (error) {
      console.error('Admin Delete Product Error:', error);
      res.json({ success: false, message: 'Lỗi xóa sản phẩm: ' + error.message });
    }
  }

  // Danh sách đơn hàng
  static async listOrders(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [orders, totalOrders] = await Promise.all([
        Order.find()
          .populate('userId', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments()
      ]);

      const totalPages = Math.ceil(totalOrders / limit);

      res.render('admin/orders/list', {
        title: 'Quản lý đơn hàng - SportShop',
        currentPage: 'admin-orders',
        orders,
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Admin List Orders Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách đơn hàng',
        currentPage: 'error' 
      });
    }
  }

  // Chi tiết đơn hàng
  static async viewOrder(req, res) {
    try {
      const order = await Order.findById(req.params.id)
        .populate('userId', 'firstName lastName email phone')
        .populate('products.productId', 'name images price');

      if (!order) {
        req.flash('error', 'Không tìm thấy đơn hàng');
        return res.redirect('/admin/orders');
      }

      res.render('admin/orders/view', {
        title: `Đơn hàng #${order.orderNumber} - SportShop`,
        currentPage: 'admin-orders',
        order
      });
    } catch (error) {
      console.error('Admin View Order Error:', error);
      req.flash('error', 'Không thể tải chi tiết đơn hàng');
      res.redirect('/admin/orders');
    }
  }

  // Cập nhật trạng thái đơn hàng
  static async updateOrderStatus(req, res) {
    try {
      const { status } = req.body;
      await Order.findByIdAndUpdate(req.params.id, { 
        status,
        updatedAt: new Date()
      });

      res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
    } catch (error) {
      console.error('Admin Update Order Status Error:', error);
      res.json({ success: false, message: 'Lỗi cập nhật trạng thái: ' + error.message });
    }
  }

  // Danh sách người dùng
  static async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 20;
      const skip = (page - 1) * limit;

      const [users, totalUsers] = await Promise.all([
        User.find({ role: 'user' })
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        User.countDocuments({ role: 'user' })
      ]);

      const totalPages = Math.ceil(totalUsers / limit);

      res.render('admin/users/list', {
        title: 'Quản lý người dùng - SportShop',
        currentPage: 'admin-users',
        users,
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Admin List Users Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải danh sách người dùng',
        currentPage: 'error' 
      });
    }
  }

  // Chi tiết người dùng
  static async viewUser(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        req.flash('error', 'Không tìm thấy người dùng');
        return res.redirect('/admin/users');
      }

      // Lấy đơn hàng của user
      const userOrders = await Order.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(10);

      res.render('admin/users/view', {
        title: `Người dùng ${user.fullName} - SportShop`,
        currentPage: 'admin-users',
        user,
        userOrders
      });
    } catch (error) {
      console.error('Admin View User Error:', error);
      req.flash('error', 'Không thể tải thông tin người dùng');
      res.redirect('/admin/users');
    }
  }

  // Cập nhật trạng thái người dùng
  static async updateUserStatus(req, res) {
    try {
      const { isActive } = req.body;
      await User.findByIdAndUpdate(req.params.id, { 
        isActive: isActive === 'true',
        updatedAt: new Date()
      });

      res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
    } catch (error) {
      console.error('Admin Update User Status Error:', error);
      res.json({ success: false, message: 'Lỗi cập nhật trạng thái: ' + error.message });
    }
  }

  // Thống kê
  static async statistics(req, res) {
    try {
      // TODO: Implement statistics
      res.render('admin/statistics', {
        title: 'Thống kê - SportShop',
        currentPage: 'admin-statistics'
      });
    } catch (error) {
      console.error('Admin Statistics Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang thống kê',
        currentPage: 'error' 
      });
    }
  }

  // API thống kê tổng quan
  static async getStatsOverview(req, res) {
    try {
      const [totalProducts, totalUsers, totalOrders, totalRevenue] = await Promise.all([
        Product.countDocuments(),
        User.countDocuments({ role: 'user' }),
        Order.countDocuments(),
        Order.aggregate([
          { $match: { status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          totalProducts,
          totalUsers,
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0
        }
      });
    } catch (error) {
      console.error('Admin Stats Overview Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  // API thống kê doanh số
  static async getSalesStats(req, res) {
    try {
      // TODO: Implement sales statistics
      res.json({
        success: true,
        data: {
          dailySales: [],
          monthlySales: [],
          topProducts: []
        }
      });
    } catch (error) {
      console.error('Admin Sales Stats Error:', error);
      res.json({ success: false, message: error.message });
    }
  }
}

module.exports = AdminController;