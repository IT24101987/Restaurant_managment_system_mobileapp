import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import config from "../config.js";

const VALID_ROLES = ["customer", "admin", "manager", "cashier", "staff"];
const PROFILE_FIELDS = [
  "firstname",
  "lastname",
  "dateOfBirth",
  "hometown",
  "telephoneNumber",
  "nicNumber",
  "gender",
  "address",
  "image"
];

function normalizeRole(rawRole, { allowStaffAlias = true } = {}) {
  const role = String(rawRole || "").trim().toLowerCase();
  if (allowStaffAlias && role === "staff") return "staff";
  if (VALID_ROLES.includes(role)) return role;
  return "";
}

function roleFlags(role) {
  return {
    isAdmin: role === "admin",
    isStaff: role === "manager" || role === "cashier" || role === "staff"
  };
}

function resolveRole(userLike) {
  const explicitRole = normalizeRole(userLike?.role, { allowStaffAlias: true });
  if (explicitRole) return explicitRole;
  if (userLike?.isAdmin) return "admin";
  if (userLike?.isStaff) return "staff";
  return "customer";
}

function getAuthEmail(req) {
  return String(req.user?.email || "").trim().toLowerCase();
}

function validatePhone(phone) {
  if (!phone) return "";
  return /^\d{10}$/.test(String(phone)) ? "" : "Telephone number must be exactly 10 digits";
}

function validateNIC(nic) {
  if (!nic) return "";
  return /^(\d{9}[VvXx]|\d{12})$/.test(String(nic).trim())
    ? ""
    : "NIC must be 9 digits + V/X (old format) or 12 digits (new format)";
}

function validatePasswordStrength(password) {
  const pwd = String(password);
  if (pwd.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Z]/.test(pwd)) return "Password must contain at least one uppercase letter";
  if (!/[a-z]/.test(pwd)) return "Password must contain at least one lowercase letter";
  if (!/[0-9]/.test(pwd)) return "Password must contain at least one number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return "Password must contain at least one special character";
  return "";
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email));
}

function validateRegistrationInput(body) {
  if (!body?.email || !body?.password) return "Email and password are required";
  if (!validateEmail(body.email)) return "Please enter a valid email address";
  if (body.firstname && !/^[A-Za-z\s]+$/.test(String(body.firstname))) return "First name must contain letters only";
  if (body.lastname && !/^[A-Za-z\s]+$/.test(String(body.lastname))) return "Last name must contain letters only";
  if (body.firstname && String(body.firstname).length > 20) return "First name must be 20 characters or less";
  if (body.lastname && String(body.lastname).length > 20) return "Last name must be 20 characters or less";
  if (body.hometown && !/^[A-Za-z\s]+$/.test(String(body.hometown))) return "Hometown must contain letters only";
  if (body.hometown && String(body.hometown).length > 20) return "Hometown must be 20 characters or less";
  const pwdError = validatePasswordStrength(body.password);
  if (pwdError) return pwdError;
  if (body.confirmPassword !== undefined && body.password !== body.confirmPassword) {
    return "Password and confirm password do not match";
  }
  const phoneError = validatePhone(body.telephoneNumber);
  if (phoneError) return phoneError;
  return validateNIC(body.nicNumber);
}

function buildTokenPayload(user) {
  const role = resolveRole(user);
  const flags = roleFlags(role);
  return {
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    isAdmin: flags.isAdmin,
    isStaff: flags.isStaff,
    role,
    isBlocked: user.isBlocked,
    isEmailverified: user.isEmailverified,
    image: user.image,
    dateOfBirth: user.dateOfBirth,
    hometown: user.hometown,
    telephoneNumber: user.telephoneNumber,
    nicNumber: user.nicNumber,
    gender: user.gender,
    address: user.address
  };
}

function isMongoConnectionIssue(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    error?.name === "MongooseServerSelectionError" ||
    msg.includes("buffering timed out") ||
    msg.includes("failed to connect")
  );
}

function sanitizeProfileUpdates(body) {
  const updates = {};
  PROFILE_FIELDS.forEach((field) => {
    if (body?.[field] !== undefined) updates[field] = body[field];
  });
  return updates;
}

async function createUserByRole(req, res, requestedRole = "customer") {
  try {
    const validationError = validateRegistrationInput(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    let role = "customer";
    if (requestedRole === "admin") {
      role = "admin";
    } else if (requestedRole === "staff") {
      const desiredStaffRole = normalizeRole(req.body?.role || "staff", { allowStaffAlias: true });
      if (!["staff", "cashier", "manager"].includes(desiredStaffRole)) {
        return res.status(400).json({ message: "Staff role must be staff, cashier, or manager" });
      }
      role = desiredStaffRole;
    }

    const flags = roleFlags(role);
    const password = bcrypt.hashSync(String(req.body.password), 10);

    const user = new User({
      email: req.body.email,
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      password,
      isAdmin: flags.isAdmin,
      isStaff: flags.isStaff,
      role,
      dateOfBirth: req.body.dateOfBirth,
      hometown: req.body.hometown,
      telephoneNumber: req.body.telephoneNumber,
      nicNumber: req.body.nicNumber,
      gender: req.body.gender,
      address: req.body.address
    });

    await user.save();
    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "User already registered with this email" });
    }
    return res.status(500).json({ message: "Error creating user", error: error.message });
  }
}

export async function createuser(req, res) {
  return createUserByRole(req, res, "customer");
}

export async function createAdminUser(req, res) {
  return createUserByRole(req, res, "admin");
}

export async function createStaffUser(req, res) {
  return createUserByRole(req, res, "staff");
}

export async function loginUser(req, res) {
  try {
    if (!req.body?.email || !req.body?.password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "User is blocked" });

    const role = resolveRole(user);
    if (["admin", "manager", "cashier", "staff"].includes(role)) {
      return res.status(403).json({ message: "Admin and staff must use the Admin Login portal." });
    }

    const isPasswordCorrect = bcrypt.compareSync(String(req.body.password), user.password);
    if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(buildTokenPayload(user), config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });
    return res.json({ token });
  } catch (error) {
    if (isMongoConnectionIssue(error)) {
      return res.status(503).json({
        message: "Database unavailable. Check MONGODB_URI and restart backend."
      });
    }
    return res.status(500).json({ message: "Error logging in", error: error.message });
  }
}

export async function loginAdmin(req, res) {
  try {
    if (!req.body?.email || !req.body?.password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isBlocked) return res.status(403).json({ message: "User is blocked" });

    const role = resolveRole(user);
    if (!["admin", "manager", "cashier", "staff"].includes(role)) {
      return res.status(403).json({ message: "Access denied. Admin or staff account required." });
    }

    const isPasswordCorrect = bcrypt.compareSync(String(req.body.password), user.password);
    if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid password" });

    const token = jwt.sign(buildTokenPayload(user), config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    });
    return res.json({ token });
  } catch (error) {
    if (isMongoConnectionIssue(error)) {
      return res.status(503).json({
        message: "Database unavailable. Check MONGODB_URI and restart backend."
      });
    }
    return res.status(500).json({ message: "Error logging in", error: error.message });
  }
}

export async function getMyProfile(req, res) {
  try {
    const email = getAuthEmail(req);
    if (!email) return res.status(401).json({ message: "Authentication required" });

    const user = await User.findOne({ email }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load profile", error: error.message });
  }
}

export async function updateMyProfile(req, res) {
  try {
    const email = getAuthEmail(req);
    if (!email) return res.status(401).json({ message: "Authentication required" });

    const updates = sanitizeProfileUpdates(req.body);
    const phoneError = validatePhone(updates.telephoneNumber);
    if (phoneError) return res.status(400).json({ message: phoneError });

    const user = await User.findOneAndUpdate(
      { email },
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ message: "Profile updated successfully", user });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update profile", error: error.message });
  }
}

export async function changeMyPassword(req, res) {
  try {
    const email = getAuthEmail(req);
    if (!email) return res.status(401).json({ message: "Authentication required" });

    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters" });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirm password do not match" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isCurrentCorrect = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentCorrect) return res.status(401).json({ message: "Current password is incorrect" });

    user.password = bcrypt.hashSync(newPassword, 10);
    await user.save();
    return res.json({ message: "Password changed successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to change password", error: error.message });
  }
}

export async function deleteMyProfile(req, res) {
  try {
    const email = getAuthEmail(req);
    if (!email) return res.status(401).json({ message: "Authentication required" });

    const currentPassword = String(req.body?.currentPassword || "");
    if (!currentPassword) {
      return res.status(400).json({ message: "Current password is required to delete profile" });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const isCurrentCorrect = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentCorrect) return res.status(401).json({ message: "Current password is incorrect" });

    await User.deleteOne({ _id: user._id });
    return res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete profile", error: error.message });
  }
}

export default function isAdmin(req) {
  return !!(req.user && req.user.isAdmin);
}
