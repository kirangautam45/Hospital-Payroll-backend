import mongoose, { Document } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // TTL index - auto delete expired tokens
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

RefreshTokenSchema.index({ userId: 1 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
