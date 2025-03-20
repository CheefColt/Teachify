import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ITeacher } from '../models/Teacher';
import { Teacher } from '../models/Teacher';
import mongoose from 'mongoose';

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Log the entire Authorization header for debugging
    console.log('Auth header:', req.header('Authorization'));
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token found' });
    }

    console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
    
    console.log('Received token:', token);
    
    try {
      // Verify the token and log the result
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      console.log('Token verification successful:', decoded);
      
      // Log the decoded token payload
      console.log('Decoded token payload:', decoded);
      
      // Check required fields
      if (!decoded.id) {
        console.log('Missing id in token payload');
        return res.status(401).json({ error: 'Invalid token: missing user ID' });
      }
      
      // Find the teacher by ID
      const teacher = await Teacher.findById(decoded.id);
      if (!teacher) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      // Transform the Mongoose document to match the expected user structure
      req.user = {
        id: teacher._id.toString(),  // Convert ObjectId to string and use "id" (not "_id")
        email: teacher.email,
        role: teacher.role
      };
      
      console.log('User authenticated:', req.user);
      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Please authenticate' });
  }
};