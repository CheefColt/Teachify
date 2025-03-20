import express from 'express';
import { PresentationController } from '../controllers/presentationController';
import { auth } from '../middleware/auth';

const router = express.Router();
const presentationController = new PresentationController();

// Define routes with proper controller methods
router.get('/', auth, presentationController.getAllPresentations);
router.get('/:id', auth, presentationController.getPresentation);
router.post('/', auth, presentationController.createPresentation);

export default router;
