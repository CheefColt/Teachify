import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface ITeacher extends Document {
    name: string;
    email: string;
    password: string;
    role: string;
    subjects: mongoose.Types.ObjectId[];
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const teacherSchema = new Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters']
    },
    role: {
        type: String,
        default: 'instructor'
    },
    subjects: [{
        type: Schema.Types.ObjectId,
        ref: 'Subject'
    }]
}, {
    timestamps: true
});

// Hash password before saving
teacherSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to compare password
teacherSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

export const Teacher = mongoose.model<ITeacher>('Teacher', teacherSchema);