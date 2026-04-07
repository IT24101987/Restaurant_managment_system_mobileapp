export default function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const role = String(req.user.role || "").toLowerCase();
  const isAdmin = req.user.isAdmin || role === "admin";
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}
