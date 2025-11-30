import mongoose, { Document } from 'mongoose';

export interface ISalaryRecord extends Document {
  pan: string;
  personId: mongoose.Types.ObjectId;
  name?: string;
  nameNepali?: string; // Name in Nepali/Devanagari script
  position?: string;
  positionNepali?: string; // Position in Nepali/Devanagari script
  department?: string;
  departmentNepali?: string; // Department in Nepali/Devanagari script
  accountNumber?: string;

  // Duty/Attendance
  dutyDays?: {
    month1?: number;
    month2?: number;
    month3?: number;
    total?: number;
  };

  // Salary breakdown
  rate?: number;
  grossAmount?: number;
  taxDeduction?: number;
  otherDeductions?: number;
  netSalary: number;

  currency: string;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  source?: string;
  uploadedAt: Date;
  rowHash: string;
  meta?: Record<string, unknown>;
}

const SalaryRecordSchema = new mongoose.Schema({
  pan: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  personId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Person'
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
  accountNumber: {
    type: String,
    trim: true
  },

  // Duty/Attendance breakdown
  dutyDays: {
    month1: { type: Number },
    month2: { type: Number },
    month3: { type: Number },
    total: { type: Number }
  },

  // Salary breakdown
  rate: {
    type: Number
  },
  grossAmount: {
    type: Number
  },
  taxDeduction: {
    type: Number,
    default: 0
  },
  otherDeductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    required: true
  },

  currency: {
    type: String,
    default: 'NPR'
  },
  effectiveFrom: {
    type: Date
  },
  effectiveTo: {
    type: Date,
    default: null
  },
  source: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  rowHash: {
    type: String,
    index: true,
    unique: true,
    sparse: true
  },
  meta: {
    type: Object
  }
});

SalaryRecordSchema.index({ pan: 1, uploadedAt: -1 });
SalaryRecordSchema.index({ department: 1 });

export default mongoose.model<ISalaryRecord>('SalaryRecord', SalaryRecordSchema);
