process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const aiRoutes = require("./routes/aiRoutes");

// --- DEBUG LOGS TO CHECK IMPORTS ---
console.log("--- ROUTE IMPORT TYPES ---");
console.log("authRoutes:", typeof authRoutes);
console.log("projectRoutes:", typeof projectRoutes);
console.log("aiRoutes:", typeof aiRoutes); // Agar yeh 'undefined' ya 'object' aaya, toh wahi problem hai!
console.log("--------------------------");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// Routes Registration
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/projects", projectRoutes);
app.use("/api/ai", aiRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("SpecFlow AI Backend is Running!");
});

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
  });