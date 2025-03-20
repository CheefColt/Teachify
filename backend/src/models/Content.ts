import { Schema, model, Document, Types } from 'mongoose';

interface IVersion {
  versionNumber: number;
  content: {
    title: string;
    description: string;
    resources: Types.ObjectId[];
    syllabusData?: any;
  };
  changes: string[];
  createdAt: Date;
  createdBy: Types.ObjectId;
}

export interface IContent extends Document {
  title: string;
  description: string;
  subject: Types.ObjectId;
  resources: Types.ObjectId[];
  syllabusData?: any;
  versions: IVersion[];
  currentVersion: number;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const versionSchema = new Schema({
  versionNumber: { type: Number, required: true },
  content: {
    title: { type: String, required: true },
    description: { type: String, required: true },
    resources: [{ type: Schema.Types.ObjectId, ref: 'Resource' }],
    syllabusData: Schema.Types.Mixed
  },
  changes: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

const contentSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  resources: [{ type: Schema.Types.ObjectId, ref: 'Resource' }],
  syllabusData: Schema.Types.Mixed,
  versions: [versionSchema],
  currentVersion: { type: Number, default: 1 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

export const Content = model<IContent>('Content', contentSchema);