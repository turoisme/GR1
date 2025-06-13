// controllers/adminController.js
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
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
}

module.exports = AdminController;