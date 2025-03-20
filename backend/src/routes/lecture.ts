// import { Router, Request, Response } from 'express';
// import { RequestHandler } from 'express-serve-static-core';
// import mongoose from 'mongoose';
// import { protect } from '../middleware/auth';
// import { validateLectureInput } from '../middleware/validation';
// import { Lecture, ILecture, Slide } from '../models/Lecture';
// import { Subject } from '../models/Subject';
// import { ITeacher } from '../models/Teacher';
// import { ContentGenerator } from '../services/ai/contentGenerator';
// import { AnalyzedTopic } from '../services/ai/syllabusAnalyzer';
// import { 
//     AuthHandler, 
//     AuthenticatedRequest,
//     CreateLectureRequest,
//     UpdateLectureRequest,
//     UpdateSlidesRequest,
//     GenerateOutlineRequest 
// } from '../types/lecture';

// const router = Router();
// const contentGenerator = new ContentGenerator();

// // Type-safe async handler
// const asyncHandler = (fn: AuthHandler): RequestHandler => (
//     req: Request,
//     res: Response,
//     next
// ) => {
//     const authReq = req as AuthenticatedRequest;
//     if (!authReq.teacher) {
//         return res.status(401).json({ message: 'Not authenticated' });
//     }
//     Promise.resolve(fn(authReq, res)).catch(next);
// };

// // Type-safe create lecture handler
// const createLecture: AuthHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
//     try {
//         const { subjectId, title, content, scheduledDate, duration } = req.body as CreateLectureRequest;
        
//         const subject = await Subject.findOne({ 
//             _id: subjectId, 
//             teacher: req.teacher._id 
//         });
        
//         if (!subject) {
//             res.status(404).json({ message: 'Subject not found' });
//             return;
//         }

//         const lecture = await Lecture.create({
//             subject: subjectId,
//             title,
//             content,
//             scheduledDate,
//             duration,
//             teacher: req.teacher._id
//         });

//         res.status(201).json(lecture);
//     } catch (error) {
//         console.error('Error creating lecture:', error);
//         res.status(500).json({ message: 'Failed to create lecture' });
//     }
// };

// // Get lectures by subject
// const getSubjectLectures: AuthHandler = async (req: AuthenticatedRequest & { params: { subjectId: string } }, res: Response): Promise<void> => {
//     try {
//         const { subjectId } = req.params;
        
//         const lectures = await Lecture.find({ subject: subjectId, teacher: req.teacher._id });

//         if (!lectures.length) {
//             res.status(404).json({ message: 'No lectures found for this subject' });
//             return;
//         }

//         res.json(lectures);
//     } catch (error) {
//         console.error('Error retrieving lectures:', error);
//         res.status(500).json({ message: 'Failed to retrieve lectures' });
//     }
// };

// // Update lecture handler
// const updateLecture: AuthHandler = async (req: AuthenticatedRequest & { params: { lectureId: string } }, res: Response): Promise<void> => {
//     try {
//         if (req.params.lectureId !== undefined) {
//             const lectureId: string = req.params.lectureId;
//             const updates = req.body as UpdateLectureRequest;

//             const lecture = await Lecture.findOneAndUpdate(
//                 { _id: lectureId, teacher: req.teacher._id },
//                 updates,
//                 { new: true }
//             );

//             if (!lecture) {
//                 res.status(404).json({ message: 'Lecture not found or unauthorized' });
//                 return;
//             }

//             res.json(lecture);
//         } else {
//             res.status(400).json({ message: 'Lecture ID is required' });
//         }
//     } catch (error) {
//         console.error('Error updating lecture:', error);
//         res.status(500).json({ message: 'Failed to update lecture' });
//     }
// };

// // Validation helper with proper type checking
// const validateSlides = (slides: unknown): slides is Slide[] => {
//     if (!Array.isArray(slides)) return false;
    
//     return slides.every(slide => {
//         if (!slide || typeof slide !== 'object') return false;
        
//         const isSlide = (
//             'title' in slide &&
//             typeof slide.title === 'string' &&
//             'content' in slide &&
//             Array.isArray(slide.content) &&
//             slide.content.every((item: unknown) => typeof item === 'string') &&
//             (!('notes' in slide) || typeof slide.notes === 'string') &&
//             (!('imagePrompt' in slide) || typeof slide.imagePrompt === 'string')
//         );
        
//         if (!isSlide) {
//             console.warn('Invalid slide format:', slide);
//         }
//         return isSlide;
//     });
// };

// // Authorization helper with error handling
// const checkLectureAuthorization = async (
//     lectureId: string,
//     teacherId: mongoose.Types.ObjectId
// ): Promise<ILecture | null> => {
//     if (!lectureId || !teacherId) {
//         throw new Error('Invalid lectureId or teacherId');
//     }

//     try {
//         const lecture = await Lecture.findOne({
//             _id: lectureId,
//             subject: {
//                 $in: await Subject.find({ teacher: teacherId }).select('_id')
//             }
//         });

//         if (!lecture) {
//             console.warn(`Lecture ${lectureId} not found or unauthorized`);
//         }

//         return lecture;
//     } catch (error) {
//         console.error('Error checking lecture authorization:', error);
//         throw error;
//     }
// };

// // Update lecture slides with proper validation and authorization
// const updateSlides: AuthHandler = async (req: AuthenticatedRequest & { params: { lectureId: string } }, res: Response): Promise<void> => {
//     try {
//         if (req.params.lectureId !== undefined) {
//             const lectureId: string = req.params.lectureId;
//             const slides = req.body.slides as Slide[];

//             const lecture = await checkLectureAuthorization(lectureId, req.teacher._id);
//             if (!lecture) {
//                 res.status(404).json({ message: 'Lecture not found or unauthorized' });
//                 return;
//             }

//             lecture.slides = slides;
//             lecture.status = 'completed';
//             await lecture.save();

//             const updatedLecture = await Lecture.findById(lecture._id).populate('subject', 'name');

//             res.json(updatedLecture);
//         } else {
//             res.status(400).json({ message: 'Lecture ID is required' });
//         }
//     } catch (error) {
//         console.error('Error updating slides:', error);
//         res.status(500).json({ message: 'Failed to update slides' });
//     }
// };

// // Generate lecture content
// const generateLectureContent: AuthHandler = async (req: AuthenticatedRequest & { params: { subjectId: string } }, res: Response): Promise<void> => {
//     try {
//         const { subjectId } = req.params;
//         const { analyzedTopic } = req.body as GenerateOutlineRequest;

//         if (!analyzedTopic) {
//             res.status(400).json({ message: 'Analyzed topic is required' });
//             return;
//         }

//         const subject = await Subject.findOne({
//             _id: subjectId,
//             teacher: req.teacher._id
//         });

//         if (!subject) {
//             res.status(404).json({ message: 'Subject not found' });
//             return;
//         }

//         const content = await contentGenerator.generateContent({
//             topic: analyzedTopic.title,
//             subtopics: analyzedTopic.subtopics
//         });

//         res.json(content);
//     } catch (error) {
//         console.error('Error generating lecture content:', error);
//         res.status(500).json({ message: 'Failed to generate lecture content' });
//     }
// };

// // Generate lecture outline
// const generateOutline: AuthHandler = async (req: AuthenticatedRequest & { params: { lectureId: string } }, res: Response): Promise<void> => {
//     if (req.params.lectureId !== undefined) {
//         const lectureId: string = req.params.lectureId;
//         const { context } = req.body as GenerateOutlineRequest;

//         try {
//             const lecture = await Lecture.findOne({
//                 _id: lectureId,
//                 teacher: req.teacher._id
//             });

//             if (!lecture) {
//                 res.status(404).json({ message: 'Lecture not found' });
//                 return;
//             }

//             const outline = await contentGenerator.generateLectureOutline(
//                 lecture.title,
//                 context
//             );

//             console.log('Generated Outline:', outline); // Debugging line

//             lecture.outline = outline;
//             await lecture.save();

//             res.json(lecture);
//         } catch (error) {
//             console.error('Error generating lecture outline:', error);
//             res.status(500).json({ message: 'Failed to generate lecture outline' });
//         }
//     } else {
//         res.status(400).json({ message: 'Lecture ID is required' });
//     }
// };

// // Routes with validation
// router.post('/', protect, validateLectureInput, asyncHandler(createLecture));
// router.get('/subject/:subjectId', protect, asyncHandler(getSubjectLectures));
// router.put('/:lectureId', protect, validateLectureInput, asyncHandler(updateLecture));
// router.put('/:lectureId/slides', protect, asyncHandler(updateSlides));
// router.post('/generate/:subjectId', protect, asyncHandler(generateLectureContent));
// router.post('/:lectureId/outline', protect, asyncHandler(generateOutline));

import express from 'express';
import { LectureController } from '../controllers/lectureController';
import { auth } from '../middleware/auth';

const router = express.Router();
const lectureController = new LectureController();

// Basic CRUD routes
router.get('/', auth, lectureController.getAllLectures);
router.get('/:id', auth, lectureController.getLecture);
router.post('/', auth, lectureController.createLecture);

export default router;
