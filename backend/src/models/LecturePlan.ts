import { Schema, model, Document } from 'mongoose';
import { ITeacher } from './Teacher';
import { ISubject } from './Subject';

export interface ILecturePlan extends Document {
    subjectId: ISubject['_id'];
    teacherId: ITeacher['_id'];
    startDate: Date;
    endDate: Date;
    topics: string[];
    resources: string[];
}

const LecturePlanSchema = new Schema<ILecturePlan>({
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    topics: { type: [String], required: true },
    resources: { type: [String], default: [] },
});

export const LecturePlan = model<ILecturePlan>('LecturePlan', LecturePlanSchema);
