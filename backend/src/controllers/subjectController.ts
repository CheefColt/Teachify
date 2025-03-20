import { Request, Response } from 'express';
import { Subject } from '../models/Subject';
import { Types } from 'mongoose';

export class SubjectController {
  // Use arrow functions to preserve 'this' context
  getAllSubjects = async (req: Request, res: Response) => {
    try {
      const subjects = await Subject.find();
      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch subjects' });
    }
  };

  getSubject = async (req: Request, res: Response) => {
    try {
      const subject = await Subject.findById(req.params.id);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      res.json(subject);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch subject' });
    }
  };

  createSubject = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { name, description } = req.body;
      
      if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
      }

      const subject = new Subject({
        name,
        description,
        createdBy: new Types.ObjectId(req.user.id)
      });

      await subject.save();
      res.status(201).json(subject);
    } catch (error) {
      console.error('Create subject error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create subject' 
      });
    }
  };

  updateSubject = async (req: Request, res: Response) => {
    try {
      const subject = await Subject.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      res.json(subject);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update subject' });
    }
  };

  deleteSubject = async (req: Request, res: Response) => {
    try {
      const subject = await Subject.findByIdAndDelete(req.params.id);
      if (!subject) {
        return res.status(404).json({ error: 'Subject not found' });
      }
      res.json({ message: 'Subject deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete subject' });
    }
  };
}