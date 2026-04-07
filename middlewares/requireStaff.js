export default function requireStaff(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const role = String(req.user.role || "").toLowerCase();
  const canAccess = req.user.isAdmin || req.user.isStaff || role === "admin" || role === "manager" || role === "cashier" || role === "staff";
  if (!canAccess) {
    return res.status(403).json({ message: "Staff access required" });
  }
  next();
}
