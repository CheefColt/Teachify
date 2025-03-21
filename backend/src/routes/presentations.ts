import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { SlideService } from '../services/slideService';
import mongoose from 'mongoose';

const router = Router();
const slideService = new SlideService();

/**
 * Generate a presentation for a subject
 * Requires subject ID and customization options
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
    
    // Store the presentation (in a real implementation, this would save to database)
    // For now, just return the generated content
    res.status(200).json({
      message: 'Presentation generated successfully',
      presentation
    });
  } catch (error) {
    console.error('Error generating presentation:', error);
    if (error instanceof Error && error.message.includes('not been analyzed')) {
      return res.status(400).json({ message: error.message });
    }
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
    const { format } = req.body;

    if (!format || !['pptx', 'pdf'].includes(format)) {
      return res.status(400).json({ message: 'Valid format (pptx or pdf) is required' });
    }

    const downloadUrl = await slideService.exportPresentation(id, format as 'pptx' | 'pdf');
    
    res.status(200).json({
      message: `Presentation exported to ${format} successfully`,
      downloadUrl
    });
  } catch (error) {
    console.error(`Error exporting presentation:`, error);
    res.status(500).json({ 
      message: 'Error exporting presentation', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * Mock endpoint to fetch all presentations for a subject
 * In a real implementation, this would query from a database
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