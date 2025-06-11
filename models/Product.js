const mongoose = require('mongoose');
const path = require('path');

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
  
  // 🖼️ HỖ TRỢ NHIỀU LOẠI IMAGE
  image: {
    type: String,
    required: [true, 'Hình ảnh sản phẩm là bắt buộc'],
    default: '📦' // Emoji fallback
  },
  
  // URL ảnh thực từ data folder
  imageUrl: {
    type: String,
    default: null // VD: '/assets/products/nike-shoes.jpg'
  },
  
  // Mảng các ảnh phụ
  images: [{
    url: String,
    alt: String,
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  
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
  
  // SEO fields
  slug: {
    type: String,
    unique: true,
    sparse: true
  },
  
  metaTitle: String,
  metaDescription: String,
  
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
  
  // Auto-generate slug if not provided
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  
  next();
});

// Virtual for formatted price
productSchema.virtual('formattedPrice').get(function() {
  return this.price.toLocaleString('vi-VN') + 'đ';
});

// 🖼️ INSTANCE METHODS FOR IMAGE HANDLING
productSchema.methods.getFormattedPrice = function() {
  return this.price.toLocaleString('vi-VN') + 'đ';
};

// Get main image (prioritize imageUrl over emoji)
productSchema.methods.getMainImage = function() {
  if (this.imageUrl) {
    return this.imageUrl;
  }
  
  // Check if main image exists in images array
  const mainImage = this.images.find(img => img.isMain);
  if (mainImage) {
    return mainImage.url;
  }
  
  // Fallback to first image or emoji
  return this.images.length > 0 ? this.images[0].url : this.image;
};

// Get all images
productSchema.methods.getAllImages = function() {
  const images = [];
  
  // Add main imageUrl if exists
  if (this.imageUrl) {
    images.push({
      url: this.imageUrl,
      alt: this.name,
      isMain: true
    });
  }
  
  // Add additional images
  this.images.forEach(img => {
    if (img.url !== this.imageUrl) { // Avoid duplicates
      images.push(img);
    }
  });
  
  return images;
};

// Check if product has real images (not just emoji)
productSchema.methods.hasRealImages = function() {
  return !!(this.imageUrl || this.images.length > 0);
};

// 🔍 STATIC METHODS
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

// 🏷️ HELPER METHODS FOR CATEGORIES AND BRANDS
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

// 🖼️ STATIC METHODS FOR IMAGE MANAGEMENT
productSchema.statics.updateProductImages = async function(productId, images) {
  try {
    const product = await this.findById(productId);
    if (!product) return null;
    
    // Update images array
    product.images = images.map(img => ({
      url: img.url,
      alt: img.alt || product.name,
      isMain: img.isMain || false
    }));
    
    // Set main imageUrl if specified
    const mainImage = images.find(img => img.isMain);
    if (mainImage) {
      product.imageUrl = mainImage.url;
    }
    
    await product.save();
    return product;
  } catch (error) {
    console.error('Error updating product images:', error);
    return null;
  }
};

// Get products without real images (for admin purposes)
productSchema.statics.getProductsWithoutImages = async function() {
  try {
    return await this.find({
      $and: [
        { inStock: true },
        {
          $or: [
            { imageUrl: { $exists: false } },
            { imageUrl: null },
            { imageUrl: '' },
            { 
              $and: [
                { images: { $size: 0 } },
                { imageUrl: { $exists: false } }
              ]
            }
          ]
        }
      ]
    });
  } catch (error) {
    console.error('Error getting products without images:', error);
    return [];
  }
};

// Bulk update images for products
productSchema.statics.bulkUpdateImages = async function(updates) {
  try {
    const results = [];
    for (const update of updates) {
      const { productId, imageUrl, images } = update;
      const result = await this.findByIdAndUpdate(
        productId,
        { 
          imageUrl: imageUrl,
          images: images || [],
          updatedAt: new Date()
        },
        { new: true }
      );
      results.push(result);
    }
    return results;
  } catch (error) {
    console.error('Error bulk updating images:', error);
    return [];
  }
};

// Indexes for better performance
productSchema.index({ name: 'text', description: 'text', brand: 'text' });
productSchema.index({ category: 1, inStock: 1 });
productSchema.index({ featured: 1, inStock: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ slug: 1 });
productSchema.index({ brand: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);