import express, { Request, Response } from 'express';
import { PresentationController } from '../controllers/presentationController';
import { auth } from '../middleware/auth';
import { SlideService } from '../services/slideService';
import mongoose from 'mongoose';
import { Subject } from '../models/Subject';

const router = express.Router();
const presentationController = new PresentationController();
const slideService = new SlideService();

// Define routes with proper controller methods
router.get('/', auth, presentationController.getAllPresentations);
router.get('/:id', auth, presentationController.getPresentation);
router.post('/', auth, presentationController.createPresentation);

/**
 * Generate a slide presentation from subject content
 */
router.post('/generate', auth, async (req: Request, res: Response) => {
  try {
    const { 
      subjectId, 
      templateStyle, 
      colorScheme, 
      slideCount, 
      includeImages,
      includeSpeakerNotes,
      focusAreas
    } = req.body;

    // Validate required fields
    if (!subjectId) {
      return res.status(400).json({ message: 'Subject ID is required' });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'Invalid subject ID format' });
    }

    // Check if subject exists
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check if syllabus has been analyzed
    if (!subject.syllabus || !subject.syllabus.analyzed) {
      return res.status(400).json({ 
        message: 'Subject has not been analyzed yet. Please analyze the syllabus first.' 
      });
    }

    // Generate the presentation
    const generationOptions = {
      templateStyle: templateStyle || 'modern',
      colorScheme: colorScheme || 'blue',
      slideCount: slideCount || 10,
      includeImages: includeImages !== undefined ? includeImages : true,
      includeSpeakerNotes: includeSpeakerNotes !== undefined ? includeSpeakerNotes : true,
      focusAreas: focusAreas || []
    };

    const presentation = await slideService.generateFromSubject(subjectId, generationOptions);
    
    // In a real implementation, this would save the presentation to the database
    res.status(200).json({
      message: 'Presentation generated successfully',
      presentation
    });
  } catch (error) {
    console.error('Error generating presentation:', error);
    res.status(500).json({ 
      message: 'Error generating presentation', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Export a presentation to a specific format
 */
router.post('/:id/export', auth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { format = 'pptx' } = req.body;
    
    if (!['pptx', 'pdf'].includes(format)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid format. Supported formats are pptx and pdf'
      });
    }

    // Get the file buffer from the service
    const fileBuffer = await slideService.exportPresentation(id, format as 'pptx' | 'pdf');
    
    // Set headers for file download
    res.setHeader('Content-Type', format === 'pptx' 
      ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
      : 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="presentation.${format}"`);
    
    // Send the file buffer
    return res.send(fileBuffer);
  } catch (error) {
    console.error(`Error exporting presentation:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error exporting presentation',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get presentations for a specific subject
 */
router.get('/subject/:subjectId', auth, async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json({ message: 'Invalid subject ID format' });
    }

    // In a real implementation, this would query presentations from a database
    // For now, return mock data
    res.status(200).json({
      presentations: [
        {
          id: 'pres1',
          title: 'Introduction to the Subject',
          slideCount: 10,
          templateStyle: 'modern',
          colorScheme: 'blue',
          createdAt: new Date().toISOString(),
          subjectId
        },
        {
          id: 'pres2',
          title: 'Key Concepts Overview',
          slideCount: 8,
          templateStyle: 'academic',
          colorScheme: 'green',
          createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          subjectId
        }
      ]
    });
  } catch (error) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ 
      message: 'Error fetching presentations', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;
