/**
 * Order Model - MongoDB Order Management
 * Quản lý đơn hàng với MongoDB - Updated với Revenue Tracking
 */

const mongoose = require('mongoose');

// Order Item Schema
const OrderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    default: '/images/products/default.jpg'
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  color: {
    type: String,
    default: 'Mặc định'
  },
  size: {
    type: String,
    default: 'Mặc định'
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  }
});

// Main Order Schema
const OrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipping', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'bank_transfer', 'momo', 'vnpay'],
    default: 'cod'
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    }
  },
  shipping: {
    address: {
      type: String,
      required: true
    },
    ward: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: true
    },
    city: {
      type: String,
      default: 'Hà Nội'
    }
  },
  items: [OrderItemSchema],
  totalItems: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  shippingFee: {
    type: Number,
    default: 30000,
    min: 0
  },
  finalTotal: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    default: ''
  },
  estimatedDelivery: {
    type: Date,
    required: true
  },
  actualDelivery: {
    type: Date,
    default: null
  },
  trackingNumber: {
    type: String,
    default: null
  },
  cancelReason: {
    type: String,
    default: null
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  
  // ✨ NEW FIELDS FOR REVENUE TRACKING
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  deliveredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  confirmedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  shippedAt: {
    type: Date,
    default: null
  },
  shippedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  revenueRecorded: {
    type: Boolean,
    default: false
  },
  trackingCode: {
    type: String,
    default: null
  },
  
  // Order History for tracking status changes
  orderHistory: [{
    status: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: {
      type: String,
      default: ''
    },
    updatedBy: {
      type: String,
      enum: ['system', 'admin', 'user'],
      default: 'system'
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    adminName: {
      type: String,
      default: null
    }
  }]
}, {
  timestamps: true,
  collection: 'orders'
});

// Indexes for better performance
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ sessionId: 1, createdAt: -1 });
OrderSchema.index({ deliveredAt: -1 }); // ✨ NEW: For revenue queries
OrderSchema.index({ isCompleted: 1, status: 1 }); // ✨ NEW: For revenue queries

// Virtual for formatted total
OrderSchema.virtual('formattedTotal').get(function() {
  return this.finalTotal.toLocaleString('vi-VN') + 'đ';
});

// Virtual for formatted date
OrderSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('vi-VN');
});

// Virtual for status display
OrderSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    'pending': { text: 'Chờ xử lý', icon: '⏳', class: 'pending' },
    'confirmed': { text: 'Đã xác nhận', icon: '✅', class: 'confirmed' },
    'shipping': { text: 'Đang giao', icon: '🚚', class: 'shipping' },
    'delivered': { text: 'Đã giao', icon: '📦', class: 'delivered' },
    'cancelled': { text: 'Đã hủy', icon: '❌', class: 'cancelled' }
  };
  return statusMap[this.status] || statusMap['pending'];
});

// Virtual for full address
OrderSchema.virtual('fullAddress').get(function() {
  return `${this.shipping.address}, ${this.shipping.ward}, ${this.shipping.district}, ${this.shipping.city}`;
});

// Static methods
OrderSchema.statics = {
  /**
   * Find orders by user ID or session ID
   */
  async findByUser(userId, sessionId) {
    const query = {};
    if (userId) {
      query.userId = userId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    } else {
      return [];
    }
    
    return await this.find(query)
      .populate('items.productId', 'name images price')
      .sort({ createdAt: -1 });
  },

  /**
   * Find order by order ID
   */
  async findByOrderId(orderId) {
    return await this.findOne({ orderId })
      .populate('items.productId', 'name images price description');
  },

  /**
   * Create new order
   */
  async createOrder(orderData) {
    try {
      const order = new this(orderData);
      
      // Initialize order history
      if (!order.orderHistory) {
        order.orderHistory = [];
      }
      
      order.orderHistory.push({
        status: 'pending',
        timestamp: new Date(),
        note: 'Đơn hàng được tạo',
        updatedBy: 'system'
      });
      
      await order.save();
      
      console.log('✅ Order saved to database:', {
        orderId: order.orderId,
        total: order.finalTotal,
        items: order.totalItems
      });
      
      return order;
    } catch (error) {
      console.error('❌ Error creating order:', error);
      throw error;
    }
  },

  /**
   * Update order status with revenue tracking
   */
  async updateStatus(orderId, status, updateData = {}) {
    try {
      const updateFields = { status, ...updateData };
      
      // Handle status-specific updates
      switch (status) {
        case 'delivered':
          if (!updateFields.actualDelivery) {
            updateFields.actualDelivery = new Date();
          }
          if (!updateFields.deliveredAt) {
            updateFields.deliveredAt = new Date();
          }
          updateFields.isCompleted = true;
          updateFields.completedAt = new Date();
          updateFields.paymentStatus = 'paid';
          break;
          
        case 'cancelled':
          updateFields.isCompleted = false;
          updateFields.revenueRecorded = false;
          if (!updateFields.cancelledAt) {
            updateFields.cancelledAt = new Date();
          }
          break;
          
        case 'confirmed': 
          if (!updateFields.confirmedAt) {
            updateFields.confirmedAt = new Date();
          }
          break;
          
        case 'shipping':
          if (!updateFields.shippedAt) {
            updateFields.shippedAt = new Date();
          }
          break;
      }
      
      const order = await this.findOneAndUpdate(
        { orderId },
        updateFields,
        { new: true }
      );
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      console.log('✅ Order status updated:', {
        orderId: order.orderId,
        status: order.status,
        isCompleted: order.isCompleted
      });
      
      return order;
    } catch (error) {
      console.error('❌ Error updating order status:', error);
      throw error;
    }
  },

  /**
   * Get orders with pagination and filters
   */
  async getOrdersWithPagination(userId, sessionId, options = {}) {
    const {
      page = 1,
      limit = 10,
      status = null,
      sortBy = 'createdAt',
      sortOrder = -1
    } = options;
    
    const query = {};
    if (userId) {
      query.userId = userId;
    } else if (sessionId) {
      query.sessionId = sessionId;
    }
    
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder };
    
    const [orders, totalCount] = await Promise.all([
      this.find(query)
        .populate('items.productId', 'name images price')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.countDocuments(query)
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      orders,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null
      }
    };
  },

  /**
   * ✨ NEW: Get revenue statistics
   */
  async getRevenueStats(period = 'all') {
    try {
      const matchCondition = { 
        status: 'delivered', 
        isCompleted: true 
      };
      
      // Add date filter based on period
      if (period !== 'all') {
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
        }
        
        if (startDate) {
          matchCondition.deliveredAt = { $gte: startDate };
        }
      }
      
      const result = await this.aggregate([
        { $match: matchCondition },
        { 
          $group: { 
            _id: null, 
            totalRevenue: { $sum: '$finalTotal' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$finalTotal' }
          } 
        }
      ]);
      
      return result[0] || { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };
      
    } catch (error) {
      console.error('❌ Error getting revenue stats:', error);
      return { totalRevenue: 0, orderCount: 0, avgOrderValue: 0 };
    }
  }
};

// Instance methods
OrderSchema.methods = {
  /**
   * Cancel order
   */
  async cancel(reason = 'Customer request') {
    if (this.status === 'delivered') {
      throw new Error('Cannot cancel delivered order');
    }
    
    if (this.status === 'cancelled') {
      throw new Error('Order already cancelled');
    }
    
    this.status = 'cancelled';
    this.cancelReason = reason;
    this.cancelledAt = new Date();
    this.isCompleted = false;
    this.revenueRecorded = false;
    
    // Add to history
    this.orderHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      note: reason,
      updatedBy: 'system'
    });
    
    await this.save();
    
    console.log('✅ Order cancelled:', {
      orderId: this.orderId,
      reason: reason
    });
    
    return this;
  },

  /**
   * Mark as delivered with revenue tracking
   */
  async markDelivered() {
    this.status = 'delivered';
    this.actualDelivery = new Date();
    this.deliveredAt = new Date();
    this.paymentStatus = 'paid';
    this.isCompleted = true;
    this.completedAt = new Date();
    
    // Add to history
    this.orderHistory.push({
      status: 'delivered',
      timestamp: new Date(),
      note: 'Đơn hàng đã được giao thành công',
      updatedBy: 'system'
    });
    
    await this.save();
    
    console.log('✅ Order delivered:', {
      orderId: this.orderId,
      deliveredAt: this.actualDelivery,
      revenue: this.finalTotal
    });
    
    return this;
  },

  /**
   * Get order summary for display
   */
  getSummary() {
    return {
      orderId: this.orderId,
      status: this.statusDisplay,
      customer: this.customer.name,
      totalItems: this.totalItems,
      total: this.formattedTotal,
      createdAt: this.formattedDate,
      estimatedDelivery: this.estimatedDelivery.toLocaleDateString('vi-VN'),
      paymentMethod: this.paymentMethod,
      address: this.fullAddress,
      isCompleted: this.isCompleted,
      revenueRecorded: this.revenueRecorded
    };
  }
};

module.exports = mongoose.model('Order', OrderSchema);