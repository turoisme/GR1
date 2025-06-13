// fix-existing-orders.js - Script để cập nhật các đơn hàng hiện tại
require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('./models/Order');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const fixExistingOrders = async () => {
  try {
    console.log('🔧 Starting to fix existing orders...\n');
    
    // 1. Kiểm tra số lượng đơn hàng hiện tại
    const totalOrders = await Order.countDocuments();
    console.log(`📊 Total orders in database: ${totalOrders}`);
    
    // 2. Kiểm tra đơn hàng theo trạng thái
    const statusCounts = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    console.log('\n📋 Orders by status:');
    statusCounts.forEach(item => {
      console.log(`   ${item._id}: ${item.count} orders`);
    });
    
    // 3. Tìm các đơn hàng "delivered" nhưng chưa có isCompleted = true
    const deliveredOrders = await Order.find({ 
      status: 'delivered',
      $or: [
        { isCompleted: { $ne: true } },
        { isCompleted: { $exists: false } }
      ]
    });
    
    console.log(`\n🔄 Found ${deliveredOrders.length} delivered orders to fix`);
    
    if (deliveredOrders.length > 0) {
      // 4. Cập nhật từng đơn hàng
      for (let i = 0; i < deliveredOrders.length; i++) {
        const order = deliveredOrders[i];
        
        console.log(`\n${i + 1}. Fixing order: ${order.orderId}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Total: ${order.finalTotal?.toLocaleString('vi-VN')}đ`);
        console.log(`   Created: ${order.createdAt}`);
        
        // Cập nhật các field cần thiết
        const updateData = {
          isCompleted: true,
          completedAt: order.actualDelivery || order.updatedAt || new Date(),
          deliveredAt: order.actualDelivery || order.updatedAt || new Date(),
          revenueRecorded: true
        };
        
        // Nếu chưa có order history, tạo mới
        if (!order.orderHistory || order.orderHistory.length === 0) {
          updateData.orderHistory = [
            {
              status: 'pending',
              timestamp: order.createdAt,
              note: 'Đơn hàng được tạo',
              updatedBy: 'system'
            },
            {
              status: 'delivered',
              timestamp: order.actualDelivery || order.updatedAt || new Date(),
              note: 'Đơn hàng đã giao (cập nhật từ script)',
              updatedBy: 'system'
            }
          ];
        }
        
        await Order.findByIdAndUpdate(order._id, updateData);
        console.log(`   ✅ Updated successfully`);
      }
      
      console.log(`\n🎉 Fixed ${deliveredOrders.length} delivered orders!`);
    }
    
    // 5. Kiểm tra lại sau khi cập nhật
    const revenueStats = await Order.aggregate([
      { 
        $match: { 
          status: 'delivered', 
          isCompleted: true 
        } 
      },
      { 
        $group: { 
          _id: null, 
          totalRevenue: { $sum: '$finalTotal' },
          orderCount: { $sum: 1 }
        } 
      }
    ]);
    
    const stats = revenueStats[0] || { totalRevenue: 0, orderCount: 0 };
    
    console.log('\n💰 Revenue Statistics After Fix:');
    console.log(`   Orders counted for revenue: ${stats.orderCount}`);
    console.log(`   Total revenue: ${stats.totalRevenue.toLocaleString('vi-VN')}đ`);
    console.log(`   Average order value: ${stats.orderCount > 0 ? (stats.totalRevenue / stats.orderCount).toLocaleString('vi-VN') : '0'}đ`);
    
    // 6. Test query giống như trong admin controller
    console.log('\n🧪 Testing admin controller query:');
    const adminQuery = await Order.aggregate([
      { $match: { status: 'delivered', isCompleted: true } },
      { $group: { _id: null, total: { $sum: '$finalTotal' } } }
    ]);
    
    const adminResult = adminQuery[0]?.total || 0;
    console.log(`   Admin query result: ${adminResult.toLocaleString('vi-VN')}đ`);
    
    if (adminResult > 0) {
      console.log('\n🎊 SUCCESS! Dashboard should now show correct revenue!');
    } else {
      console.log('\n⚠️  Still showing 0 revenue. Check if orders are actually delivered.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing orders:', error);
    throw error;
  }
};

const runFix = async () => {
  console.log('🚀 Starting order fix process...');
  console.log('📍 Environment:', process.env.NODE_ENV || 'development');
  console.log('🗄️  MongoDB URI:', process.env.MONGODB_URI ? 'Connected ✅' : 'Not set ❌');
  
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    console.log('💡 Please create .env file with MONGODB_URI');
    process.exit(1);
  }
  
  await connectDB();
  await fixExistingOrders();
  
  console.log('\n✅ Fix process completed!');
  console.log('🔄 Please refresh your admin dashboard to see updated revenue.');
  
  process.exit(0);
};

// Handle errors
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  process.exit(1);
});

// Run the fix
runFix();