export default function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.isBlocked) {
    return res.status(403).json({ message: "User is blocked" });
  }

  next();
}
