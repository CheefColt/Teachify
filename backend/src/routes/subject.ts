import { Router, Request, Response } from 'express';
import { RequestHandler } from 'express-serve-static-core';
import { auth } from '../middleware/auth';
import { Subject } from '../models/Subject';
import { ITeacher } from '../models/Teacher';
import { SyllabusAnalyzer } from '../services/ai/syllabusAnalyzer';
import { upload } from '../services/resourceManager';
import fs from 'fs/promises';
import mongoose from 'mongoose';
import { GeminiService } from '../services/geminiService';

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
    const { name, code, description } = req.body;
    const syllabusFile = req.file; // Assuming file upload middleware is used

    console.log('Creating subject with data:', { name, code, description });
    console.log('User ID:', req.user?.id);
    console.log('Syllabus File:', syllabusFile ? {
        filename: syllabusFile.filename,
        path: syllabusFile.path,
        size: syllabusFile.size,
        mimetype: syllabusFile.mimetype
    } : 'No file uploaded');

    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!syllabusFile) {
        return res.status(400).json({ message: 'Syllabus file is required' });
    }

    try {
        console.log('Processing syllabus file...');
        // Detect file type based on mimetype
        const fileType = syllabusFile.mimetype;
        console.log('File type detected:', fileType);
        
        // Extract text from file using the appropriate method based on file type
        let syllabusText = '';
        
        if (fileType === 'application/pdf' || fileType.includes('pdf')) {
            console.log('Using GeminiService to extract text from PDF...');
            const geminiService = new GeminiService();
            try {
                syllabusText = await geminiService.extractTextFromFile(syllabusFile.path);
                console.log('Successfully extracted text from PDF, length:', syllabusText.length);
            } catch (extractError) {
                console.error('Error extracting text from PDF:', extractError);
                // Fallback to reading the file directly
                syllabusText = await fs.readFile(syllabusFile.path, 'utf-8');
            }
        } else {
            // For non-PDF files, read as text
            syllabusText = await fs.readFile(syllabusFile.path, 'utf-8');
        }
        
        console.log('Syllabus text sample:', syllabusText.substring(0, 500) + '...');
        
        if (!syllabusText || syllabusText.trim().length < 50 || syllabusText.includes('%PDF')) {
            console.log('Text extraction failed or returned binary data. Using placeholder text...');
            syllabusText = `Subject: ${name}\nCode: ${code}\nDescription: ${description || 'No description provided.'}\n\nThis is placeholder text because the uploaded syllabus could not be properly extracted.`;
        }
        
        let analyzedSyllabus;
        try {
            console.log('Initializing syllabusAnalyzer...');
            const analyzer = new SyllabusAnalyzer();
            
            console.log('Starting syllabus analysis with extracted text...');
            analyzedSyllabus = await analyzer.analyzeSyllabus(syllabusText);
            console.log('Analysis completed:', JSON.stringify(analyzedSyllabus, null, 2));
        } catch (analysisError) {
            console.error('Error during syllabus analysis:', analysisError);
            console.log('Falling back to default topics...');
            
            // Create default topics if analysis fails
            analyzedSyllabus = {
                topics: [
                    {
                        title: name || 'Main Topic',
                        subtopics: ['Subtopic 1', 'Subtopic 2', 'Subtopic 3'],
                        estimatedDuration: 3,
                        learningObjectives: ['Understand core concepts', 'Apply knowledge', 'Analyze problems']
                    }
                ],
                totalDuration: 15,
                courseObjectives: ['Master the subject material', 'Develop critical thinking skills'],
                prerequisites: []
            };
        }
        
        console.log('Creating subject in database with name:', name);
        const subject = await Subject.create({
            name,
            code,
            description, // Add description to the subject
            teacher: req.user.id,
            syllabus: {
                raw: syllabusText,
                analyzed: analyzedSyllabus,
                lastUpdated: new Date()
            },
            topics: analyzedSyllabus.topics.length > 0 
                ? analyzedSyllabus.topics.map(topic => ({
                    title: topic.title,
                    subtopics: topic.subtopics
                  }))
                : [{
                    title: name || 'Main Topic',
                    subtopics: ['Subtopic 1', 'Subtopic 2', 'Subtopic 3']
                  }]
        });
        
        console.log('Subject created successfully:', subject._id);
        console.log('Subject name:', subject.name);
        console.log('Subject topics count:', subject.topics.length);
        
        res.status(201).json(subject);
    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({ 
            message: 'Failed to create subject', 
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const getSubjects: AuthHandler = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const subjects = await Subject.find({ teacher: req.user.id });
    res.json(subjects);
};

const getSubjectById: AuthHandler = async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const { id } = req.params;
        
        // Check if the ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                message: 'Invalid subject ID format', 
                error: 'The provided ID is not a valid MongoDB ObjectId'
            });
        }

        const subject = await Subject.findById(id);
        
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        // Check if this subject belongs to the requesting user
        if (subject.teacher.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to access this subject' });
        }

        res.json(subject);
    } catch (error) {
        console.error('Error fetching subject by ID:', error);
        res.status(500).json({ 
            message: 'Failed to fetch subject',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
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
router.get('/:id', auth, asyncHandler(getSubjectById));
router.put('/:id/syllabus', auth, asyncHandler(updateSyllabus));
router.post('/:id/analyze-syllabus', auth, asyncHandler(analyzeSyllabus));

export default router;