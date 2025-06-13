// controllers/adminController.js
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Settings = require('../models/Settings'); // ✨ Added Settings model
const bcrypt = require('bcrypt');

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
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Build filter query
      let filterQuery = {};
      if (req.query.status) {
        filterQuery.status = req.query.status;
      }
      if (req.query.fromDate) {
        filterQuery.createdAt = { $gte: new Date(req.query.fromDate) };
      }
      if (req.query.toDate) {
        filterQuery.createdAt = { 
          ...filterQuery.createdAt, 
          $lte: new Date(req.query.toDate) 
        };
      }

      const [orders, totalOrders] = await Promise.all([
        Order.find(filterQuery)
          .populate('userId', 'firstName lastName email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filterQuery)
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
          hasPrev: page > 1,
          total: totalOrders
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

  // ===== USER MANAGEMENT METHODS =====

  // Danh sách người dùng
  static async listUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      // Build filter query
      let filterQuery = {};
      
      // Role filter
      if (req.query.role) {
        filterQuery.role = req.query.role;
      }
      
      // Status filter
      if (req.query.status === 'active') {
        filterQuery.isActive = true;
      } else if (req.query.status === 'inactive') {
        filterQuery.isActive = false;
      } else if (req.query.status === 'verified') {
        filterQuery.isVerified = true;
      } else if (req.query.status === 'unverified') {
        filterQuery.isVerified = false;
      }
      
      // Date range filter
      if (req.query.fromDate) {
        filterQuery.createdAt = { $gte: new Date(req.query.fromDate) };
      }
      if (req.query.toDate) {
        filterQuery.createdAt = { 
          ...filterQuery.createdAt, 
          $lte: new Date(req.query.toDate) 
        };
      }
      
      // Search filter
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
        pagination: {
          currentPage: page,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          total: totalUsers
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

  // Thêm người dùng mới
  static async addUser(req, res) {
    try {
      const {
        firstName,
        lastName,
        email,
        phone,
        birthDate,
        gender,
        role,
        password,
        isActive,
        isVerified
      } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !password) {
        return res.json({ 
          success: false, 
          message: 'Vui lòng điền đầy đủ thông tin bắt buộc!' 
        });
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.json({ 
          success: false, 
          message: 'Email đã được sử dụng!' 
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const userData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone: phone ? phone.trim() : undefined,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        gender: gender || undefined,
        role: role || 'user',
        isActive: isActive === 'on' || isActive === true,
        isVerified: isVerified === 'on' || isVerified === true
      };

      const user = new User(userData);
      await user.save();

      console.log('✅ New user created by admin:', {
        userId: user._id,
        email: user.email,
        role: user.role,
        createdBy: req.session.user.email
      });

      res.json({ 
        success: true, 
        message: 'Thêm người dùng thành công!',
        user: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email
        }
      });

    } catch (error) {
      console.error('Admin Add User Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi thêm người dùng: ' + error.message 
      });
    }
  }

  // Lấy thông tin người dùng để chỉnh sửa
  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id).select('-password');
      if (!user) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy người dùng' 
        });
      }

      res.json({ 
        success: true, 
        user: user 
      });
    } catch (error) {
      console.error('Admin Get User Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi lấy thông tin người dùng: ' + error.message 
      });
    }
  }

  // Chỉnh sửa người dùng
  static async editUser(req, res) {
    try {
      const userId = req.params.id;
      const {
        firstName,
        lastName,
        email,
        phone,
        birthDate,
        gender,
        role,
        password,
        isActive,
        isVerified
      } = req.body;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy người dùng' 
        });
      }

      // Check if email is being changed and already exists
      if (email && email.toLowerCase() !== user.email) {
        const existingUser = await User.findOne({ 
          email: email.toLowerCase(),
          _id: { $ne: userId }
        });
        if (existingUser) {
          return res.json({ 
            success: false, 
            message: 'Email đã được sử dụng!' 
          });
        }
      }

      // Prepare update data
      const updateData = {
        firstName: firstName ? firstName.trim() : user.firstName,
        lastName: lastName ? lastName.trim() : user.lastName,
        email: email ? email.toLowerCase().trim() : user.email,
        phone: phone ? phone.trim() : user.phone,
        birthDate: birthDate ? new Date(birthDate) : user.birthDate,
        gender: gender || user.gender,
        role: role || user.role,
        isActive: isActive === 'on' || isActive === true,
        isVerified: isVerified === 'on' || isVerified === true,
        updatedAt: new Date()
      };

      // Update password if provided
      if (password && password.trim()) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Update user
      await User.findByIdAndUpdate(userId, updateData);

      console.log('✅ User updated by admin:', {
        userId: userId,
        updatedBy: req.session.user.email,
        changes: Object.keys(updateData)
      });

      res.json({ 
        success: true, 
        message: 'Cập nhật người dùng thành công!' 
      });

    } catch (error) {
      console.error('Admin Edit User Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi cập nhật người dùng: ' + error.message 
      });
    }
  }

  // Xóa người dùng
  static async deleteUser(req, res) {
    try {
      const userId = req.params.id;
      const currentUserId = req.session.user.id;

      // Prevent admin from deleting themselves
      if (userId === currentUserId) {
        return res.json({ 
          success: false, 
          message: 'Không thể xóa tài khoản của chính mình!' 
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy người dùng' 
        });
      }

      // Prevent deleting other admins (optional security measure)
      if (user.role === 'admin') {
        return res.json({ 
          success: false, 
          message: 'Không thể xóa tài khoản quản trị viên!' 
        });
      }

      // Delete user
      await User.findByIdAndDelete(userId);

      // Also delete related data (optional)
      await Cart.deleteMany({ userId: userId });

      console.log('🗑️ User deleted by admin:', {
        deletedUserId: userId,
        deletedUserEmail: user.email,
        deletedBy: req.session.user.email
      });

      res.json({ 
        success: true, 
        message: 'Xóa người dùng thành công!' 
      });

    } catch (error) {
      console.error('Admin Delete User Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi xóa người dùng: ' + error.message 
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

      // Lấy giỏ hàng của user
      const userCart = await Cart.findOne({ userId: user._id })
        .populate('items.product');

      res.render('admin/users/view', {
        title: `Người dùng ${user.firstName} ${user.lastName} - SportShop`,
        currentPage: 'admin-users',
        user,
        userOrders,
        userCart
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
      const userId = req.params.id;
      const currentUserId = req.session.user.id;

      // Prevent admin from deactivating themselves
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

      console.log('🔄 User status updated by admin:', {
        userId: userId,
        newStatus: isActive,
        updatedBy: req.session.user.email
      });

      res.json({ 
        success: true, 
        message: `${isActive ? 'Kích hoạt' : 'Tạm dừng'} người dùng thành công!` 
      });
    } catch (error) {
      console.error('Admin Update User Status Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi cập nhật trạng thái: ' + error.message 
      });
    }
  }

  // Thao tác hàng loạt với người dùng
  static async bulkUserAction(req, res) {
    try {
      const { userIds, action } = req.body;
      const currentUserId = req.session.user.id;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.json({ 
          success: false, 
          message: 'Vui lòng chọn ít nhất một người dùng!' 
        });
      }

      // Prevent admin from affecting themselves
      const filteredUserIds = userIds.filter(id => id !== currentUserId);
      if (filteredUserIds.length === 0) {
        return res.json({ 
          success: false, 
          message: 'Không thể thực hiện thao tác trên tài khoản của chính mình!' 
        });
      }

      let updateData = {};
      let successMessage = '';

      switch (action) {
        case 'activate':
          updateData = { isActive: true, updatedAt: new Date() };
          successMessage = `Đã kích hoạt ${filteredUserIds.length} người dùng!`;
          break;
        case 'deactivate':
          updateData = { isActive: false, updatedAt: new Date() };
          successMessage = `Đã tạm dừng ${filteredUserIds.length} người dùng!`;
          break;
        case 'promote':
          updateData = { role: 'admin', updatedAt: new Date() };
          successMessage = `Đã cấp quyền admin cho ${filteredUserIds.length} người dùng!`;
          break;
        case 'demote':
          updateData = { role: 'user', updatedAt: new Date() };
          successMessage = `Đã thu hồi quyền admin từ ${filteredUserIds.length} người dùng!`;
          break;
        case 'delete':
          // Prevent deleting admins in bulk
          const adminUsers = await User.find({ 
            _id: { $in: filteredUserIds }, 
            role: 'admin' 
          });
          if (adminUsers.length > 0) {
            return res.json({ 
              success: false, 
              message: 'Không thể xóa tài khoản quản trị viên!' 
            });
          }
          
          await User.deleteMany({ _id: { $in: filteredUserIds } });
          await Cart.deleteMany({ userId: { $in: filteredUserIds } });
          
          return res.json({ 
            success: true, 
            message: `Đã xóa ${filteredUserIds.length} người dùng!` 
          });
        default:
          return res.json({ 
            success: false, 
            message: 'Thao tác không hợp lệ!' 
          });
      }

      if (action !== 'delete') {
        await User.updateMany(
          { _id: { $in: filteredUserIds } },
          updateData
        );
      }

      console.log('📦 Bulk user action by admin:', {
        action: action,
        userIds: filteredUserIds,
        count: filteredUserIds.length,
        performedBy: req.session.user.email
      });

      res.json({ 
        success: true, 
        message: successMessage 
      });

    } catch (error) {
      console.error('Admin Bulk User Action Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi thực hiện thao tác: ' + error.message 
      });
    }
  }

  // Xuất danh sách người dùng
  static async exportUsers(req, res) {
    try {
      const { userIds } = req.query;
      let filterQuery = {};

      // If specific users selected
      if (userIds) {
        const ids = userIds.split(',');
        filterQuery._id = { $in: ids };
      }

      const users = await User.find(filterQuery)
        .select('-password')
        .sort({ createdAt: -1 });

      // Create CSV content
      let csvContent = 'ID,Họ,Tên,Email,Số điện thoại,Vai trò,Trạng thái,Xác thực,Ngày đăng ký\n';
      
      users.forEach(user => {
        csvContent += `${user._id},"${user.firstName || ''}","${user.lastName || ''}","${user.email}","${user.phone || ''}","${user.role}","${user.isActive ? 'Hoạt động' : 'Tạm dừng'}","${user.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}","${new Date(user.createdAt).toLocaleDateString('vi-VN')}"\n`;
      });

      // Set headers for file download
      const filename = `nguoi-dung-${new Date().toISOString().split('T')[0]}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Add BOM for proper UTF-8 encoding in Excel
      res.write('\ufeff');
      res.write(csvContent);
      res.end();

      console.log('📊 Users exported by admin:', {
        count: users.length,
        exportedBy: req.session.user.email,
        filename: filename
      });

    } catch (error) {
      console.error('Admin Export Users Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi xuất dữ liệu: ' + error.message 
      });
    }
  }

  // ===== END USER MANAGEMENT METHODS =====

  // ===== SETTINGS MANAGEMENT METHODS =====

  // Hiển thị trang cài đặt
  static async showSettings(req, res) {
    try {
      // Lấy tất cả cài đặt hiện tại
      const allSettings = await Settings.getAllSettings();
      
      // Lấy cài đặt mặc định để so sánh
      const defaultSettings = Settings.getDefaultSettings();
      
      // Merge với default settings nếu thiếu
      const settings = {};
      for (const [type, defaultData] of Object.entries(defaultSettings)) {
        settings[type] = allSettings[type] || defaultData;
      }

      res.render('admin/settings', {
        title: 'Cài đặt hệ thống - SportShop',
        currentPage: 'admin-settings',
        settings,
        defaultSettings
      });
    } catch (error) {
      console.error('Admin Show Settings Error:', error);
      res.status(500).render('error', { 
        title: 'Lỗi - SportShop',
        error: 'Không thể tải trang cài đặt',
        currentPage: 'error' 
      });
    }
  }

  // Lấy cài đặt theo loại (API)
  static async getSettings(req, res) {
    try {
      const { type } = req.params;
      
      if (!type) {
        // Lấy tất cả cài đặt
        const allSettings = await Settings.getAllSettings();
        return res.json({
          success: true,
          settings: allSettings
        });
      }

      // Lấy cài đặt theo loại
      const settingData = await Settings.getSetting(type);
      
      if (settingData === null) {
        // Trả về default nếu chưa có
        const defaultSettings = Settings.getDefaultSettings();
        return res.json({
          success: true,
          setting: {
            type: type,
            data: defaultSettings[type] || {},
            isDefault: true
          }
        });
      }

      res.json({
        success: true,
        setting: {
          type: type,
          data: settingData,
          isDefault: false
        }
      });

    } catch (error) {
      console.error('Admin Get Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy cài đặt: ' + error.message
      });
    }
  }

  // Cập nhật cài đặt
  static async updateSettings(req, res) {
    try {
      const { type } = req.params;
      const updateData = req.body;
      const userId = req.session.user.id;

      // Validate setting type
      const validTypes = [
        'shop-info',
        'brand-colors', 
        'contact',
        'map',
        'social',
        'system',
        'advanced'
      ];

      if (!validTypes.includes(type)) {
        return res.json({
          success: false,
          message: 'Loại cài đặt không hợp lệ!'
        });
      }

      // Validate specific settings based on type
      const validationResult = AdminController.validateSettingsData(type, updateData);
      if (!validationResult.isValid) {
        return res.json({
          success: false,
          message: validationResult.message
        });
      }

      // Process the data based on type
      const processedData = AdminController.processSettingsData(type, updateData);

      // Update settings
      await Settings.setSetting(type, processedData, userId);

      console.log('⚙️ Settings updated by admin:', {
        type: type,
        updatedBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Cập nhật cài đặt thành công!',
        data: processedData
      });

    } catch (error) {
      console.error('Admin Update Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi cập nhật cài đặt: ' + error.message
      });
    }
  }

  // Đặt lại cài đặt về mặc định
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

      // Reset to default
      await Settings.setSetting(type, defaultSettings[type], userId);

      console.log('🔄 Settings reset to default by admin:', {
        type: type,
        resetBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Đã đặt lại cài đặt về mặc định!',
        data: defaultSettings[type]
      });

    } catch (error) {
      console.error('Admin Reset Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi đặt lại cài đặt: ' + error.message
      });
    }
  }

  // Khởi tạo cài đặt mặc định
  static async initializeDefaultSettings(req, res) {
    try {
      await Settings.initializeDefaults();

      console.log('🚀 Default settings initialized by admin:', {
        initializedBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Đã khởi tạo cài đặt mặc định thành công!'
      });

    } catch (error) {
      console.error('Admin Initialize Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi khởi tạo cài đặt: ' + error.message
      });
    }
  }

  // Sao lưu cài đặt
  static async backupSettings(req, res) {
    try {
      const settings = await Settings.find({}).sort({ type: 1 });
      
      const backupData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user.email,
        version: '1.0',
        settings: settings.map(setting => setting.backup())
      };

      const filename = `settings-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(backupData);

      console.log('💾 Settings backup created by admin:', {
        count: settings.length,
        backupBy: req.session.user.email,
        filename: filename
      });

    } catch (error) {
      console.error('Admin Backup Settings Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi sao lưu cài đặt: ' + error.message
      });
    }
  }

  // Khôi phục cài đặt từ backup
  static async restoreSettings(req, res) {
    try {
      const { backupData } = req.body;
      const userId = req.session.user.id;

      if (!backupData || !backupData.settings || !Array.isArray(backupData.settings)) {
        return res.json({
          success: false,
          message: 'Dữ liệu backup không hợp lệ!'
        });
      }

      let restoredCount = 0;
      const errors = [];

      for (const settingBackup of backupData.settings) {
        try {
          const setting = await Settings.findOne({ type: settingBackup.type });
          if (setting) {
            await setting.restore(settingBackup, userId);
          } else {
            await Settings.create({
              type: settingBackup.type,
              data: settingBackup.data,
              createdBy: userId,
              updatedBy: userId,
              version: 1
            });
          }
          restoredCount++;
        } catch (err) {
          errors.push(`${settingBackup.type}: ${err.message}`);
        }
      }

      console.log('📥 Settings restored from backup by admin:', {
        restored: restoredCount,
        errors: errors.length,
        restoredBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Đã khôi phục ${restoredCount} cài đặt thành công!`,
        details: {
          restored: restoredCount,
          errors: errors
        }
      });

    } catch (error) {
      console.error('Admin Restore Settings Error:', error);
      res.json({
        success: false,
        message: 'Lỗi khôi phục cài đặt: ' + error.message
      });
    }
  }

  // Lấy lịch sử thay đổi cài đặt
  static async getSettingsHistory(req, res) {
    try {
      const { type, page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      let query = {};
      if (type) {
        query.type = type;
      }

      const [settings, total] = await Promise.all([
        Settings.find(query)
          .populate('createdBy', 'firstName lastName email')
          .populate('updatedBy', 'firstName lastName email')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Settings.countDocuments(query)
      ]);

      res.json({
        success: true,
        data: {
          settings: settings.map(setting => ({
            type: setting.type,
            version: setting.version,
            createdAt: setting.createdAt,
            updatedAt: setting.updatedAt,
            createdBy: setting.createdBy,
            updatedBy: setting.updatedBy,
            formattedUpdatedAt: setting.formattedUpdatedAt
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Admin Settings History Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy lịch sử cài đặt: ' + error.message
      });
    }
  }

  // Validate settings data based on type
  static validateSettingsData(type, data) {
    switch (type) {
      case 'shop-info':
        if (!data.name || data.name.trim().length === 0) {
          return { isValid: false, message: 'Tên cửa hàng là bắt buộc!' };
        }
        if (data.name.length > 100) {
          return { isValid: false, message: 'Tên cửa hàng không được quá 100 ký tự!' };
        }
        break;

      case 'brand-colors':
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (data.primary && !colorRegex.test(data.primary)) {
          return { isValid: false, message: 'Màu chính không hợp lệ!' };
        }
        if (data.secondary && !colorRegex.test(data.secondary)) {
          return { isValid: false, message: 'Màu phụ không hợp lệ!' };
        }
        if (data.accent && !colorRegex.test(data.accent)) {
          return { isValid: false, message: 'Màu nhấn không hợp lệ!' };
        }
        break;

      case 'contact':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (data.email && !emailRegex.test(data.email)) {
          return { isValid: false, message: 'Email không hợp lệ!' };
        }
        const phoneRegex = /^[0-9\s\-\(\)\+]{10,15}$/;
        if (data.phone && !phoneRegex.test(data.phone)) {
          return { isValid: false, message: 'Số điện thoại không hợp lệ!' };
        }
        break;

      case 'map':
        if (data.latitude && (data.latitude < -90 || data.latitude > 90)) {
          return { isValid: false, message: 'Vĩ độ phải từ -90 đến 90!' };
        }
        if (data.longitude && (data.longitude < -180 || data.longitude > 180)) {
          return { isValid: false, message: 'Kinh độ phải từ -180 đến 180!' };
        }
        break;

      case 'system':
        if (data.siteName && data.siteName.length > 200) {
          return { isValid: false, message: 'Tên site không được quá 200 ký tự!' };
        }
        if (data.metaDescription && data.metaDescription.length > 300) {
          return { isValid: false, message: 'Meta description không được quá 300 ký tự!' };
        }
        break;

      case 'advanced':
        if (data.maxLoginAttempts && (data.maxLoginAttempts < 1 || data.maxLoginAttempts > 20)) {
          return { isValid: false, message: 'Số lần đăng nhập tối đa phải từ 1 đến 20!' };
        }
        if (data.sessionTimeout && (data.sessionTimeout < 5 || data.sessionTimeout > 10080)) {
          return { isValid: false, message: 'Thời gian session phải từ 5 phút đến 7 ngày!' };
        }
        break;
    }

    return { isValid: true };
  }

  // Process settings data based on type
  static processSettingsData(type, data) {
    const processed = { ...data };

    switch (type) {
      case 'shop-info':
        processed.name = processed.name?.trim();
        processed.slogan = processed.slogan?.trim();
        processed.description = processed.description?.trim();
        break;

      case 'brand-colors':
        // Ensure colors are lowercase
        if (processed.primary) processed.primary = processed.primary.toLowerCase();
        if (processed.secondary) processed.secondary = processed.secondary.toLowerCase();
        if (processed.accent) processed.accent = processed.accent.toLowerCase();
        // Convert darkMode to boolean
        processed.darkMode = processed.darkMode === 'true' || processed.darkMode === true;
        break;

      case 'contact':
        processed.email = processed.email?.toLowerCase().trim();
        processed.phone = processed.phone?.trim();
        processed.hotline = processed.hotline?.trim();
        processed.address = processed.address?.trim();
        processed.workingHours = processed.workingHours?.trim();
        processed.workingDays = processed.workingDays?.trim();
        break;

      case 'map':
        if (processed.latitude) processed.latitude = parseFloat(processed.latitude);
        if (processed.longitude) processed.longitude = parseFloat(processed.longitude);
        processed.embed = processed.embed?.trim();
        break;

      case 'social':
        // Trim all social URLs
        Object.keys(processed).forEach(key => {
          if (processed[key]) {
            processed[key] = processed[key].trim();
            // Add https:// if missing
            if (processed[key] && !processed[key].startsWith('http')) {
              processed[key] = 'https://' + processed[key];
            }
          }
        });
        break;

      case 'system':
        processed.siteName = processed.siteName?.trim();
        processed.metaDescription = processed.metaDescription?.trim();
        processed.keywords = processed.keywords?.trim();
        processed.currency = processed.currency?.trim();
        processed.timezone = processed.timezone?.trim();
        processed.language = processed.language?.trim();
        break;

      case 'advanced':
        // Convert boolean fields
        processed.maintenanceMode = processed.maintenanceMode === 'true' || processed.maintenanceMode === true;
        processed.allowRegistration = processed.allowRegistration === 'true' || processed.allowRegistration === true;
        processed.requireEmailVerification = processed.requireEmailVerification === 'true' || processed.requireEmailVerification === true;
        
        // Convert numeric fields
        if (processed.maxLoginAttempts) processed.maxLoginAttempts = parseInt(processed.maxLoginAttempts);
        if (processed.sessionTimeout) processed.sessionTimeout = parseInt(processed.sessionTimeout);
        break;
    }

    return processed;
  }

  // Kiểm tra chế độ bảo trì
  static async getMaintenanceMode(req, res) {
    try {
      const advancedSettings = await Settings.getSetting('advanced');
      const maintenanceMode = advancedSettings?.maintenanceMode || false;

      res.json({
        success: true,
        maintenanceMode: maintenanceMode
      });
    } catch (error) {
      console.error('Get Maintenance Mode Error:', error);
      res.json({
        success: false,
        maintenanceMode: false
      });
    }
  }

  // Bật/tắt chế độ bảo trì
  static async toggleMaintenanceMode(req, res) {
    try {
      const { enabled } = req.body;
      const userId = req.session.user.id;

      const currentSettings = await Settings.getSetting('advanced') || {};
      currentSettings.maintenanceMode = enabled === true || enabled === 'true';

      await Settings.setSetting('advanced', currentSettings, userId);

      console.log(`🔧 Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin:`, {
        enabled: currentSettings.maintenanceMode,
        toggledBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Chế độ bảo trì đã được ${enabled ? 'bật' : 'tắt'}!`,
        maintenanceMode: currentSettings.maintenanceMode
      });

    } catch (error) {
      console.error('Toggle Maintenance Mode Error:', error);
      res.json({
        success: false,
        message: 'Lỗi thay đổi chế độ bảo trì: ' + error.message
      });
    }
  }

  // ===== END SETTINGS MANAGEMENT METHODS =====

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

  // ===== ADDITIONAL UTILITY METHODS =====

  // Search users (API endpoint for autocomplete)
  static async searchUsers(req, res) {
    try {
      const { q: query, limit = 10 } = req.query;
      
      if (!query || query.length < 2) {
        return res.json({ success: true, users: [] });
      }

      const searchRegex = new RegExp(query, 'i');
      const users = await User.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex }
        ]
      })
      .select('firstName lastName email role isActive')
      .limit(parseInt(limit))
      .sort({ firstName: 1 });

      res.json({
        success: true,
        users: users.map(user => ({
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }))
      });
    } catch (error) {
      console.error('Admin Search Users Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  // Get user statistics for dashboard
  static async getUserStats(req, res) {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeUsers,
        newUsersThisWeek,
        newUsersThisMonth,
        adminUsers,
        verifiedUsers
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
        User.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
        User.countDocuments({ role: 'admin' }),
        User.countDocuments({ isVerified: true })
      ]);

      res.json({
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          newUsersThisWeek,
          newUsersThisMonth,
          adminUsers,
          verifiedUsers,
          unverifiedUsers: totalUsers - verifiedUsers,
          verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0,
          activityRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
        }
      });
    } catch (error) {
      console.error('Admin Get User Stats Error:', error);
      res.json({ success: false, message: error.message });
    }
  }

  // Send notification to users (future feature)
  static async sendNotificationToUsers(req, res) {
    try {
      const { userIds, title, message, type = 'info' } = req.body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.json({ 
          success: false, 
          message: 'Vui lòng chọn ít nhất một người dùng!' 
        });
      }

      if (!title || !message) {
        return res.json({ 
          success: false, 
          message: 'Vui lòng nhập tiêu đề và nội dung thông báo!' 
        });
      }

      // TODO: Implement notification system
      // This could integrate with email service, push notifications, etc.
      
      console.log('📧 Notification sent by admin:', {
        to: userIds,
        title: title,
        type: type,
        sentBy: req.session.user.email
      });

      res.json({
        success: true,
        message: `Đã gửi thông báo tới ${userIds.length} người dùng!`
      });

    } catch (error) {
      console.error('Admin Send Notification Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi gửi thông báo: ' + error.message 
      });
    }
  }

  // Reset user password (admin function)
  static async resetUserPassword(req, res) {
    try {
      const userId = req.params.id;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.json({ 
          success: false, 
          message: 'Mật khẩu mới phải có ít nhất 6 ký tự!' 
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy người dùng!' 
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      // Update password
      await User.findByIdAndUpdate(userId, {
        password: hashedPassword,
        updatedAt: new Date()
      });

      console.log('🔑 Password reset by admin:', {
        userId: userId,
        userEmail: user.email,
        resetBy: req.session.user.email
      });

      res.json({
        success: true,
        message: 'Đặt lại mật khẩu thành công!'
      });

    } catch (error) {
      console.error('Admin Reset Password Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi đặt lại mật khẩu: ' + error.message 
      });
    }
  }

  // Verify user email (admin function)
  static async verifyUserEmail(req, res) {
    try {
      const userId = req.params.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.json({ 
          success: false, 
          message: 'Không tìm thấy người dùng!' 
        });
      }

      await User.findByIdAndUpdate(userId, {
        isVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
        updatedAt: new Date()
      });

      console.log('✅ Email verified by admin:', {
        userId: userId,
        userEmail: user.email,
        verifiedBy: req.session.user.email
      });

      res.json({
        success: true,
        message: 'Xác thực email thành công!'
      });

    } catch (error) {
      console.error('Admin Verify Email Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi xác thực email: ' + error.message 
      });
    }
  }

  // Get user activity log (future feature)
  static async getUserActivityLog(req, res) {
    try {
      const userId = req.params.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      // TODO: Implement user activity logging system
      // This would track user login, logout, purchases, etc.

      res.json({
        success: true,
        activities: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          total: 0
        }
      });

    } catch (error) {
      console.error('Admin Get Activity Log Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi lấy nhật ký hoạt động: ' + error.message 
      });
    }
  }

  // Backup users data
  static async backupUsersData(req, res) {
    try {
      const users = await User.find({})
        .select('-password')
        .sort({ createdAt: -1 });

      const backupData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user.email,
        totalUsers: users.length,
        users: users
      };

      const filename = `users-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(backupData);

      console.log('💾 Users backup created by admin:', {
        count: users.length,
        backupBy: req.session.user.email,
        filename: filename
      });

    } catch (error) {
      console.error('Admin Backup Users Error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi sao lưu dữ liệu: ' + error.message 
      });
    }
  }

  // Admin dashboard data summary
  static async getDashboardSummary(req, res) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        // Users stats
        totalUsers, activeUsers, newUsersToday, newUsersThisWeek, newUsersThisMonth,
        // Products stats  
        totalProducts, activeProducts, lowStock,
        // Orders stats
        totalOrders, ordersToday, ordersThisWeek, ordersThisMonth,
        // Revenue stats
        revenueToday, revenueThisWeek, revenueThisMonth,
        // Recent activities
        recentUsers, recentOrders
      ] = await Promise.all([
        // Users
        User.countDocuments(),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ createdAt: { $gte: startOfToday } }),
        User.countDocuments({ createdAt: { $gte: startOfWeek } }),
        User.countDocuments({ createdAt: { $gte: startOfMonth } }),
        
        // Products
        Product.countDocuments(),
        Product.countDocuments({ inStock: true }),
        Product.countDocuments({ stockQuantity: { $lt: 10 } }),
        
        // Orders
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: startOfToday } }),
        Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
        Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
        
        // Revenue
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfToday }, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfWeek }, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]),
        
        // Recent activities
        User.find().select('firstName lastName email createdAt').sort({ createdAt: -1 }).limit(5),
        Order.find().populate('userId', 'firstName lastName').sort({ createdAt: -1 }).limit(5)
      ]);

      res.json({
        success: true,
        summary: {
          users: {
            total: totalUsers,
            active: activeUsers,
            newToday: newUsersToday,
            newThisWeek: newUsersThisWeek,
            newThisMonth: newUsersThisMonth
          },
          products: {
            total: totalProducts,
            active: activeProducts,
            lowStock: lowStock
          },
          orders: {
            total: totalOrders,
            today: ordersToday,
            thisWeek: ordersThisWeek,
            thisMonth: ordersThisMonth
          },
          revenue: {
            today: revenueToday[0]?.total || 0,
            thisWeek: revenueThisWeek[0]?.total || 0,
            thisMonth: revenueThisMonth[0]?.total || 0
          },
          recent: {
            users: recentUsers,
            orders: recentOrders
          }
        }
      });

    } catch (error) {
      console.error('Admin Dashboard Summary Error:', error);
      res.json({ 
        success: false, 
        message: 'Lỗi lấy tổng quan: ' + error.message 
      });
    }
  }

  // ===== SYSTEM MANAGEMENT METHODS =====

  // Lấy thông tin hệ thống
  static async getSystemInfo(req, res) {
    try {
      const systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      };

      // Thống kê database
      const dbStats = {
        totalUsers: await User.countDocuments(),
        totalProducts: await Product.countDocuments(),
        totalOrders: await Order.countDocuments(),
        totalSettings: await Settings.countDocuments()
      };

      res.json({
        success: true,
        system: systemInfo,
        database: dbStats
      });

    } catch (error) {
      console.error('Admin System Info Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy thông tin hệ thống: ' + error.message
      });
    }
  }

  // Dọn dẹp dữ liệu
  static async cleanupData(req, res) {
    try {
      const { type } = req.body;
      let cleanupResult = { removed: 0, message: '' };

      switch (type) {
        case 'expired-sessions':
          // TODO: Implement session cleanup if using custom session storage
          cleanupResult.message = 'Dọn dẹp session hết hạn thành công';
          break;

        case 'abandoned-carts':
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const result = await Cart.deleteMany({
            status: 'abandoned',
            updatedAt: { $lt: thirtyDaysAgo }
          });
          cleanupResult.removed = result.deletedCount;
          cleanupResult.message = `Đã xóa ${result.deletedCount} giỏ hàng bỏ hoang`;
          break;

        case 'old-logs':
          // TODO: Implement log cleanup if using custom logging
          cleanupResult.message = 'Dọn dẹp log cũ thành công';
          break;

        default:
          return res.json({
            success: false,
            message: 'Loại dọn dẹp không hợp lệ!'
          });
      }

      console.log('🧹 Data cleanup performed by admin:', {
        type: type,
        removed: cleanupResult.removed,
        performedBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: cleanupResult.message,
        removed: cleanupResult.removed
      });

    } catch (error) {
      console.error('Admin Cleanup Data Error:', error);
      res.json({
        success: false,
        message: 'Lỗi dọn dẹp dữ liệu: ' + error.message
      });
    }
  }

  // Kiểm tra sức khỏe hệ thống
  static async healthCheck(req, res) {
    try {
      const checks = {
        database: false,
        settings: false,
        fileSystem: false,
        memory: false
      };

      // Kiểm tra database
      try {
        await User.findOne().limit(1);
        checks.database = true;
      } catch (err) {
        console.error('Database health check failed:', err);
      }

      // Kiểm tra settings
      try {
        await Settings.findOne().limit(1);
        checks.settings = true;
      } catch (err) {
        console.error('Settings health check failed:', err);
      }

      // Kiểm tra file system
      try {
        const fs = require('fs');
        fs.accessSync('./public', fs.constants.R_OK);
        checks.fileSystem = true;
      } catch (err) {
        console.error('File system health check failed:', err);
      }

      // Kiểm tra memory usage
      const memUsage = process.memoryUsage();
      checks.memory = memUsage.heapUsed < memUsage.heapTotal * 0.9; // < 90% usage

      const isHealthy = Object.values(checks).every(check => check === true);

      res.json({
        success: true,
        healthy: isHealthy,
        checks: checks,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Admin Health Check Error:', error);
      res.json({
        success: false,
        healthy: false,
        message: 'Lỗi kiểm tra sức khỏe hệ thống: ' + error.message
      });
    }
  }

  // Xuất toàn bộ dữ liệu hệ thống
  static async exportAllData(req, res) {
    try {
      const [users, products, orders, settings] = await Promise.all([
        User.find({}).select('-password'),
        Product.find({}),
        Order.find({}).populate('userId', 'firstName lastName email'),
        Settings.find({})
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: req.session.user.email,
        version: '1.0',
        data: {
          users: users,
          products: products,
          orders: orders,
          settings: settings
        },
        statistics: {
          totalUsers: users.length,
          totalProducts: products.length,
          totalOrders: orders.length,
          totalSettings: settings.length
        }
      };

      const filename = `sportshop-full-export-${new Date().toISOString().split('T')[0]}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(exportData);

      console.log('📊 Full data export by admin:', {
        totalRecords: users.length + products.length + orders.length + settings.length,
        exportedBy: req.session.user.email,
        filename: filename
      });

    } catch (error) {
      console.error('Admin Export All Data Error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi xuất dữ liệu: ' + error.message
      });
    }
  }

  // ===== END SYSTEM MANAGEMENT METHODS =====

  // ===== CACHE MANAGEMENT METHODS =====

  // Xóa cache (nếu sử dụng Redis hoặc cache khác)
  static async clearCache(req, res) {
    try {
      const { type } = req.body;

      // TODO: Implement cache clearing based on your caching strategy
      // Example for different cache types:
      switch (type) {
        case 'all':
          // clearAllCache();
          break;
        case 'products':
          // clearProductCache();
          break;
        case 'users':
          // clearUserCache();
          break;
        case 'settings':
          // clearSettingsCache();
          break;
        default:
          return res.json({
            success: false,
            message: 'Loại cache không hợp lệ!'
          });
      }

      console.log('🗑️ Cache cleared by admin:', {
        type: type,
        clearedBy: req.session.user.email,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: `Đã xóa cache ${type} thành công!`
      });

    } catch (error) {
      console.error('Admin Clear Cache Error:', error);
      res.json({
        success: false,
        message: 'Lỗi xóa cache: ' + error.message
      });
    }
  }

  // ===== END CACHE MANAGEMENT METHODS =====

  // ===== AUDIT LOG METHODS =====

  // Ghi audit log
  static async logAdminAction(action, details, req) {
    try {
      // TODO: Implement audit logging system
      const logEntry = {
        timestamp: new Date().toISOString(),
        adminId: req.session.user.id,
        adminEmail: req.session.user.email,
        action: action,
        details: details,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent')
      };

      console.log('📝 Admin Action Logged:', logEntry);
      
      // In a real application, you might want to store this in a separate collection
      // await AuditLog.create(logEntry);

    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  // Lấy audit logs
  static async getAuditLogs(req, res) {
    try {
      const { page = 1, limit = 50, action, adminId, fromDate, toDate } = req.query;

      // TODO: Implement audit log retrieval
      // This would query your audit log collection

      res.json({
        success: true,
        logs: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });

    } catch (error) {
      console.error('Admin Get Audit Logs Error:', error);
      res.json({
        success: false,
        message: 'Lỗi lấy audit logs: ' + error.message
      });
    }
  }

  // ===== END AUDIT LOG METHODS =====
}

module.exports = AdminController;