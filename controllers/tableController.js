import DiningTable from "../models/diningTable.js";
import Order from "../models/order.js";

// LIST TABLES
export async function listTables(req, res) {
  try {
    const tables = await DiningTable.find().sort({ tableNo: 1 }).lean();
    res.json({ tables });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tables", error: error.message });
  }
}

// ADD TABLE
export async function addTable(req, res) {
  try {
    const { tableNo, seats, location, purpose, isAvailable } = req.body;

    if (!tableNo) {
      return res.status(400).json(
        { message: "Table number is required" });
    }

    if (![2, 4, 6, 8].includes(Number(seats))) {
      return res.status(400).json(
        { message: "Seats must be 2, 4, 6, or 8" });
    }

    if (!["indoor", "outdoor"].includes(location)) {
      return res.status(400).json(
        { message: "Location must be indoor or outdoor" });
    }

    if (!["vip", "family"].includes(purpose)) {
      return res.status(400).json(
        { message: "Purpose must be vip or family" });
    }

    const existing = await DiningTable.findOne({ tableNo }).select("_id").lean();
    if (existing) {
      return res.status(409).json(
        { message: "Table number already exists" });
    }

    const table = await DiningTable.create({
      tableNo,
      name: tableNo,
      seats: Number(seats),
      location,
      purpose,
      isAvailable: isAvailable ?? true
    });

    res.status(201).json({ table });

  } catch (error) {
    res.status(500).json({ message: "Failed to add table", error: error.message });
  }
}


// UPDATE TABLE
export async function updateTable(req, res) {
  try {
    const table = await DiningTable.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    const { tableNo, seats, location, purpose, isAvailable } = req.body;

    if (tableNo) {
      table.tableNo = tableNo;
      table.name = tableNo;
    }

    if (seats) {
      if (![2, 4, 6, 8].includes(Number(seats))) {
        return res.status(400).json({ message: "Seats must be 2, 4, 6, or 8" });
      }
      table.seats = Number(seats);
    }

    if (location) {
      if (!["indoor", "outdoor"].includes(location)) {
        return res.status(400).json({ message: "Location must be indoor or outdoor" });
      }
      table.location = location;
    }

    if (purpose) {
      if (!["vip", "family"].includes(purpose)) {
        return res.status(400).json({ message: "Purpose must be vip or family" });
      }
      table.purpose = purpose;
    }

    if (isAvailable !== undefined) {
      table.isAvailable = isAvailable;
    }

    await table.save();

    res.json({ table });

  } catch (error) {
    res.status(500).json({ message: "Failed to update table", error: error.message });
  }
}


// DELETE TABLE
export async function deleteTable(req, res) {
  try {
    const table = await DiningTable.findById(req.params.id);
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    const activeOrder = await Order.findOne({
      tableId: table._id,
      status: { $in: ["New", "Preparing", "Ready"] }
    });

    if (activeOrder) {
      return res.status(400).json({
        message: "Cannot delete table with active order"
      });
    }

    await table.deleteOne();

    res.json({ message: "Table deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Failed to delete table", error: error.message });
  }
}
