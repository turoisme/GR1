const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên sản phẩm là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên sản phẩm không được quá 100 ký tự']
  },
  
  price: {
    type: Number,
    required: [true, 'Giá sản phẩm là bắt buộc'],
    min: [0, 'Giá không được âm']
  },
  
  image: {
    type: String,
    required: [true, 'Hình ảnh sản phẩm là bắt buộc'],
    default: '📦'
  },
  
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được quá 500 ký tự']
  },
  
  category: {
    type: String,
    required: [true, 'Danh mục là bắt buộc'],
    enum: ['shoes', 'tops', 'bottoms', 'accessories'],
    default: 'tops'
  },
  
  brand: {
    type: String,
    required: [true, 'Thương hiệu là bắt buộc'],
    enum: ['Nike', 'Adidas', 'Under Armour', 'Puma', 'Other'],
    default: 'Nike'
  },
  
  colors: [{
    type: String,
    enum: ['Đỏ', 'Xanh dương', 'Xanh nhạt', 'Xanh lá', 'Vàng', 'Hồng', 'Đen', 'Trắng']
  }],
  
  sizes: [{
    type: String,
    enum: ['S', 'M', 'L', 'XL', 'XXL', '39', '40', '41', '42', '43', '44']
  }],
  
  inStock: {
    type: Boolean,
    default: true
  },
  
  featured: {
    type: Boolean,
    default: false
  },
  
  stockQuantity: {
    type: Number,
    default: 100,
    min: [0, 'Số lượng không được âm']
  },
  
  tags: [String],
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update updatedAt before saving
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for formatted price
productSchema.virtual('formattedPrice').get(function() {
  return this.price.toLocaleString('vi-VN') + 'đ';
});

// Instance method
productSchema.methods.getFormattedPrice = function() {
  return this.price.toLocaleString('vi-VN') + 'đ';
};

// Static methods
productSchema.statics.getFeaturedProducts = async function(limit = 6) {
  try {
    return await this.find({ featured: true, inStock: true })
                    .limit(limit)
                    .sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error getting featured products:', error);
    return [];
  }
};

productSchema.statics.getProductsByCategory = async function(category, limit = null) {
  try {
    let query = this.find({ category: category, inStock: true });
    if (limit) query = query.limit(limit);
    return await query.sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error getting products by category:', error);
    return [];
  }
};

productSchema.statics.searchProducts = async function(searchTerm) {
  try {
    return await this.find({
      $and: [
        { inStock: true },
        {
          $or: [
            { name: { $regex: searchTerm, $options: 'i' } },
            { brand: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { tags: { $in: [new RegExp(searchTerm, 'i')] } }
          ]
        }
      ]
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error searching products:', error);
    return [];
  }
};

productSchema.statics.getCategories = function() {
  return [
    { id: 'shoes', name: 'Giày dép', icon: '👟' },
    { id: 'tops', name: 'Áo', icon: '👕' },
    { id: 'bottoms', name: 'Quần', icon: '👖' },
    { id: 'accessories', name: 'Phụ kiện', icon: '🧢' }
  ];
};

productSchema.statics.getBrands = function() {
  return ['Nike', 'Adidas', 'Under Armour', 'Puma'];
};

// Indexes for better performance
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ featured: 1, inStock: 1 });
productSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Product', productSchema);