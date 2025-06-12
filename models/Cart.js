// models/Cart.js - Updated để hỗ trợ User Authentication

const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  // User reference - NEW
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null  // null cho guest users
  },
  
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    color: {
      type: String,
      default: 'default'
    },
    size: {
      type: String,
      default: 'M'
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
  }],
  
  // Pricing
  totalItems: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  finalTotal: {
    type: Number,
    default: 0
  },
  
  // Shipping
  shippingFee: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Cart expiry (for guest carts)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  }
});

// Indexes for performance
cartSchema.index({ sessionId: 1 });
cartSchema.index({ userId: 1 });
cartSchema.index({ sessionId: 1, userId: 1 });
cartSchema.index({ createdAt: -1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for guest carts

// Pre-save middleware
cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // If cart has userId, remove expiry
  if (this.userId) {
    this.expiresAt = undefined;
  }
  
  next();
});

// Instance Methods
cartSchema.methods.calculateTotals = function() {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalPrice = this.items.reduce((total, item) => total + item.subtotal, 0);
  
  // Calculate shipping (free over 500k VND)
  this.shippingFee = this.totalPrice >= 500000 ? 0 : 30000;
  
  // Apply discount if any
  const discountAmount = (this.totalPrice * this.discount) / 100;
  this.finalTotal = this.totalPrice + this.shippingFee - discountAmount;
  
  return this;
};

cartSchema.methods.addItem = function(productData) {
  const { productId, quantity = 1, color = 'default', size = 'M', price } = productData;
  
  // Find existing item with same product, color, size
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId.toString() &&
    item.color === color &&
    item.size === size
  );
  
  if (existingItemIndex > -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].subtotal = this.items[existingItemIndex].quantity * this.items[existingItemIndex].priceAtTime;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity: quantity,
      color: color,
      size: size,
      priceAtTime: price,
      subtotal: quantity * price,
      addedAt: new Date()
    });
  }
  
  this.calculateTotals();
  return this;
};

cartSchema.methods.removeItem = function(itemId) {
  this.items = this.items.filter(item => item._id.toString() !== itemId.toString());
  this.calculateTotals();
  return this;
};

cartSchema.methods.updateItemQuantity = function(itemId, newQuantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  
  if (item) {
    if (newQuantity <= 0) {
      return this.removeItem(itemId);
    }
    
    item.quantity = newQuantity;
    item.subtotal = item.quantity * item.priceAtTime;
    this.calculateTotals();
  }
  
  return this;
};

cartSchema.methods.clearCart = function() {
  this.items = [];
  this.calculateTotals();
  return this;
};

cartSchema.methods.isEmpty = function() {
  return this.items.length === 0 || this.totalItems === 0;
};

cartSchema.methods.getFormattedTotalPrice = function() {
  return this.totalPrice.toLocaleString('vi-VN') + '₫';
};

cartSchema.methods.getFormattedFinalTotal = function() {
  return this.finalTotal.toLocaleString('vi-VN') + '₫';
};

cartSchema.methods.getFormattedShippingFee = function() {
  return this.shippingFee === 0 ? 'Miễn phí' : this.shippingFee.toLocaleString('vi-VN') + '₫';
};

cartSchema.methods.hasProduct = function(productId) {
  return this.items.some(item => item.product.toString() === productId.toString());
};

cartSchema.methods.getItemCount = function(productId) {
  return this.items
    .filter(item => item.product.toString() === productId.toString())
    .reduce((total, item) => total + item.quantity, 0);
};

// NEW: Convert guest cart to user cart
cartSchema.methods.convertToUserCart = function(userId) {
  this.userId = userId;
  this.expiresAt = undefined; // Remove expiry for user carts
  return this;
};

// NEW: Check if cart belongs to user
cartSchema.methods.belongsToUser = function(userId) {
  return this.userId && this.userId.toString() === userId.toString();
};

// Static Methods
cartSchema.statics.findBySessionId = async function(sessionId, userId = null) {
  try {
    let cart;
    
    // First, try to find by userId if provided
    if (userId) {
      cart = await this.findOne({ userId: userId }).populate('items.product');
      if (cart) {
        // Update sessionId to current session
        cart.sessionId = sessionId;
        await cart.save();
        return cart;
      }
    }
    
    // Fallback to sessionId
    cart = await this.findOne({ sessionId: sessionId }).populate('items.product');
    
    if (!cart) {
      // Create new cart
      cart = new this({ 
        sessionId: sessionId,
        userId: userId || null
      });
      await cart.save();
    }
    
    return cart;
  } catch (error) {
    console.error('❌ Error finding cart:', error);
    // Return empty cart as fallback
    const fallbackCart = new this({ 
      sessionId: sessionId, 
      userId: userId || null 
    });
    return fallbackCart;
  }
};

// NEW: Find user's cart across all sessions
cartSchema.statics.findByUserId = async function(userId) {
  try {
    return await this.findOne({ userId: userId }).populate('items.product');
  } catch (error) {
    console.error('❌ Error finding user cart:', error);
    return null;
  }
};

// NEW: Merge two carts (for login scenarios)
cartSchema.statics.mergeCarts = async function(guestCart, userCart) {
  try {
    if (!guestCart || guestCart.isEmpty()) {
      return userCart;
    }
    
    if (!userCart) {
      // Convert guest cart to user cart
      return guestCart;
    }
    
    // Merge items from guest cart to user cart
    for (const guestItem of guestCart.items) {
      const existingItemIndex = userCart.items.findIndex(item => 
        item.product.toString() === guestItem.product.toString() &&
        item.color === guestItem.color &&
        item.size === guestItem.size
      );
      
      if (existingItemIndex > -1) {
        // Update existing item quantity
        userCart.items[existingItemIndex].quantity += guestItem.quantity;
        userCart.items[existingItemIndex].subtotal = 
          userCart.items[existingItemIndex].quantity * userCart.items[existingItemIndex].priceAtTime;
      } else {
        // Add new item
        userCart.items.push({
          product: guestItem.product,
          quantity: guestItem.quantity,
          color: guestItem.color,
          size: guestItem.size,
          priceAtTime: guestItem.priceAtTime,
          subtotal: guestItem.subtotal,
          addedAt: guestItem.addedAt
        });
      }
    }
    
    userCart.calculateTotals();
    await userCart.save();
    
    // Delete guest cart
    await guestCart.deleteOne();
    
    return userCart;
  } catch (error) {
    console.error('❌ Error merging carts:', error);
    return userCart || guestCart;
  }
};

// NEW: Clean up expired guest carts
cartSchema.statics.cleanupExpiredCarts = async function() {
  try {
    const result = await this.deleteMany({
      userId: null, // Only guest carts
      expiresAt: { $lt: new Date() }
    });
    
    if (result.deletedCount > 0) {
      console.log(`🧹 Cleaned up ${result.deletedCount} expired guest carts`);
    }
    
    return result.deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up expired carts:', error);
    return 0;
  }
};

// NEW: Get cart statistics
cartSchema.statics.getCartStats = async function() {
  try {
    const stats = await this.aggregate([
      {
        $group: {
          _id: null,
          totalCarts: { $sum: 1 },
          userCarts: { 
            $sum: { $cond: [{ $ne: ['$userId', null] }, 1, 0] }
          },
          guestCarts: { 
            $sum: { $cond: [{ $eq: ['$userId', null] }, 1, 0] }
          },
          totalItems: { $sum: '$totalItems' },
          totalValue: { $sum: '$finalTotal' },
          avgCartValue: { $avg: '$finalTotal' },
          avgItemsPerCart: { $avg: '$totalItems' }
        }
      }
    ]);
    
    return stats[0] || {
      totalCarts: 0,
      userCarts: 0,
      guestCarts: 0,
      totalItems: 0,
      totalValue: 0,
      avgCartValue: 0,
      avgItemsPerCart: 0
    };
  } catch (error) {
    console.error('❌ Error getting cart stats:', error);
    return null;
  }
};

// Virtual for checking if cart is from guest
cartSchema.virtual('isGuestCart').get(function() {
  return !this.userId;
});

// Virtual for checking if cart is from user
cartSchema.virtual('isUserCart').get(function() {
  return !!this.userId;
});

module.exports = mongoose.model('Cart', cartSchema);