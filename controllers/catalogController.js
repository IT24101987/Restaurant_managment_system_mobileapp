import Dish from "../models/dish.js";
import DiningTable from "../models/diningTable.js";
import Announcement from "../models/announcement.js";
import Order from "../models/order.js";

export async function getCatalog(req, res) {
  try {
    const now = new Date();
    const scope = String(req.query.scope || "").toLowerCase();
    const dashboardMode = scope === "dashboard";
    const userMode = scope === "user";
    const announcementFilter = req.user?.isAdmin ? {} : { isActive: true };
    const includeDishes = String(req.query.includeDishes || "true").toLowerCase() !== "false";
    const dishFields = String(req.query.dishFields || "").trim().toLowerCase();
    const dishPage = Math.max(Number.parseInt(String(req.query.dishPage || "1"), 10) || 1, 1);
    const parsedDishLimit = Number.parseInt(String(req.query.dishLimit || "9"), 10);
    const dishLimit = Math.max(1, Math.min(Number.isFinite(parsedDishLimit) ? parsedDishLimit : 9, 500));
    const includeDishTotal = String(req.query.includeDishTotal || "false").toLowerCase() === "true";
    const category = String(req.query.category || "").trim();
    const includeTables = String(req.query.includeTables || "true").toLowerCase() !== "false";
    const includeAnnouncements = String(req.query.includeAnnouncements || "true").toLowerCase() !== "false";
    const includeTimeSlots = String(req.query.includeTimeSlots || "true").toLowerCase() !== "false";
    const includeSeatUsage = String(req.query.includeSeatUsage || "false").toLowerCase() === "true";
    let dishSelect = "";
    if (dashboardMode || userMode) {
      if (dishFields === "basic") {
        dishSelect = "_id name price isAvailable isTrending";
      } else if (dishFields === "thumb") {
        dishSelect = "_id imageUrl";
      } else {
        dishSelect = "_id name category description imageUrl price prepTimeMin isAvailable isTrending averageRating ratingCount";
      }
    }
    const tableSelect = (dashboardMode || userMode)
      ? "_id name tableNo seats isAvailable location purpose"
      : "";
    const dishFilter = {};
    const announcementLimitRaw = Number.parseInt(String(req.query.announcementLimit || "20"), 10);
    const announcementLimit = Math.max(
      1,
      Math.min(Number.isFinite(announcementLimitRaw) ? announcementLimitRaw : 20, 100)
    );
    if (category && category !== "__all__") {
      const categoryVariants = [...new Set([category, category.toUpperCase(), category.toLowerCase()])];
      dishFilter.category = categoryVariants.length === 1 ? category : { $in: categoryVariants };
    }

    const tableQuery = includeTables
      ? DiningTable.find().select(tableSelect).sort({ tableNo: 1 }).lean()
      : Promise.resolve([]);

    if (dashboardMode) {
      const [tables, dishes, activeTableOrders] = await Promise.all([
        tableQuery,
        includeDishes ? Dish.find().select(dishSelect).sort({ name: 1 }).lean() : Promise.resolve([]),
        includeSeatUsage
          ? Order.find({
            orderType: "table",
            status: { $in: ["New", "Preparing", "Ready"] },
            tableId: { $exists: true, $ne: null },
            $or: [
              { reservationEnd: { $exists: false } },
              { reservationEnd: { $gt: now } }
            ]
          }).select("tableId seatCount").lean()
          : Promise.resolve([])
      ]);
      const tableSeatUsage = activeTableOrders.reduce((acc, order) => {
        const tableId = String(order.tableId || "");
        if (!tableId) return acc;
        acc[tableId] = Number(acc[tableId] || 0) + Number(order.seatCount || 1);
        return acc;
      }, {});
      return res.json({
        dishes,
        tables,
        timeSlots: [],
        announcements: [],
        tableSeatUsage
      });
    }

    if (userMode) {
      const userDishLimit = includeDishTotal ? dishLimit : dishLimit + 1;
      const [tables, rawDishes, dishTotal, announcements] = await Promise.all([
        tableQuery,
        Dish.find(dishFilter)
          .select(dishSelect)
          .sort({ name: 1 })
          .skip((dishPage - 1) * dishLimit)
          .limit(userDishLimit)
          .lean(),
        includeDishTotal ? Dish.countDocuments(dishFilter) : Promise.resolve(null),
        includeAnnouncements
          ? Announcement.find(announcementFilter)
            .select("title message type createdAt")
            .sort({ createdAt: -1 })
            .limit(announcementLimit)
            .lean()
          : Promise.resolve([])
      ]);
      const hasNextPage = includeDishTotal
        ? dishPage < Math.max(1, Math.ceil(Number(dishTotal || 0) / dishLimit))
        : rawDishes.length > dishLimit;
      const dishes = includeDishTotal ? rawDishes : rawDishes.slice(0, dishLimit);
      const dishTotalPages = includeDishTotal
        ? Math.max(1, Math.ceil(Number(dishTotal || 0) / dishLimit))
        : null;
      return res.json({
        dishes,
        dishPagination: {
          page: dishPage,
          limit: dishLimit,
          total: includeDishTotal ? dishTotal : null,
          totalPages: dishTotalPages,
          hasNextPage
        },
        tables,
        timeSlots: [],
        announcements,
        tableSeatUsage: {}
      });
    }

    const [dishes, tables, slotRows, announcements, activeTableOrders] = await Promise.all([
      Dish.find().select(dishSelect).sort({ name: 1 }).lean(),
      tableQuery,
      includeTimeSlots
        ? Order.distinct("timeSlotLabel", { timeSlotLabel: { $exists: true, $ne: "" } })
        : Promise.resolve([]),
      includeAnnouncements
        ? Announcement.find(announcementFilter)
          .select("title message type isActive createdAt")
          .sort({ createdAt: -1 })
          .limit(announcementLimit)
          .lean()
        : Promise.resolve([]),
      includeSeatUsage
        ? Order.find({
          orderType: "table",
          status: { $in: ["New", "Preparing", "Ready"] },
          tableId: { $exists: true, $ne: null },
          $or: [
            { reservationEnd: { $exists: false } },
            { reservationEnd: { $gt: now } }
          ]
        }).select("tableId seatCount").lean()
        : Promise.resolve([])
    ]);

    const labels = [...new Set(slotRows.map((label) => String(label || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    const timeSlots = labels.map((label) => ({ label, isAvailable: true }));
    const tableSeatUsage = activeTableOrders.reduce((acc, order) => {
      const tableId = String(order.tableId || "");
      if (!tableId) return acc;
      acc[tableId] = Number(acc[tableId] || 0) + Number(order.seatCount || 1);
      return acc;
    }, {});

    return res.json({ dishes, tables, timeSlots, announcements, tableSeatUsage });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch catalog", error: error.message });
  }
}
