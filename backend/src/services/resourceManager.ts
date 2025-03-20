import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Resource, IResource } from '../models/Resource';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

export const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Recommend resources based on a topic
export const recommendResources = async (topic: string): Promise<IResource[]> => {
    try {
        const resources = await Resource.find({ topic }).exec();
        return resources;
    } catch (error) {
        console.error('Error recommending resources:', error);
        throw new Error('Could not recommend resources');
    }
};

// Categorize resources
export const categorizeResource = async (resourceId: string, category: string): Promise<IResource | null> => {
    try {
        const resource = await Resource.findByIdAndUpdate(resourceId, { category }, { new: true }).exec();
        return resource;
    } catch (error) {
        console.error('Error categorizing resource:', error);
        throw new Error('Could not categorize resource');
    }
};