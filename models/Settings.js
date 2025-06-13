// models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'shop-info',
      'brand-colors', 
      'contact',
      'map',
      'social',
      'system',
      'advanced'
    ]
  },
  
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  version: {
    type: Number,
    default: 1
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
}, {
  timestamps: true
});

// Indexes
settingsSchema.index({ type: 1 });
settingsSchema.index({ updatedAt: -1 });

// Static methods
settingsSchema.statics.getSetting = async function(type) {
  try {
    const setting = await this.findOne({ type });
    return setting ? setting.data : null;
  } catch (error) {
    console.error(`Error getting ${type} setting:`, error);
    return null;
  }
};

settingsSchema.statics.setSetting = async function(type, data, userId) {
  try {
    const setting = await this.findOneAndUpdate(
      { type },
      { 
        data,
        updatedBy: userId,
        updatedAt: new Date(),
        $inc: { version: 1 }
      },
      { 
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
    
    if (!setting.createdBy) {
      setting.createdBy = userId;
      await setting.save();
    }
    
    return setting;
  } catch (error) {
    console.error(`Error setting ${type} setting:`, error);
    throw error;
  }
};

settingsSchema.statics.getAllSettings = async function() {
  try {
    const settings = await this.find({}).sort({ type: 1 });
    const result = {};
    
    settings.forEach(setting => {
      result[setting.type] = setting.data;
    });
    
    return result;
  } catch (error) {
    console.error('Error getting all settings:', error);
    return {};
  }
};

settingsSchema.statics.getDefaultSettings = function() {
  return {
    'shop-info': {
      name: 'SportShop',
      slogan: 'Thể thao - Phong cách - Chất lượng',
      description: 'SportShop là cửa hàng thể thao hàng đầu, chuyên cung cấp các sản phẩm thể thao chất lượng cao từ những thương hiệu uy tín trên thế giới.',
      logo: null
    },
    'brand-colors': {
      primary: '#667eea',
      secondary: '#764ba2',
      accent: '#28a745',
      darkMode: false
    },
    'contact': {
      email: 'contact@sportshop.com',
      phone: '0866387718',
      hotline: '1900-1234',
      address: '123 Đường ABC, Phường XYZ, Quận 1, TP.HCM',
      workingHours: '8:00 - 22:00',
      workingDays: 'Thứ 2 - Chủ nhật'
    },
    'map': {
      latitude: 10.7769,
      longitude: 106.7009,
      embed: null
    },
    'social': {
      facebook: '',
      instagram: '',
      youtube: '',
      tiktok: '',
      twitter: '',
      linkedin: '',
      zalo: ''
    },
    'system': {
      siteName: 'SportShop - Thể thao chuyên nghiệp',
      metaDescription: 'SportShop - Cửa hàng thể thao chuyên nghiệp với đầy đủ các sản phẩm từ giày dép, quần áo đến phụ kiện thể thao chất lượng cao.',
      keywords: 'thể thao, giày thể thao, quần áo thể thao, phụ kiện thể thao',
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      language: 'vi'
    },
    'advanced': {
      maintenanceMode: false,
      allowRegistration: true,
      requireEmailVerification: true,
      maxLoginAttempts: 5,
      sessionTimeout: 1440
    }
  };
};

settingsSchema.statics.initializeDefaults = async function() {
  try {
    const defaults = this.getDefaultSettings();
    const existingSettings = await this.find({}).select('type');
    const existingTypes = existingSettings.map(s => s.type);
    
    const promises = [];
    
    for (const [type, data] of Object.entries(defaults)) {
      if (!existingTypes.includes(type)) {
        promises.push(
          this.create({
            type,
            data,
            version: 1
          })
        );
      }
    }
    
    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`✅ Initialized ${promises.length} default settings`);
    }
    
  } catch (error) {
    console.error('Error initializing default settings:', error);
  }
};

// Instance methods
settingsSchema.methods.backup = function() {
  return {
    type: this.type,
    data: this.data,
    version: this.version,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

settingsSchema.methods.restore = async function(backupData, userId) {
  this.data = backupData.data;
  this.updatedBy = userId;
  this.updatedAt = new Date();
  this.version += 1;
  
  return await this.save();
};

// Pre-save middleware
settingsSchema.pre('save', function(next) {
  if (this.isModified('data')) {
    this.updatedAt = new Date();
  }
  next();
});

// Virtual for formatted update time
settingsSchema.virtual('formattedUpdatedAt').get(function() {
  return this.updatedAt.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

module.exports = mongoose.model('Settings', settingsSchema);