import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Sign in to access saved analyses." });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

export function requireDatabase(req, res, next) {
  if (process.env.MONGODB_URI?.trim()) return next();
  return res.status(503).json({ message: "Accounts need MongoDB. Demo analysis is available without it." });
}
