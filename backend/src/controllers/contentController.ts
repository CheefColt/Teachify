import { Request, Response } from 'express';
import { Content } from '../models/Content';
import { Types } from 'mongoose';
import { SyllabusService } from '../services/syllabusService';

export class ContentController {
  private syllabusService: SyllabusService;

  constructor() {
    this.syllabusService = new SyllabusService();
  }

  getAllContent = async (req: Request, res: Response) => {
    try {
      const contents = await Content.find().populate('subject');
      res.json(contents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contents' });
    }
  };

  getContent = async (req: Request, res: Response) => {
    try {
      const content = await Content.findById(req.params.id).populate('subject');
      if (!content) {
        return res.status(404).json({ error: 'Content not found' });
      }
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch content' });
    }
  };

  createContent = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title, description, syllabusText, subjectId } = req.body;

      if (!title || !description || !subjectId) {
        return res.status(400).json({ error: 'Title, description and subject ID are required' });
      }

      // Process syllabus if provided
      let syllabusData = {};
      if (syllabusText) {
        syllabusData = await this.syllabusService.processSyllabus(syllabusText);
      }

      const content = new Content({
        title,
        description,
        subject: new Types.ObjectId(subjectId),
        syllabusData,
        createdBy: new Types.ObjectId(req.user.id)
      });

      await content.save();
      res.status(201).json(content);
    } catch (error) {
      console.error('Create content error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create content' 
      });
    }
  };

  // Add other controller methods here
}