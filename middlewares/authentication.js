import jwt from "jsonwebtoken";
import config from "../config.js";

export default function authenticateUser(req, res, next) {
  const header = req.header("Authorization");
  if (!header) {
    return next();
  }

  const token = header.replace("Bearer ", "");
  jwt.verify(token, config.jwtSecret, (error, decoded) => {
    if (error) {
      return res.status(401).json({
        message: "Invalid token, please login again"
      });
    }
    req.user = decoded;
    next();
  });
}
