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
    max: [10, 'Số lượng không được quá 10']
  },
  
  color: {
    type: String,
    required: [true, 'Màu sắc là bắt buộc'],
    enum: ['Đỏ', 'Xanh dương', 'Xanh nhạt', 'Xanh lá', 'Vàng', 'Hồng', 'Đen', 'Trắng']
  },
  
  size: {
    type: String,
    required: [true, 'Kích cỡ là bắt buộc'],
    enum: ['S', 'M', 'L', 'XL', 'XXL', '39', '40', '41', '42', '43', '44']
  },
  
  priceAtTime: {
    type: Number,
    required: true
  },
  
  subtotal: {
    type: Number,
    required: true
  },
  
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const cartSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    // Bỏ index: true để tránh duplicate với schema.index()
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

// Instance methods
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
    
    // Check if item with same product, color, size already exists
    const existingItemIndex = this.items.findIndex(item => 
      item.product.toString() === productId.toString() && 
      item.color === color && 
      item.size === size
    );
    
    if (existingItemIndex >= 0) {
      // Update existing item
      this.items[existingItemIndex].quantity += quantity;
      this.items[existingItemIndex].subtotal = 
        this.items[existingItemIndex].quantity * this.items[existingItemIndex].priceAtTime;
    } else {
      // Add new item
      const newItem = {
        product: productId,
        quantity: quantity,
        color: color,
        size: size,
        priceAtTime: product.price,
        subtotal: product.price * quantity
      };
      this.items.push(newItem);
    }
    
    this.calculateTotals();
    await this.save();
    return this;
    
  } catch (error) {
    throw error;
  }
};

cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  this.calculateTotals();
  return this;
};

cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (item) {
    item.quantity = quantity;
    item.subtotal = item.priceAtTime * quantity;
    this.calculateTotals();
  }
  return this;
};

cartSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
  this.totalPrice = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  // Calculate shipping fee (free shipping over 1M VND)
  this.shippingFee = this.totalPrice >= 1000000 ? 0 : 50000;
  this.finalTotal = this.totalPrice + this.shippingFee;
};

cartSchema.methods.clear = function() {
  this.items = [];
  this.totalItems = 0;
  this.totalPrice = 0;
  this.shippingFee = 0;
  this.finalTotal = 0;
  return this;
};

cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

cartSchema.methods.getFormattedTotal = function() {
  return this.totalPrice.toLocaleString('vi-VN') + 'đ';
};

cartSchema.methods.getFormattedFinalTotal = function() {
  return this.finalTotal.toLocaleString('vi-VN') + 'đ';
};

cartSchema.methods.getFormattedShippingFee = function() {
  return this.shippingFee.toLocaleString('vi-VN') + 'đ';
};

// Static methods với error handling cải tiến
cartSchema.statics.findBySessionId = async function(sessionId) {
  try {
    console.log(`🔍 Finding cart for session: ${sessionId}`);
    
    let cart = await this.findOne({ sessionId: sessionId })
                       .populate('items.product')
                       .maxTimeMS(5000); // Giới hạn thời gian query 5s
    
    if (!cart) {
      console.log(`📦 Creating new cart for session: ${sessionId}`);
      // Create new cart for session
      cart = new this({ sessionId: sessionId });
      await cart.save();
    }
    
    console.log(`✅ Cart found/created: ${cart.items.length} items, ${cart.totalItems} total`);
    return cart;
  } catch (error) {
    console.error('❌ Error finding cart by session:', error.message);
    
    // Fallback: return empty cart object
    console.log(`🔄 Creating fallback cart for session: ${sessionId}`);
    const fallbackCart = new this({ sessionId: sessionId });
    return fallbackCart;
  }
};

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

// Indexes - chỉ định rõ ràng để tránh duplicate
cartSchema.index({ sessionId: 1 }, { unique: true });
cartSchema.index({ userId: 1 });
cartSchema.index({ status: 1, updatedAt: 1 });
cartSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Cart', cartSchema);