import { Schema, model, Document, Types } from 'mongoose';

interface ISlide {
  title: string;
  content: string[];
  notes?: string;
}

export interface IPresentation extends Document {
  title: string;
  description?: string;
  content: Types.ObjectId;
  slides: ISlide[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const slideSchema = new Schema({
  title: { type: String, required: true },
  content: [{ type: String }],
  notes: String
});

const presentationSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  content: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
  slides: [slideSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

export const Presentation = model<IPresentation>('Presentation', presentationSchema);