// import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
// import { protect } from '../middleware/auth';
// import { Content } from '../models/Content';
// import { ITeacher } from '../models/Teacher';
// import { ContentGenerator, ContentGenerationParams } from '../services/ai/contentGenerator';

// interface AuthenticatedRequest extends Request {
//     teacher: ITeacher;
// }

// type AuthHandler = (
//     req: AuthenticatedRequest,
//     res: Response
// ) => Promise<any>;

// const router = Router();
// const contentGenerator = new ContentGenerator();

// // Error handler wrapper
// const asyncHandler = (fn: AuthHandler): RequestHandler => (
//     req: Request,
//     res: Response,
//     next: NextFunction
// ) => Promise.resolve(fn(req as AuthenticatedRequest, res)).catch(next);

// // Create new content
// const createContent: AuthHandler = async (req, res) => {
//     const { subjectId, title, description, type } = req.body;
    
//     const content = await Content.create({
//         subject: subjectId,
//         title,
//         description,
//         type,
//         files: [],
//         status: 'draft'
//     });

//     res.status(201).json(content);
// };

// // Get content by subject
// const getSubjectContent: AuthHandler = async (req, res) => {
//     const { subjectId } = req.params;
//     const content = await Content.find({ subject: subjectId });
//     res.json(content);
// };

// // Get content by id
// const getContent: AuthHandler = async (req, res) => {
//     const { id } = req.params;
//     const content = await Content.findById(id);
//     res.json(content);
// };

// // Update content
// const updateContent: AuthHandler = async (req, res) => {
//     const { id } = req.params;
//     const updates = req.body;

//     const content = await Content.findOneAndUpdate(
//         { _id: id, subject: { $in: req.teacher.subjects } },
//         updates,
//         { new: true }
//     );

//     if (!content) {
//         return res.status(404).json({ message: 'Content not found or unauthorized' });
//     }

//     res.json(content);
// };

// // Delete content
// const deleteContent: AuthHandler = async (req, res) => {
//     const { id } = req.params;

//     const content = await Content.findOneAndDelete({
//         _id: id,
//         subject: { $in: req.teacher.subjects }
//     });

//     if (!content) {
//         return res.status(404).json({ message: 'Content not found or unauthorized' });
//     }

//     res.json({ message: 'Content deleted successfully' });
// };

// // Generate new content
// router.post('/generate', protect, async (req, res) => {
//     try {
//         const params: ContentGenerationParams = req.body;
        
//         if (!params.topic) {
//             return res.status(400).json({ error: 'Topic is required' });
//         }

//         const content = await contentGenerator.generateContent(params);
//         res.json(content);
//     } catch (error: any) {
//         console.error('Content generation error:', error);
//         res.status(500).json({ error: error?.message || 'Content generation failed' });
//     }
// });

// // Enhance existing content
// router.post('/enhance', protect, async (req, res) => {
//     try {
//         const { existingContent, newInformation } = req.body;
        
//         if (!existingContent || !newInformation) {
//             return res.status(400).json({ error: 'Both existing content and new information are required' });
//         }

//         const enhancedContent = await contentGenerator.enhanceContent(existingContent, newInformation);
//         res.json(enhancedContent);
//     } catch (error: any) {
//         console.error('Content enhancement error:', error);
//         res.status(500).json({ error: error?.message || 'Content enhancement failed' });
//     }
// });

// // Routes
// router.post('/', protect, asyncHandler(createContent));
// router.get('/subject/:subjectId', protect, asyncHandler(getSubjectContent));
// router.get('/:id', protect, asyncHandler(getContent));
// router.put('/:id', protect, asyncHandler(updateContent));
// router.delete('/:id', protect, asyncHandler(deleteContent));
import express from 'express';
import { ContentController } from '../controllers/contentController';
import { auth } from '../middleware/auth';

const router = express.Router();
const contentController = new ContentController();

router.get('/', auth, contentController.getAllContent);
router.get('/:id', auth, contentController.getContent);
router.post('/', auth, contentController.createContent);

export default router;
