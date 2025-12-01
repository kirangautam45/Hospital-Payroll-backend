import mongoose, { Document } from 'mongoose';

export interface IPharmacyRecord extends Document {
  pan: string;
  name?: string;
  position?: string;
  nightDutyCount?: number;
  rate?: number;
  grossAmount?: number;
  taxDeduction?: number;
  netPayable?: number;
  accountNumber?: string;
  source?: string;
  uploadedAt: Date;
}

const PharmacyRecordSchema = new mongoose.Schema({
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
  position: {
    type: String,
    trim: true
  },
  nightDutyCount: {
    type: Number
  },
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
  netPayable: {
    type: Number
  },
  accountNumber: {
    type: String,
    trim: true
  },
  source: {
    type: String
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

PharmacyRecordSchema.index({ name: 1 });
PharmacyRecordSchema.index({ uploadedAt: -1 });

export default mongoose.model<IPharmacyRecord>('PharmacyRecord', PharmacyRecordSchema);
