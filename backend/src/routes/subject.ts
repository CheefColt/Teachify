import { Router, Request, Response } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { auth } from '../middleware/auth';
import { Subject } from '../models/Subject';
import { ITeacher } from '../models/Teacher';
import { SyllabusAnalyzer } from '../services/ai/syllabusAnalyzer';
import { upload } from '../services/resourceManager';
import fs from 'fs/promises';

// Extended type for authenticated requests
interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
        role: string;
    };
}

// Type for request handlers with authentication
type AuthHandler = (
    req: AuthenticatedRequest,
    res: Response
) => Promise<any>;

const router = Router();

// Wrap async handlers to properly handle errors
const asyncHandler = (fn: AuthHandler): RequestHandler => (
    req: Request,
    res: Response,
    next
) => {
    Promise.resolve(fn(req as AuthenticatedRequest, res)).catch(next);
};

// Controller functions
const createSubject: AuthHandler = async (req, res) => {
    const { name, code } = req.body;
    const syllabusFile = req.file; // Assuming file upload middleware is used

    console.log('User:', req.user);
    console.log('Syllabus File:', syllabusFile);

    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!syllabusFile) {
        return res.status(400).json({ message: 'Syllabus file is required' });
    }

    try {
        const syllabusText = await fs.readFile(syllabusFile.path, 'utf-8'); // Read file from disk
        const analyzer = new SyllabusAnalyzer();
        const analyzedSyllabus = await analyzer.analyzeSyllabus(syllabusText);

        const subject = await Subject.create({
            name,
            code,
            teacher: req.user.id,
            syllabus: {
                raw: syllabusText,
                analyzed: analyzedSyllabus,
                lastUpdated: new Date()
            },
            topics: analyzedSyllabus.topics.map(topic => ({
                title: topic.title,
                subtopics: topic.subtopics
            }))
        });

        res.status(201).json(subject);
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({ message: 'Failed to create subject', error: error instanceof Error ? error.message : 'Unknown error' });
    }
};

const getSubjects: AuthHandler = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const subjects = await Subject.find({ teacher: req.user.id });
    res.json(subjects);
};

const updateSyllabus: AuthHandler = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { raw } = req.body;
    const subject = await Subject.findById(req.params.id);
    
    if (!subject) {
        return res.status(404).json({ message: 'Subject not found' });
    }

    if (subject.teacher.toString() !== req.user.id.toString()) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    subject.syllabus = {
        raw,
        analyzed: {},
        lastUpdated: new Date()
    };

    await subject.save();
    res.json(subject);
};

const analyzeSyllabus: AuthHandler = async (req, res) => {
    const { id } = req.params;
    const { syllabusText } = req.body;

    try {
        const subject = await Subject.findById(id);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        const analyzer = new SyllabusAnalyzer();
        const analyzed = await analyzer.analyzeSyllabus(syllabusText);

        subject.syllabus = {
            raw: syllabusText,
            analyzed,
            lastUpdated: new Date()
        };

        await subject.save();
        res.json(subject);
    } catch (error: any) {
        res.status(500).json({ 
            message: 'Failed to analyze syllabus',
            error: error.message 
        });
    }
};

// Routes with error handling
router.post('/', auth, upload.single('syllabusFile'), asyncHandler(createSubject));
router.get('/', auth, asyncHandler(getSubjects));
router.put('/:id/syllabus', auth, asyncHandler(updateSyllabus));
router.post('/:id/analyze-syllabus', auth, asyncHandler(analyzeSyllabus));

export default router;