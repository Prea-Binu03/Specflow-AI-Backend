const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");

const router = express.Router();

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ==========================================
// MULTER CONFIGURATION FOR PROFILE IMAGES
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Ensure 'uploads' folder exists in your backend root
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, webp) are allowed!"));
  },
});


// ==========================================
// REGISTER USER
// ==========================================
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      role,
      password,
    } = req.body;

    console.log("Registration request received:");
    console.log("Full Name:", fullName);
    console.log("Email:", email);
    console.log("Phone:", phone);
    console.log("Role:", role);

    // Check required fields
    if (!fullName || !email || !role || !password) {
      return res.status(400).json({
        message: "Please fill all required fields",
      });
    }

    // Password validation
    const PASSWORD_REGEX =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!\%*?&]).{8,}$/;

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain an uppercase letter, lowercase letter, number, and special character.",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name: fullName,
      email: email.toLowerCase(),
      phone: phone,
      role: role,
      password: hashedPassword,
      authProvider: "local",
    });

    // Save user
    await user.save();

    console.log("User registered successfully");

    res.status(201).json({
      message: "Account created successfully",
    });

  } catch (error) {
    console.error("Registration Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// LOGIN USER (Updated with 404 for missing user)
// ==========================================
router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
    } = req.body;

    // Check required fields
    if (!email || !password) {
      return res.status(400).json({
        message: "Please enter email and password",
      });
    }

    // Find user
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    // AGAR USER DATABASE MEIN NAHI HAI -> 404 Return karega
    if (!user) {
      return res.status(404).json({
        message: "User not found. Please register first.",
      });
    }

    // If user signed up via Google originally without a password
    if (!user.password) {
      return res.status(401).json({
        message: "This account uses Google Sign-In. Please continue with Google.",
      });
    }

    // Compare password
    const isPasswordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Create JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Send user details including profile image
    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organization: user.organization,
        bio: user.bio,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error("Login Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// GOOGLE AUTHENTICATION ROUTE
// ==========================================
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    let email, name, picture, googleId;

    // Check if the credential is an Access Token (starts with ya29.) or an ID Token
    if (credential.startsWith("ya29.")) {
      const googleRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
        headers: { Authorization: `Bearer ${credential}` },
      });
      const data = await googleRes.json();
      
      if (!googleRes.ok || !data.email) {
        return res.status(401).json({ message: "Failed to fetch user info from Google" });
      }
      
      email = data.email;
      name = data.name;
      picture = data.picture;
      googleId = data.sub;
    } else {
      // Verify Google ID Token securely
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      googleId = payload.sub;
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    let isExistingUser = true;

    if (user) {
      // If user exists, link googleId if not already present
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.profileImage && picture) {
          user.profileImage = picture;
        }
        await user.save();
      }
    } else {
      isExistingUser = false;
      // Create new account for Google user
      user = new User({
        name: name || "Google User",
        email: email.toLowerCase(),
        googleId,
        authProvider: "google",
        role: "user", // Default role
        profileImage: picture || "",
      });
      await user.save();
    }

    // Generate standard JWT token matching existing login format
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    res.status(200).json({
      message: isExistingUser ? "Welcome back! Already registered, logging you in..." : "Google registration successful!",
      isExistingUser,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organization: user.organization,
        bio: user.bio,
        profileImage: user.profileImage,
      },
    });

  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ message: "Google authentication failed" });
  }
});


// ==========================================
// GET USER PROFILE
// ==========================================
router.get("/profile/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Fetch Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


// ==========================================
// UPDATE USER PROFILE
// ==========================================
router.put("/profile/:id", upload.single("profileImage"), async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      email,
      phone,
      role,
      organization,
      bio,
    } = req.body;

    const updateData = {
      name,
      email: email ? email.toLowerCase() : undefined,
      phone,
      role,
      organization,
      bio,
    };

    // If a new profile image is uploaded, add its path
    if (req.file) {
      updateData.profileImage = `/uploads/${req.file.filename}`;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    // User not found
    if (!updatedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Send updated user
    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Profile Update Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});


// ==========================================
// RESET PASSWORD
// ==========================================
router.put("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Check required fields
    if (!email || !newPassword) {
      return res.status(400).json({
        message: "Email and new password are required",
      });
    }

    // Same password validation used in registration
    const PASSWORD_REGEX =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!\%*?&]).{8,}$/;

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and contain an uppercase letter, lowercase letter, number, and special character.",
      });
    }

    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
    });

    // User not found
    if (!user) {
      return res.status(404).json({
        message: "User with this email does not exist.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // Update password only
    user.password = hashedPassword;
    user.authProvider = "local";

    await user.save();

    res.status(200).json({
      message: "Password reset successfully.",
    });

  } catch (error) {
    console.error("Reset Password Error:", error);

    res.status(500).json({
      message: "Server error",
    });
  }
});

module.exports = router;