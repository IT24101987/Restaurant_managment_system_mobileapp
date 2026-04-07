import Announcement from "../models/announcement.js";
import User from "../models/user.js";

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizeRole(roleValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  if (["customer", "admin", "manager", "cashier", "staff"].includes(role)) return role;
  return null;
}

function roleFlags(role) {
  return {
    isAdmin: role === "admin",
    isStaff: role === "manager" || role === "cashier" || role === "staff"
  };
}

function handleWriteError(res, fallbackMessage, error) {
  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0] || "field";
    const friendlyField = duplicateField;
    return res.status(409).json({ message: `${friendlyField} already exists` });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    const firstValidationError = Object.values(error.errors || {})[0];
    return res.status(400).json({
      message: firstValidationError?.message || "Invalid data"
    });
  }

  return res.status(500).json({ message: fallbackMessage, error: error.message });
}

export async function addAnnouncement(req, res) {
  try {
    const { title, message, type, isActive } = req.body;
    if (!String(title || "").trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!String(message || "").trim()) {
      return res.status(400).json({ message: "Message is required" });
    }
    const announcement = await Announcement.create({
      title: String(title).trim(),
      message: String(message).trim(),
      type: type === "offer" ? "offer" : "notice",
      isActive: parseBoolean(isActive, true)
    });
    return res.status(201).json({ announcement });
  } catch (error) {
    return res.status(500).json({ message: "Failed to add announcement", error: error.message });
  }
}

export async function listAnnouncements(req, res) {
  try {
    const announcements = await Announcement.find()
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ announcements });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch announcements", error: error.message });
  }
}

export async function updateAnnouncement(req, res) {
  try {
    const updates = {};
    if ("title" in req.body) updates.title = String(req.body.title || "").trim();
    if ("message" in req.body) updates.message = String(req.body.message || "").trim();
    if ("type" in req.body) updates.type = req.body.type === "offer" ? "offer" : "notice";
    if ("isActive" in req.body) updates.isActive = parseBoolean(req.body.isActive);

    const announcement = await Announcement.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!announcement) return res.status(404).json({ message: "Announcement not found" });
    return res.json({ announcement });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update announcement", error: error.message });
  }
}

export async function listUsers(req, res) {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    const mapped = users.map((user) => {
      const currentRole = normalizeRole(user.role) || (user.isAdmin ? "admin" : user.isStaff ? "staff" : "customer");
      const flags = roleFlags(currentRole);
      return {
        ...user.toObject(),
        role: currentRole,
        isAdmin: flags.isAdmin,
        isStaff: flags.isStaff
      };
    });
    return res.json({ users: mapped });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
}

export async function updateUser(req, res) {
  try {
    const updates = {};
    const allowed = [
      "firstname",
      "lastname",
      "telephoneNumber",
      "address",
      "isAdmin",
      "isStaff",
      "isBlocked",
      "role"
    ];
    for (const key of allowed) {
      if (key in req.body) updates[key] = req.body[key];
    }

    if ("role" in updates) {
      const role = normalizeRole(updates.role);
      if (!role) {
        return res.status(400).json({ message: "Role must be admin, manager, cashier, staff, or customer" });
      }
      updates.role = role;
      const flags = roleFlags(role);
      updates.isAdmin = flags.isAdmin;
      updates.isStaff = flags.isStaff;
    } else if ("isAdmin" in updates || "isStaff" in updates) {
      const nextIsAdmin = "isAdmin" in updates ? parseBoolean(updates.isAdmin, false) : false;
      const nextIsStaff = "isStaff" in updates ? parseBoolean(updates.isStaff, false) : false;
      if (nextIsAdmin) {
        updates.role = "admin";
        updates.isAdmin = true;
        updates.isStaff = false;
      } else if (nextIsStaff) {
        updates.role = "staff";
        updates.isAdmin = false;
        updates.isStaff = true;
      } else {
        updates.role = "customer";
        updates.isAdmin = false;
        updates.isStaff = false;
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update user", error: error.message });
  }
}

export async function deleteUser(req, res) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (req.user?.email && user.email === req.user.email) {
      return res.status(400).json({ message: "Cannot delete currently logged in admin" });
    }
    await user.deleteOne();
    return res.json({ message: "User deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete user", error: error.message });
  }
}
