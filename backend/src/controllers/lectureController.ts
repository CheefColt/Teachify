import { Request, Response } from 'express';
import { Lecture } from '../models/Lecture';
import { Types } from 'mongoose';

export class LectureController {
  // Get all lectures
  getAllLectures = async (req: Request, res: Response) => {
    try {
      const lectures = await Lecture.find()
        .populate('content')
        .populate('createdBy');
      res.json(lectures);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lectures' });
    }
  };

  // Get single lecture
  getLecture = async (req: Request, res: Response) => {
    try {
      const lecture = await Lecture.findById(req.params.id)
        .populate('content')
        .populate('createdBy');
      
      if (!lecture) {
        return res.status(404).json({ error: 'Lecture not found' });
      }
      
      res.json(lecture);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch lecture' });
    }
  };

  // Create lecture
  createLecture = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title, description, contentId, slides } = req.body;
      
      if (!title || !contentId) {
        return res.status(400).json({ error: 'Title and content ID are required' });
      }

      const lecture = new Lecture({
        title,
        description,
        content: new Types.ObjectId(contentId),
        slides: slides || [],
        createdBy: new Types.ObjectId(req.user.id)
      });

      await lecture.save();
      res.status(201).json(lecture);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create lecture' 
      });
    }
  };
}