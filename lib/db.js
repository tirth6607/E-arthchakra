const mongoose = require("mongoose");

// Reuse the connection across warm serverless invocations.
let cached = global._earthchakraMongoose;
if (!cached) cached = global._earthchakraMongoose = { conn: null, promise: null };

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is not set");

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 8000,
        maxPoolSize: 5
      })
      .catch((err) => {
        cached.promise = null; // allow retry on next request
        throw err;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;
