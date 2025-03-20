import { Request, Response } from 'express';
import { Presentation } from '../models/Presentation';
import { Types } from 'mongoose';
import { SlideService } from '../services/slideService';

export class PresentationController {
  private slideService: SlideService;

  constructor() {
    this.slideService = new SlideService();
  }

  getAllPresentations = async (req: Request, res: Response) => {
    try {
      const presentations = await Presentation.find().populate('content');
      res.json(presentations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch presentations' });
    }
  };

  getPresentation = async (req: Request, res: Response) => {
    try {
      const presentation = await Presentation.findById(req.params.id).populate('content');
      if (!presentation) {
        return res.status(404).json({ error: 'Presentation not found' });
      }
      res.json(presentation);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch presentation' });
    }
  };

  createPresentation = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title, description, contentId, slides } = req.body;
      
      if (!title || !contentId) {
        return res.status(400).json({ error: 'Title and content ID are required' });
      }

      const presentation = new Presentation({
        title,
        description,
        content: new Types.ObjectId(contentId),
        slides: slides || [],
        createdBy: new Types.ObjectId(req.user.id)
      });

      await presentation.save();
      res.status(201).json(presentation);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create presentation' 
      });
    }
  };
}