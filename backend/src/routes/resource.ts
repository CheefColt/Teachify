import express from 'express';
import { auth } from '../middleware/auth';
import { Resource, IResource } from '../models/Resource'; 
import { Content } from '../models/Content';
import { Types } from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { ResourceController } from '../controllers/resourceController';

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });
const router = express.Router();
const resourceController = new ResourceController();

// Basic CRUD routes
router.get('/', auth, resourceController.getAllResources);
router.get('/:id', auth, resourceController.getResource);
router.post('/', auth, resourceController.createResource);
router.put('/:id', auth, resourceController.updateResource);
router.delete('/:id', auth, resourceController.deleteResource);

// File upload route
router.post(
  '/:contentId/upload',
  auth,
  upload.single('file'),
  resourceController.uploadResource
);

// File deletion route
router.delete(
  '/:contentId/files/:fileId',
  auth,
  resourceController.deleteFile
);

export default router;