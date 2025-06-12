// models/Cart.js - Updated để hỗ trợ color và size
const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Số lượng phải ít nhất là 1'],
    max: [10, 'Số lượng không được quá 10'],
    default: 1
  },
  
  color: {
    type: String,
    required: [true, 'Màu sắc là bắt buộc'],
    trim: true
  },
  
  size: {
    type: String,
    required: [true, 'Kích cỡ là bắt buộc'],
    trim: true
  },
  
  priceAtTime: {
    type: Number,
    required: true,
    min: [0, 'Giá không được âm']
  },
  
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal không được âm']
  },
  
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  items: [cartItemSchema],
  
  totalItems: {
    type: Number,
    default: 0,
    min: [0, 'Tổng số items không được âm']
  },
  
  totalPrice: {
    type: Number,
    default: 0,
    min: [0, 'Tổng giá không được âm']
  },
  
  shippingFee: {
    type: Number,
    default: 0
  },
  
  finalTotal: {
    type: Number,
    default: 0
  },
  
  status: {
    type: String,
    enum: ['active', 'checked_out', 'abandoned'],
    default: 'active'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
});

// Middleware to update totals and timestamps
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  this.calculateTotals();
  next();
});

// =============================================
// INSTANCE METHODS
// =============================================

/**
 * Thêm sản phẩm vào giỏ hàng với color và size
 */
cartSchema.methods.addItem = async function(productId, quantity, color, size) {
  try {
    const Product = mongoose.model('Product');
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new Error('Sản phẩm không tồn tại');
    }
    
    if (!product.inStock) {
      throw new Error('Sản phẩm đã hết hàng');
    }
    
    // Tìm item có cùng productId, color và size
    const existingItemIndex = this.items.findIndex(item => 
      item.product.toString() === productId.toString() &&
      item.color === color &&
      item.size === size
    );
    
    if (existingItemIndex >= 0) {
      // Nếu item đã tồn tại với cùng color/size, cập nhật quantity
      const existingItem = this.items[existingItemIndex];
      existingItem.quantity += quantity;
      existingItem.subtotal = existingItem.quantity * existingItem.priceAtTime;
      
      console.log('📦 Updated existing cart item:', {
        productId: productId,
        color: color,
        size: size,
        oldQuantity: existingItem.quantity - quantity,
        newQuantity: existingItem.quantity
      });
    } else {
      // Nếu chưa có, tạo item mới
      const newItem = {
        product: productId,
        quantity: quantity,
        color: color,
        size: size,
        priceAtTime: product.price,
        subtotal: product.price * quantity
      };
      
      this.items.push(newItem);
      
      console.log('🆕 Added new cart item:', {
        productId: productId,
        color: color,
        size: size,
        quantity: quantity,
        price: product.price
      });
    }
    
    // Cập nhật totals
    this.calculateTotals();
    
    // Lưu vào database
    await this.save();
    
    return this;
  } catch (error) {
    console.error('Cart addItem error:', error);
    throw error;
  }
};

/**
 * Xóa item khỏi giỏ hàng
 */
cartSchema.methods.removeItem = function(itemId) {
  const initialLength = this.items.length;
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  
  if (this.items.length < initialLength) {
    console.log('🗑️ Removed cart item:', itemId);
    this.calculateTotals();
  }
  
  return this;
};

/**
 * Cập nhật số lượng của item
 */
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  
  if (item) {
    const oldQuantity = item.quantity;
    item.quantity = quantity;
    item.subtotal = item.priceAtTime * quantity;
    
    console.log('🔄 Updated item quantity:', {
      itemId: itemId,
      oldQuantity: oldQuantity,
      newQuantity: quantity
    });
    
    this.calculateTotals();
  }
  
  return this;
};

/**
 * Tính toán tổng giá trị giỏ hàng
 */
cartSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalPrice = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Tính phí ship (miễn phí cho đơn từ 1M VND)
  this.shippingFee = this.totalPrice >= 1000000 ? 0 : 50000;
  this.finalTotal = this.totalPrice + this.shippingFee;
  
  return this;
};

/**
 * Xóa tất cả items trong giỏ hàng
 */
cartSchema.methods.clear = function() {
  this.items = [];
  this.calculateTotals();
  console.log('🧹 Cart cleared');
  return this;
};

/**
 * Kiểm tra giỏ hàng có trống không
 */
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

/**
 * Format giá tiền
 */
cartSchema.methods.getFormattedTotal = function() {
  return this.totalPrice.toLocaleString('vi-VN') + 'đ';
};

cartSchema.methods.getFormattedFinalTotal = function() {
  return this.finalTotal.toLocaleString('vi-VN') + 'đ';
};

cartSchema.methods.getFormattedShippingFee = function() {
  return this.shippingFee.toLocaleString('vi-VN') + 'đ';
};

// =============================================
// STATIC METHODS
// =============================================

/**
 * Tìm hoặc tạo cart theo sessionId và userId
 */
cartSchema.statics.findBySessionId = async function(sessionId, userId = null) {
  try {
    console.log(`🔍 Finding cart for session: ${sessionId}, user: ${userId}`);
    
    let cart = await this.findOne({ sessionId: sessionId })
                       .populate('items.product')
                       .maxTimeMS(5000); // Giới hạn thời gian query 5s
    
    if (!cart) {
      console.log(`📦 Creating new cart for session: ${sessionId}`);
      // Tạo cart mới
      cart = new this({ 
        sessionId: sessionId,
        userId: userId
      });
      await cart.save();
    } else if (userId && !cart.userId) {
      // Cập nhật userId nếu user vừa đăng nhập
      cart.userId = userId;
      await cart.save();
      console.log(`👤 Updated cart with userId: ${userId}`);
    }
    
    console.log(`✅ Cart found/created: ${cart.items.length} items, ${cart.totalItems} total`);
    return cart;
  } catch (error) {
    console.error('❌ Error finding cart by session:', error.message);
    
    // Fallback: trả về cart rỗng
    console.log(`🔄 Creating fallback cart for session: ${sessionId}`);
    const fallbackCart = new this({ 
      sessionId: sessionId,
      userId: userId
    });
    return fallbackCart;
  }
};

/**
 * Dọn dẹp cart cũ
 */
cartSchema.statics.cleanupExpiredCarts = async function() {
  try {
    const result = await this.deleteMany({
      status: 'active',
      updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired carts`);
    }
    
    return result;
  } catch (error) {
    console.error('Error cleaning up carts:', error);
  }
};

/**
 * Merge guest cart với user cart khi đăng nhập
 */
cartSchema.statics.mergeGuestCart = async function(guestSessionId, userSessionId, userId) {
  try {
    const guestCart = await this.findOne({ sessionId: guestSessionId });
    const userCart = await this.findBySessionId(userSessionId, userId);
    
    if (guestCart && !guestCart.isEmpty()) {
      // Merge items from guest cart to user cart
      for (const guestItem of guestCart.items) {
        await userCart.addItem(
          guestItem.product,
          guestItem.quantity,
          guestItem.color,
          guestItem.size
        );
      }
      
      // Delete guest cart
      await guestCart.deleteOne();
      console.log(`🔄 Merged guest cart ${guestSessionId} into user cart ${userSessionId}`);
    }
    
    return userCart;
  } catch (error) {
    console.error('Error merging guest cart:', error);
    throw error;
  }
};

// =============================================
// INDEXES
// =============================================
cartSchema.index({ sessionId: 1 }, { unique: true });
cartSchema.index({ userId: 1 });
cartSchema.index({ status: 1, updatedAt: 1 });
cartSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Cart', cartSchema);