import mongoose, { Document } from 'mongoose';

export interface IPerson extends Document {
  pan: string;
  name: string;
  nameNepali?: string; // Name in Nepali/Devanagari script
  position?: string;
  positionNepali?: string; // Position in Nepali/Devanagari script
  department?: string;
  departmentNepali?: string; // Department in Nepali/Devanagari script
  dob?: Date;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new mongoose.Schema({
  pan: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  nameNepali: {
    type: String,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  positionNepali: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  departmentNepali: {
    type: String,
    trim: true
  },
  dob: {
    type: Date
  },
  meta: {
    type: Object
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

PersonSchema.pre('save', function() {
  this.updatedAt = new Date();
});

export default mongoose.model<IPerson>('Person', PersonSchema);
