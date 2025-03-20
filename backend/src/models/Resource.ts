import { Schema, model, Document, Types } from 'mongoose';

export interface IResource extends Document {
  type: string;
  title: string;
  description: string;
  url?: string;
  filePath?: string;
  subject: Types.ObjectId;
  content?: Types.ObjectId;
  linkType?: 'primary' | 'supplementary';
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const resourceSchema = new Schema({
  type: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  url: String,
  filePath: String,
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  content: { type: Schema.Types.ObjectId, ref: 'Content' },
  linkType: { 
    type: String, 
    enum: ['primary', 'supplementary']
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

// Add text indexes for search
resourceSchema.index({ 
  title: 'text', 
  description: 'text'
});

export const Resource = model<IResource>('Resource', resourceSchema);