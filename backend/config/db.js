const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    console.log('\n=============================================================');
    console.log('⚡ [DB Notice] MONGODB_URI is empty in backend/.env');
    console.log('⚡ Operating in Hybrid In-Memory Resilience Mode.');
    console.log('⚡ You can add your MongoDB connection string to backend/.env anytime.');
    console.log('=============================================================\n');
    isConnected = false;
    return false;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`\n✅ [MongoDB] Connected successfully to host: ${conn.connection.host}\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ [MongoDB Connection Error] ${error.message}`);
    console.log('⚡ Falling back to in-memory resilience store for seamless operation.\n');
    isConnected = false;
    return false;
  }
};

const isDbConnected = () => isConnected;

module.exports = { connectDB, isDbConnected };
