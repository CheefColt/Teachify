import { Request, Response } from 'express';
import { Resource, IResource } from '../models/Resource';
import { Content, IContent } from '../models/Content';
import { Types } from 'mongoose';
import path from 'path';
import fs from 'fs/promises';
import { ResourcePoolService } from '../services/resourcePoolService';

export class ResourceController {
  private resourcePoolService: ResourcePoolService;

  constructor() {
    this.resourcePoolService = new ResourcePoolService();
  }

  async getPooledResources(req: Request, res: Response) {
    try {
      const { subjectId, contentIds } = req.body;
      const pooledResources = await this.resourcePoolService.poolResources(
        subjectId, 
        contentIds
      );
      res.json(pooledResources);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  }

  // Get all resources
  getAllResources = async (req: Request, res: Response) => {
    try {
      const resources = await Resource.find().populate('subject').populate('content');
      res.json(resources);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch resources' });
    }
  };

  // Get single resource
  getResource = async (req: Request, res: Response) => {
    try {
      const resource = await Resource.findById(req.params.id)
        .populate('subject')
        .populate('content');
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json(resource);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch resource' });
    }
  };

  // Create resource
  createResource = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { title, description, type, subjectId, contentId, url } = req.body;
      
      if (!title || !type || !subjectId) {
        return res.status(400).json({ error: 'Title, type, and subject ID are required' });
      }

      const resource = new Resource({
        title,
        description,
        type,
        url,
        subject: new Types.ObjectId(subjectId),
        content: contentId ? new Types.ObjectId(contentId) : undefined,
        createdBy: new Types.ObjectId(req.user.id)
      });

      await resource.save();
      res.status(201).json(resource);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create resource' 
      });
    }
  };

  // Update resource
  updateResource = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const resource = await Resource.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json(resource);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update resource' });
    }
  };

  // Delete resource
  deleteResource = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const resource = await Resource.findByIdAndDelete(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      
      res.json({ message: 'Resource deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete resource' });
    }
  };

  // Upload file resource
  uploadResource = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { contentId } = req.params;
      
      if (!Types.ObjectId.isValid(contentId)) {
        return res.status(400).json({ error: 'Invalid content ID' });
      }

      const content = await Content.findById(contentId) as IContent;
      if (!content) {
        // Delete uploaded file if content doesn't exist
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(404).json({ error: 'Content not found' });
      }

      const fileResource = new Resource({
        title: req.file.originalname,
        description: 'Uploaded file',
        type: 'file',
        filePath: req.file.path,
        url: `/uploads/${req.file.filename}`,
        subject: content.subject, // Now TypeScript knows this property exists
        content: new Types.ObjectId(contentId),
        createdBy: new Types.ObjectId(req.user.id),
        linkType: 'primary'
      });

      await fileResource.save();
      
      res.status(201).json(fileResource);
    } catch (error) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to upload resource' 
      });
    }
  };

  // Delete file
  deleteFile = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { contentId, fileId } = req.params;
      
      if (!Types.ObjectId.isValid(contentId) || !Types.ObjectId.isValid(fileId)) {
        return res.status(400).json({ error: 'Invalid content or file ID' });
      }

      const resource = await Resource.findById(fileId);
      if (!resource) {
        return res.status(404).json({ error: 'File resource not found' });
      }

      // Check if file exists and delete it
      if (resource.filePath) {
        await fs.unlink(resource.filePath).catch(err => {
          console.error('Error deleting file:', err);
        });
      }

      // Delete the resource
      await Resource.findByIdAndDelete(fileId);
      
      res.json({ message: 'File deleted successfully' });
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete file' 
      });
    }
  };
}