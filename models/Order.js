/**
 * Order Model - MongoDB Order Management
 * Quản lý đơn hàng với MongoDB
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
  }
}, {
  timestamps: true,
  collection: 'orders'
});

// Indexes for better performance
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ sessionId: 1, createdAt: -1 });

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
   * Update order status
   */
  async updateStatus(orderId, status, updateData = {}) {
    try {
      const updateFields = { status, ...updateData };
      
      // Set delivery date if status is delivered
      if (status === 'delivered' && !updateFields.actualDelivery) {
        updateFields.actualDelivery = new Date();
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
        status: order.status
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
    
    await this.save();
    
    console.log('✅ Order cancelled:', {
      orderId: this.orderId,
      reason: reason
    });
    
    return this;
  },

  /**
   * Mark as delivered
   */
  async markDelivered() {
    this.status = 'delivered';
    this.actualDelivery = new Date();
    this.paymentStatus = 'paid';
    
    await this.save();
    
    console.log('✅ Order delivered:', {
      orderId: this.orderId,
      deliveredAt: this.actualDelivery
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
      address: this.fullAddress
    };
  }
};

module.exports = mongoose.model('Order', OrderSchema);