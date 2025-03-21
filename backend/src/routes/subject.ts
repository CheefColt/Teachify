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
import { ContentGenerator } from '../services/ai/contentGenerator';
import { ResourceService } from '../services/resourceService';

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

// Upload material for a subject
const uploadMaterial: AuthHandler = async (req, res) => {
    const { id } = req.params;
    const materialFile = req.file;

    console.log('Uploading material for subject:', id);
    console.log('Material File:', materialFile ? {
        filename: materialFile.filename,
        path: materialFile.path,
        size: materialFile.size,
        mimetype: materialFile.mimetype
    } : 'No file uploaded');

    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!materialFile) {
        return res.status(400).json({ message: 'Material file is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid subject ID' });
    }

    try {
        // Find the subject
        const subject = await Subject.findById(id);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        // Extract text from the material
        const geminiService = new GeminiService();
        let extractedText = '';
        try {
            extractedText = await geminiService.extractTextFromFile(materialFile.path);
            console.log(`Extracted ${extractedText.length} characters from material`);
        } catch (error) {
            const extractionError = error as Error;
            console.error('Error extracting text from material:', extractionError);
            return res.status(500).json({ 
                message: 'Failed to extract text from material',
                error: extractionError.message
            });
        }

        // Save material info to the subject
        const materialInfo = {
            filename: materialFile.originalname,
            path: materialFile.path,
            type: materialFile.mimetype,
            uploadDate: new Date(),
            extractedText: extractedText.substring(0, 1000) + '...' // Store a preview
        };

        // Initialize materials array if it doesn't exist
        if (!Array.isArray(subject.materials)) {
            // Create a new materials array if it doesn't exist
            subject.materials = [];
        }
        
        // Push the new material to the array
        subject.materials.push(materialInfo);
        
        console.log("Saving material:", {
            filename: materialInfo.filename,
            type: materialInfo.type
        });
        
        // Save the updated subject
        await subject.save();

        res.status(200).json({ 
            message: 'Material uploaded successfully',
            material: {
                filename: materialFile.originalname,
                type: materialFile.mimetype,
                uploadDate: new Date()
            }
        });
    } catch (error) {
        const err = error as Error;
        console.error('Error uploading material:', err);
        return res.status(500).json({ 
            message: 'Failed to upload material',
            error: err.message
        });
    }
};

// Generate content from material
const generateContentFromMaterial: AuthHandler = async (req, res) => {
    const { id } = req.params;
    const { topicId } = req.body;

    if (!req.user) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid subject ID' });
    }

    try {
        // Find the subject
        const subject = await Subject.findById(id);
        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        // Check if the subject has materials
        if (!subject.materials || subject.materials.length === 0) {
            return res.status(400).json({ 
                message: 'No materials found for this subject. Please upload materials first.' 
            });
        }

        // Find the specified topic
        let topicTitle = '';
        if (topicId) {
            // We need to cast the topic to access _id
            type TopicWithId = { 
                _id: mongoose.Types.ObjectId | string; 
                title: string; 
                subtopics: string[];
            };
            
            const topic = subject.topics.find(t => {
                const topicWithId = t as unknown as TopicWithId;
                return topicWithId._id && topicWithId._id.toString() === topicId;
            });
            
            if (!topic) {
                return res.status(404).json({ message: 'Topic not found' });
            }
            topicTitle = topic.title;
        } else if (subject.topics && subject.topics.length > 0) {
            // Use the first topic if none specified
            topicTitle = subject.topics[0].title;
        } else {
            return res.status(400).json({ message: 'No topics found for this subject' });
        }

        // Gather all material text
        let combinedMaterialText = '';
        for (const material of subject.materials) {
            if (material.extractedText) {
                combinedMaterialText += material.extractedText + '\n\n';
            }
        }

        if (combinedMaterialText.length < 100) {
            // Create a basic content if we don't have enough material
            console.log('Not enough material text extracted. Using fallback content generation.');
            
            // Create basic content based on topic title
            const basicContent = {
                topic: topicTitle,
                content: `This is a basic overview of ${topicTitle}. Add more materials to generate detailed content.`,
                keyPoints: [`Key concepts of ${topicTitle}`, 'Add materials to see more key points'],
                lastUpdated: new Date()
            };
            
            // Update or add this basic content
            if (!subject.content) {
                subject.content = [];
            }
            
            const contentIndex = subject.content.findIndex(c => c.topic === topicTitle);
            if (contentIndex !== -1) {
                subject.content[contentIndex] = basicContent;
            } else {
                subject.content.push(basicContent);
            }
            
            await subject.save();
            
            // Return the basic content
            return res.status(200).json({
                message: 'Basic content created (not enough material text)',
                content: {
                    title: topicTitle,
                    content: basicContent.content,
                    keyPoints: basicContent.keyPoints,
                    examples: [],
                    references: []
                }
            });
        }

        try {
            // Generate content using AI
            console.log(`Generating content for topic: ${topicTitle}`);
            console.log(`Using ${combinedMaterialText.length} characters of material text`);
            
            const contentGenerator = new ContentGenerator();
            const generatedContent = await contentGenerator.generateContent({
                topic: topicTitle,
                previousContent: combinedMaterialText.substring(0, 5000) // Limit length for API
            });

            // Update the topic's content in the subject
            const topicIndex = subject.topics.findIndex(t => {
                const topicWithId = t as unknown as { _id: mongoose.Types.ObjectId | string };
                return topicId ? topicWithId._id.toString() === topicId : t.title === topicTitle;
            });

            if (topicIndex !== -1) {
                // If the content array doesn't exist, create it
                if (!subject.content) {
                    subject.content = [];
                }

                // Check if content already exists for this topic
                const contentIndex = subject.content.findIndex(c => c.topic === topicTitle);
                
                if (contentIndex !== -1) {
                    // Update existing content
                    subject.content[contentIndex] = {
                        topic: topicTitle,
                        content: generatedContent.content,
                        keyPoints: generatedContent.keyPoints,
                        lastUpdated: new Date()
                    };
                } else {
                    // Add new content
                    subject.content.push({
                        topic: topicTitle,
                        content: generatedContent.content,
                        keyPoints: generatedContent.keyPoints,
                        lastUpdated: new Date()
                    });
                }

                await subject.save();
            }

            res.status(200).json({ 
                message: 'Content generated successfully',
                content: generatedContent
            });
        } catch (aiError) {
            console.error('Error with AI content generation:', aiError);
            
            // Create fallback content
            const fallbackContent = {
                title: topicTitle,
                content: `Content for ${topicTitle} based on your materials. The system encountered an error generating detailed content.`,
                keyPoints: ['Basic concepts and fundamentals', 'Practical applications', 'Theory and principles'],
                examples: [],
                references: [],
                updatedAt: new Date()
            };
            
            // Save fallback content to the subject
            if (!subject.content) {
                subject.content = [];
            }
            
            const contentIndex = subject.content.findIndex(c => c.topic === topicTitle);
            if (contentIndex !== -1) {
                subject.content[contentIndex] = {
                    topic: topicTitle,
                    content: fallbackContent.content,
                    keyPoints: fallbackContent.keyPoints,
                    lastUpdated: new Date()
                };
            } else {
                subject.content.push({
                    topic: topicTitle,
                    content: fallbackContent.content,
                    keyPoints: fallbackContent.keyPoints,
                    lastUpdated: new Date()
                });
            }
            
            await subject.save();
            
            // Return the fallback content with a warning
            return res.status(200).json({
                message: 'Content generated with fallback (AI processing error)',
                content: fallbackContent,
                warning: 'The AI encountered an error processing your materials. Basic content has been generated instead.'
            });
        }
    } catch (error) {
        const err = error as Error;
        console.error('Error generating content from material:', err);
        return res.status(500).json({ 
            message: 'Failed to generate content',
            error: err.message
        });
    }
};

// Replace the resource pooling endpoint with this updated version
router.post('/:id/resources', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { topics, query, useRealUrls = false } = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid subject ID format' });
    }

    // Find the subject
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    console.log(`Finding resources for subject "${subject.name}" with topics: ${topics.join(', ')} and query: ${query}, useRealUrls: ${useRealUrls}`);
    
    // Get the syllabus text if available
    const syllabusText = subject.syllabus?.raw || '';
    
    // Use the resource service to find resources
    const resourceService = new ResourceService();
    const resources = await resourceService.findResources({
      topics,
      query: query || '',
      limit: 10,
      syllabusText, // Add syllabus text to help with context-aware resource finding
      useRealUrls // Pass the useRealUrls flag to the resource service
    });
    
    return res.json({ resources });
  } catch (error) {
    console.error('Error finding resources:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// New endpoint to track resource interactions
router.post('/:id/resources/:resourceId/track', auth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id, resourceId } = req.params;
    const { interactionType } = req.body;
    
    if (!['view', 'bookmark', 'download'].includes(interactionType)) {
      return res.status(400).json({ message: 'Invalid interaction type' });
    }
    
    // Validate subject exists
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid subject ID format' });
    }
    
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    // Track the interaction
    const resourceService = new ResourceService();
    await resourceService.trackResourceInteraction(
      resourceId,
      req.user.id,
      interactionType
    );
    
    return res.status(200).json({ message: 'Interaction tracked successfully' });
  } catch (error) {
    console.error('Error tracking resource interaction:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// New endpoint to get recommended resources
router.get('/:id/recommended-resources', auth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const { id } = req.params;
    
    // Validate subject exists
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid subject ID format' });
    }
    
    const subject = await Subject.findById(id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }
    
    // Get recommendations
    const resourceService = new ResourceService();
    const recommendations = await resourceService.getRecommendedResources(
      req.user.id,
      id
    );
    
    return res.status(200).json({ resources: recommendations });
  } catch (error) {
    console.error('Error getting recommended resources:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

// Routes with error handling
router.post('/', auth, upload.single('syllabusFile'), asyncHandler(createSubject));
router.get('/', auth, asyncHandler(getSubjects));
router.get('/:id', auth, asyncHandler(getSubjectById));
router.put('/:id/syllabus', auth, asyncHandler(updateSyllabus));
router.post('/:id/analyze-syllabus', auth, asyncHandler(analyzeSyllabus));
router.post('/:id/materials', auth, upload.single('materialFile'), asyncHandler(uploadMaterial));
router.post('/:id/generate-content', auth, asyncHandler(generateContentFromMaterial));

export default router;