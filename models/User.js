// models/User.js - Enhanced với Address Methods
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  firstName: {
    type: String,
    required: [true, 'Họ là bắt buộc'],
    trim: true,
    maxlength: [50, 'Họ không được quá 50 ký tự']
  },
  
  lastName: {
    type: String,
    required: [true, 'Tên là bắt buộc'],
    trim: true,
    maxlength: [50, 'Tên không được quá 50 ký tự']
  },
  
  email: {
    type: String,
    required: [true, 'Email là bắt buộc'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  },
  
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự']
  },
  
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10,11}$/, 'Số điện thoại không hợp lệ']
  },
  
  // Personal Info
  birthDate: {
    type: Date
  },
  
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },
  
  // Enhanced Address Schema
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'office', 'other'],
      default: 'home'
    },
    isDefault: {
      type: Boolean,
      default: false
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'Tên không được quá 100 ký tự']
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^[0-9\s\-\(\)]{10,15}$/, 'Số điện thoại không hợp lệ']
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, 'Địa chỉ không được quá 200 ký tự']
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      default: 'Hà Nội',
      trim: true
    },
    zipCode: {
      type: String,
      trim: true,
      default: ''
    },
    // Additional fields for better management
    notes: {
      type: String,
      maxlength: [500, 'Ghi chú không được quá 500 ký tự']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastUsed: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Account Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  isVerified: {
    type: Boolean,
    default: false
  },
  
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // Security
  lastLogin: {
    type: Date
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date
  },
  
  // Verification
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Preferences
  notifications: {
    email: {
      orders: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      newsletter: { type: Boolean, default: false }
    },
    sms: {
      orders: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false }
    }
  },
  
  // Shopping preferences
  favoriteProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // Statistics
  totalOrders: {
    type: Number,
    default: 0
  },
  
  totalSpent: {
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
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, role: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'addresses.isDefault': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for avatar initials
userSchema.virtual('initials').get(function() {
  return `${this.firstName.charAt(0)}${this.lastName.charAt(0)}`.toUpperCase();
});

// Virtual for display name (for views)
userSchema.virtual('displayName').get(function() {
  return this.fullName;
});

// Virtual for age
userSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const today = new Date();
  const birthDate = new Date(this.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Update timestamp
  this.updatedAt = Date.now();
  
  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || !this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1, loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = {
      lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
    };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// =====================================
// ENHANCED ADDRESS MANAGEMENT METHODS
// =====================================

/**
 * Thêm địa chỉ mới
 * @param {Object} addressData - Dữ liệu địa chỉ
 * @returns {Promise<Object>} - Địa chỉ vừa được thêm
 */
userSchema.methods.addAddress = async function(addressData) {
  try {
    // Validate required fields
    const requiredFields = ['fullName', 'phone', 'address', 'district'];
    for (const field of requiredFields) {
      if (!addressData[field] || !addressData[field].toString().trim()) {
        throw new Error(`${field} là bắt buộc`);
      }
    }

    // Validate phone number format
    const phoneRegex = /^(0|\+84)[3-9][0-9]{8}$/;
    const cleanPhone = addressData.phone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      throw new Error('Số điện thoại không hợp lệ');
    }

    // Prepare address data
    const newAddress = {
      type: addressData.type || 'home',
      fullName: addressData.fullName.trim(),
      phone: cleanPhone,
      address: addressData.address.trim(),
      district: addressData.district,
      city: addressData.city || 'Hà Nội',
      zipCode: addressData.zipCode ? addressData.zipCode.trim() : '',
      notes: addressData.notes ? addressData.notes.trim() : '',
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If this is the first address or explicitly set as default
    if (this.addresses.length === 0 || addressData.isDefault) {
      // Remove default from other addresses
      this.addresses.forEach(addr => {
        addr.isDefault = false;
      });
      newAddress.isDefault = true;
    }

    // Add the new address
    this.addresses.push(newAddress);
    await this.save();

    // Return the newly added address
    const addedAddress = this.addresses[this.addresses.length - 1];
    
    console.log('✅ Address added successfully:', {
      userId: this._id,
      addressId: addedAddress._id,
      type: addedAddress.type,
      isDefault: addedAddress.isDefault
    });

    return addedAddress;
  } catch (error) {
    console.error('❌ Error adding address:', error.message);
    throw error;
  }
};

/**
 * Cập nhật địa chỉ
 * @param {String} addressId - ID của địa chỉ
 * @param {Object} updateData - Dữ liệu cập nhật
 * @returns {Promise<Object|null>} - Địa chỉ đã được cập nhật hoặc null
 */
userSchema.methods.updateAddress = async function(addressId, updateData) {
  try {
    const address = this.addresses.id(addressId);
    if (!address) {
      throw new Error('Không tìm thấy địa chỉ');
    }

    // Validate phone if provided
    if (updateData.phone) {
      const phoneRegex = /^(0|\+84)[3-9][0-9]{8}$/;
      const cleanPhone = updateData.phone.replace(/[\s\-\(\)]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Số điện thoại không hợp lệ');
      }
      updateData.phone = cleanPhone;
    }

    // If setting as default, remove default from others
    if (updateData.isDefault === true) {
      this.addresses.forEach(addr => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    // Update allowed fields
    const allowedFields = [
      'type', 'fullName', 'phone', 'address', 
      'district', 'city', 'zipCode', 'notes', 'isDefault'
    ];
    
    allowedFields.forEach(field => {
      if (updateData.hasOwnProperty(field)) {
        if (typeof updateData[field] === 'string') {
          address[field] = updateData[field].trim();
        } else {
          address[field] = updateData[field];
        }
      }
    });

    // Update timestamp
    address.updatedAt = new Date();

    await this.save();

    console.log('✅ Address updated successfully:', {
      userId: this._id,
      addressId: addressId,
      isDefault: address.isDefault
    });

    return address;
  } catch (error) {
    console.error('❌ Error updating address:', error.message);
    throw error;
  }
};

/**
 * Xóa địa chỉ
 * @param {String} addressId - ID của địa chỉ
 * @returns {Promise<Boolean>} - true nếu xóa thành công
 */
userSchema.methods.removeAddress = async function(addressId) {
  try {
    const address = this.addresses.id(addressId);
    if (!address) {
      throw new Error('Không tìm thấy địa chỉ');
    }

    // Check if trying to delete the only address that is default
    if (address.isDefault && this.addresses.length > 1) {
      // Find another address to set as default
      const otherAddresses = this.addresses.filter(addr => 
        addr._id.toString() !== addressId && addr.isActive
      );
      
      if (otherAddresses.length > 0) {
        otherAddresses[0].isDefault = true;
      }
    }

    // Remove the address
    address.remove();
    await this.save();

    console.log('✅ Address removed successfully:', {
      userId: this._id,
      addressId: addressId,
      remainingAddresses: this.addresses.length
    });

    return true;
  } catch (error) {
    console.error('❌ Error removing address:', error.message);
    throw error;
  }
};

/**
 * Đặt địa chỉ mặc định
 * @param {String} addressId - ID của địa chỉ
 * @returns {Promise<Boolean>} - true nếu thành công
 */
userSchema.methods.setDefaultAddress = async function(addressId) {
  try {
    const address = this.addresses.id(addressId);
    if (!address) {
      throw new Error('Không tìm thấy địa chỉ');
    }

    // Remove default from all addresses
    this.addresses.forEach(addr => {
      addr.isDefault = false;
    });

    // Set the specified address as default
    address.isDefault = true;
    address.lastUsed = new Date();
    address.updatedAt = new Date();

    await this.save();

    console.log('✅ Default address set successfully:', {
      userId: this._id,
      addressId: addressId
    });

    return true;
  } catch (error) {
    console.error('❌ Error setting default address:', error.message);
    throw error;
  }
};

/**
 * Lấy địa chỉ mặc định
 * @returns {Object|null} - Địa chỉ mặc định hoặc null
 */
userSchema.methods.getDefaultAddress = function() {
  const activeAddresses = this.addresses.filter(addr => addr.isActive);
  return activeAddresses.find(addr => addr.isDefault) || activeAddresses[0] || null;
};

/**
 * Lấy địa chỉ theo ID
 * @param {String} addressId - ID của địa chỉ
 * @returns {Object|null} - Địa chỉ hoặc null
 */
userSchema.methods.getAddressById = function(addressId) {
  return this.addresses.id(addressId);
};

/**
 * Lấy tất cả địa chỉ đang hoạt động
 * @returns {Array} - Danh sách địa chỉ đang hoạt động
 */
userSchema.methods.getActiveAddresses = function() {
  return this.addresses
    .filter(addr => addr.isActive)
    .sort((a, b) => {
      // Sort by default first, then by creation date
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
};

/**
 * Validate address data
 * @param {Object} addressData - Dữ liệu địa chỉ
 * @returns {Object} - { isValid: Boolean, errors: Array }
 */
userSchema.methods.validateAddressData = function(addressData) {
  const errors = [];
  
  // Required fields
  const requiredFields = [
    { field: 'fullName', message: 'Họ và tên là bắt buộc' },
    { field: 'phone', message: 'Số điện thoại là bắt buộc' },
    { field: 'address', message: 'Địa chỉ chi tiết là bắt buộc' },
    { field: 'district', message: 'Quận/Huyện là bắt buộc' }
  ];

  requiredFields.forEach(({ field, message }) => {
    if (!addressData[field] || !addressData[field].toString().trim()) {
      errors.push(message);
    }
  });

  // Phone validation
  if (addressData.phone) {
    const phoneRegex = /^(0|\+84)[3-9][0-9]{8}$/;
    const cleanPhone = addressData.phone.replace(/[\s\-\(\)]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      errors.push('Số điện thoại không hợp lệ');
    }
  }

  // Length validations
  if (addressData.fullName && addressData.fullName.length > 100) {
    errors.push('Họ và tên không được quá 100 ký tự');
  }

  if (addressData.address && addressData.address.length > 200) {
    errors.push('Địa chỉ không được quá 200 ký tự');
  }

  if (addressData.notes && addressData.notes.length > 500) {
    errors.push('Ghi chú không được quá 500 ký tự');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

/**
 * Format address for display
 * @param {String} addressId - ID của địa chỉ
 * @returns {String} - Địa chỉ đã format
 */
userSchema.methods.formatAddress = function(addressId) {
  const address = this.getAddressById(addressId);
  if (!address) return '';
  
  return `${address.address}, ${address.district}, ${address.city}`;
};

/**
 * Get address statistics
 * @returns {Object} - Thống kê địa chỉ
 */
userSchema.methods.getAddressStats = function() {
  const addresses = this.addresses.filter(addr => addr.isActive);
  
  return {
    total: addresses.length,
    byType: {
      home: addresses.filter(addr => addr.type === 'home').length,
      office: addresses.filter(addr => addr.type === 'office').length,
      other: addresses.filter(addr => addr.type === 'other').length
    },
    hasDefault: addresses.some(addr => addr.isDefault),
    mostRecentlyUsed: addresses
      .filter(addr => addr.lastUsed)
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))[0] || null
  };
};

userSchema.methods.toPublicJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.passwordResetToken;
  delete user.loginAttempts;
  delete user.lockUntil;
  return user;
};

// Static methods
userSchema.statics.findByEmail = function(email, options = {}) {
  const query = { email: email.toLowerCase().trim() };
  
  // Chỉ lọc isActive nếu không phải admin
  if (!options.includeInactive) {
    query.isActive = true;
  }
  
  return this.findOne(query);
};

userSchema.statics.createUser = async function(userData) {
  const user = new this({
    ...userData,
    email: userData.email.toLowerCase().trim(),
    firstName: userData.firstName.trim(),
    lastName: userData.lastName.trim()
  });
  
  await user.save();
  return user;
};

userSchema.statics.getUserStats = async function(userId) {
  try {
    const user = await this.findById(userId).select('totalOrders totalSpent createdAt');
    const Order = mongoose.model('Order');
    
    const orderStats = await Order.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$pricing.finalTotal' },
          avgOrderValue: { $avg: '$pricing.finalTotal' }
        }
      }
    ]);
    
    return {
      ...user.toObject(),
      orderStats: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 }
    };
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
};

userSchema.statics.searchUsers = async function(searchTerm, options = {}) {
  const { page = 1, limit = 20, role = null } = options;
  const skip = (page - 1) * limit;
  
  const query = {
    $or: [
      { firstName: { $regex: searchTerm, $options: 'i' } },
      { lastName: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
      { phone: { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  if (role) {
    query.role = role;
  }
  
  const users = await this.find(query)
    .select('-password -emailVerificationToken -passwordResetToken')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  const total = await this.countDocuments(query);
  
  return {
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = mongoose.model('User', userSchema);