import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    // get token from request header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Not authorized, no token" });
    }

    // pull the token out of "Bearer <token>"
    const token = authHeader.split(" ")[1];

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user to request so your routes can use it
    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, token invalid" });
  }
};