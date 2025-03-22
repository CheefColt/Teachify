import express, { Request, Response } from 'express';
import { auth } from '../middleware/auth';
import { GeminiService } from '../services/geminiService';

const router = express.Router();
const geminiService = new GeminiService();

/**
 * Generate slides directly using Gemini API
 */
router.post('/generate-slides', auth, async (req: Request, res: Response) => {
  try {
    const { 
      topic,
      content,
      style = 'modern',
      slideCount = 10,
      includeSpeakerNotes = true
    } = req.body;

    if (!topic) {
      return res.status(400).json({ message: 'Topic is required' });
    }

    // Generate slides with Gemini
    const slideOutline = await geminiService.generateSlideOutline(
      topic,
      content || '',
      style,
      slideCount,
      includeSpeakerNotes
    );

    res.status(200).json(slideOutline);
  } catch (error) {
    console.error('Error generating slides with Gemini:', error);
    res.status(500).json({ 
      message: 'Error generating slides', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router; 