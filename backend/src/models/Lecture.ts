import { Schema, model, Document, Types } from 'mongoose';

// Define and export the Slide interface
export interface Slide {
  title: string;
  content: string[];
  notes?: string;
}

// Define the Lecture interface using the Slide interface
export interface ILecture extends Document {
  title: string;
  description?: string;
  content: Types.ObjectId;
  slides: Slide[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const slideSchema = new Schema({
  title: { type: String, required: true },
  content: [{ type: String }],
  notes: String
});

const lectureSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  content: { type: Schema.Types.ObjectId, ref: 'Content', required: true },
  slides: [slideSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

export const Lecture = model<ILecture>('Lecture', lectureSchema);