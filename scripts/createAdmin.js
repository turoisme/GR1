const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  try {
    // Kết nối database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Kết nối database thành công');

    // Thông tin admin
    const adminData = {
      firstName: 'Admin',
      lastName: 'SportShop',
      email: 'admin@sportshop.com', // Email
      password: 'admin123', // Mật Khẩu
      phone: '0866387718',
      role: 'admin',
      isActive: true,
      isVerified: true,
      birthDate: new Date('1990-01-01'),
      gender: 'male'
    };

    // Kiểm tra admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('⚠️ Admin đã tồn tại:', existingAdmin.email);
      process.exit(0);
    }

    // Tạo admin user
    const admin = new User(adminData);
    await admin.save();

    console.log('🎉 Tạo admin thành công!');
    console.log('📧 Email:', adminData.email);
    console.log('🔑 Password:', adminData.password);
    console.log('⚡ Role:', adminData.role);

  } catch (error) {
    console.error('❌ Lỗi tạo admin:', error);
  } finally {
    mongoose.disconnect();
    console.log('🔌 Đóng kết nối database');
  }
};

// Chạy script
createAdmin();