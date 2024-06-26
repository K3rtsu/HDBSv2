const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const rateLimit = require('express-rate-limit')
const User = require("../models/userModel");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: "Too many login attempts, please try again later",
});

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      res.status(401).json({ success: false, error: "Session expired. Please log in again." });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: "Not authorized. Token does not exist." });
  }
});

const isAdmin = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (req.user.role !== "admin" && req.user.role !== "superadmin") {
        res.status(403).json({ success: false, error: "Forbidden" });
      }
      next();
    } catch (error) {
      res.status(401).json({ success: false, error: "Not authorized" });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, error: "Not authorized. Token does not exist." });
  }
});

const canHandleReservation = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");

      if (
        req.user.role !== "admin" &&
        req.user.role !== "superadmin" &&
        req.user.role !== "om"
      ) {
        return res.status(403).json({ message: "Forbidden" });
      }
      next();
    } catch (error) {
      res.status(403);
      throw new Error("Forbidden");
    }
  }

  if (!token) {
    res.status(401);
    return res
      .status(401)
      .json({
        success: false,
        message: "Not authorized. Token does not exist.",
      });
  }
});

const logger = asyncHandler(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");
    } catch (error) {}
  }

  next();
});

module.exports = { protect, isAdmin, canHandleReservation, logger, limiter };
