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

app.get("/", async (req, res) => {
  const data = await Location.find().sort({ createdAt: -1 });
  res.render("index", { data });
});

app.post("/save", async (req, res) => {
  try {
    const { lat, lon } = req.body;

    const ip = (await axios.get("https://api64.ipify.org?format=json")).data.ip;

    await Location.create({ lat, lon, ip });

    res.json({ success: true, msg: "🔥 Location Saved Fast!" });
  } catch (error) {
    console.log(error);
    res.json({ success: false, msg: "Server error" });
  }
});

app.listen(3000, () => console.log("Server running at http://localhost:3000"));