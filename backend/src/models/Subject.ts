import mongoose, { Document, Schema } from 'mongoose';

export interface ISubject extends Document {
    name: string;
    code: string;
    description?: string;
    teacher: mongoose.Types.ObjectId;
    syllabus: {
        raw: string;
        analyzed: object;
        lastUpdated: Date;
    };
    content: Array<{
        topic: string;
        materials: string[];
        resources: string[];
        lastUpdated: Date;
    }>;
    topics: [{
        title: String,
        subtopics: [String]
    }];
}

const subjectSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Subject name is required'],
        trim: true
    },
    code: {
        type: String,
        required: [true, 'Subject code is required'],
        unique: true,
        trim: true
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    teacher: {
        type: Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    syllabus: {
        raw: String,
        analyzed: Object,
        lastUpdated: Date
    },
    content: [{
        topic: String,
        materials: [String],
        resources: [String],
        lastUpdated: { type: Date, default: Date.now }
    }],
    topics: [{
        title: String,
        subtopics: [String]
    }]
}, {
    timestamps: true
});

export const Subject = mongoose.model<ISubject>('Subject', subjectSchema);