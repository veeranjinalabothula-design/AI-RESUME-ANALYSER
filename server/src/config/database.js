import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.info("MONGODB_URI is not set; starting in demo mode.");
    return false;
  }
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (
    !jwtSecret ||
    jwtSecret.length < 32 ||
    jwtSecret === "replace-with-a-long-random-secret"
  ) {
    throw new Error("Set JWT_SECRET to a random value of at least 32 characters before enabling accounts.");
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.info("Connected to MongoDB.");
  return true;
}
