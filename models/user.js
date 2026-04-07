import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
     type: String, 
     required: true, 
     unique: true
     },
  firstname: { 
    type: String 
  },
  lastname: { 
    type: String 
  },
  password: {
     type: String,
      required: true 
    },
  isAdmin: {
     type: Boolean,
      default: false 
    },
  isStaff: { 
    type: Boolean, 
    default: false
   },
  role: {
     type: String,
     enum: ["customer", "admin", "manager", "cashier", "staff"],
     default: "customer"
    },
  isBlocked: { 
    type: Boolean,
     default: false
   },
  isEmailverified: {
     type: Boolean, 
     default: false
     },
  image: {
     type: String
     },
  dateOfBirth: {
    type: Date
  },
  hometown: { 
    type: String
   },
  telephoneNumber: {
     type: String 
    },
  nicNumber: {
     type: String 
    },
  gender: { 
    type: String
   },
  address: { 
    type: String 
  }
}, { 
  timestamps: true
 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
