const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['ZP', 'Panchayat Pani Samiti', 'Grampanchayat', 'Contract Agency', 'User'],
    required: true
  },
  __v: {
    type: Number,
    default: 0
  },
  associatedTo: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function() {
        return this.role !== 'ZP' && this.role !== 'Contract Agency';
      }
    },
    uniqueId: {
      type: String,
      required: function() {
        return this.role !== 'ZP' && this.role !== 'Contract Agency';
      }
    },
    role: {
      type: String,
      enum: ['ZP', 'Panchayat Pani Samiti', 'Grampanchayat'],
      required: function() {
        return this.role !== 'ZP' && this.role !== 'Contract Agency';
      },
      validate: {
        validator: function(value) {
          if (this.role === 'Contract Agency') return true;
          
          switch(this.role) {
            case 'User':
              return value === 'Grampanchayat';
            case 'Grampanchayat':
              return value === 'Panchayat Pani Samiti';
            case 'Panchayat Pani Samiti':
              return value === 'ZP';
            default:
              return true;
          }
        },
        message: 'Invalid association hierarchy'
      }
    }
  },
  agencyDetails: {
    companyName: {
      type: String,
      required: function() {
        return this.role === 'Contract Agency';
      }
    },
    registrationNumber: {
      type: String,
      required: function() {
        return this.role === 'Contract Agency';
      }
    },
    contactNumber: String,
    address: String,
    serviceArea: [String],
    specializations: [String],
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Blacklisted'],
      default: 'Active'
    }
  }
}, {
  timestamps: true
});

userSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('uniqueId')) {
    if (!this.uniqueId) {
      const prefix = this.role === 'Contract Agency' ? 'CA' : 
                    this.role === 'ZP' ? 'ZP' : 
                    this.role === 'Panchayat Pani Samiti' ? 'PS' :
                    this.role === 'Grampanchayat' ? 'GP' : 'USER';
      
      if (this.role === 'Contract Agency') {
        this.uniqueId = `CA-${Math.random().toString(36).substr(2, 6)}`;
      } else {
        this.uniqueId = `ID-${Math.floor(Math.random() * 9) + 1}`;
      }
    }
  }
  next();
});

userSchema.methods.validateHierarchy = function() {
  if (this.role === 'Contract Agency') return true;

  const hierarchy = {
    'ZP': 3,
    'Panchayat Pani Samiti': 2,
    'Grampanchayat': 1,
    'User': 0
  };

  if (this.associatedTo && this.associatedTo.role) {
    const currentRoleLevel = hierarchy[this.role];
    const associatedRoleLevel = hierarchy[this.associatedTo.role];
    
    return associatedRoleLevel === currentRoleLevel + 1;
  }
  
  return this.role === 'ZP';
};

const User = mongoose.model('User', userSchema);

module.exports = User;
