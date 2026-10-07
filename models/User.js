const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: false,
    trim: true,
  },
  organization: {
    type: String,
    required: false,
    trim: true,
  },
  bio: {
    type: String,
    required: false,
    trim: true,
  },
  role: {
    type: String,
    required: function() { return this.authProvider === 'local'; },
    default: "user",
    trim: true,
  },
  profileImage: {
    type: String,
    required: false,
    default: "",
  },
  password: {
    type: String,
    required: function() {
      // Password is only required for local email/password users, not for Google auth
      return this.authProvider === 'local';
    },
    minlength: 6,
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
},
{
    timestamps: true,
}
);

const User = mongoose.model('User', userSchema);
module.exports = User;