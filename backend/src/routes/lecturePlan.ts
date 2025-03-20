import { Router, Response, Request, NextFunction } from 'express';
import { LecturePlan } from '../models/LecturePlan';
import { protect } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthenticatedRequest, CreateLectureRequest, GenerateOutlineRequest, UpdateLectureRequest } from '../types/lecture';
import logger from '../utils/logger';

// Type-safe middleware wrapper
const withAuthenticatedRequest = (
  handler: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => void
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.teacher) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    return handler(authReq, res, next);
  };
};

const validateLecturePlanInput = withAuthenticatedRequest((
  req: AuthenticatedRequest<{ subjectId: string; planId: string; }, any, CreateLectureRequest | GenerateOutlineRequest | UpdateLectureRequest>,
  res: Response,
  next: NextFunction
) => {
  const { subjectId, startDate, endDate, topics, resources } = req.body;
  if (!subjectId || !startDate || !endDate) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ message: 'End date must be after start date' });
  }
  if (topics && !Array.isArray(topics)) {
    return res.status(400).json({ message: 'Topics must be an array' });
  }
  if (resources && !Array.isArray(resources)) {
    return res.status(400).json({ message: 'Resources must be an array' });
  }
  next();
});

export const lecturePlanRouter = Router();

// Create a new lecture plan
lecturePlanRouter.post(
  '/',
  protect,
  validateLecturePlanInput,
  asyncHandler(async (req: AuthenticatedRequest<{ subjectId: string; planId: string; }, any, CreateLectureRequest>, res: Response) => {
    try {
      const { subjectId, startDate, endDate, topics, resources } = req.body;
      const lecturePlan = new LecturePlan({
        subjectId,
        teacherId: req.teacher._id,
        startDate,
        endDate,
        topics,
        resources,
      });
      await lecturePlan.save();
      logger.info(`Lecture plan created: ${lecturePlan._id}`);
      res.status(201).json(lecturePlan);
    } catch (error) {
      logger.error('Error creating lecture plan:', error);
      res.status(500).json({ message: 'Failed to create lecture plan' });
    }
  })
);

// Get all lecture plans for a subject
lecturePlanRouter.get(
  '/subject/:subjectId',
  protect,
  asyncHandler(async (req: AuthenticatedRequest<{ subjectId: string; planId: string; }, any, any>, res: Response) => {
    try {
      const lecturePlans = await LecturePlan.find({
        subjectId: req.params.subjectId,
        teacherId: req.teacher._id,
      });
      logger.info(`Fetched lecture plans for subject: ${req.params.subjectId}`);
      res.json(lecturePlans);
    } catch (error) {
      logger.error('Error fetching lecture plans:', error);
      res.status(500).json({ message: 'Failed to fetch lecture plans' });
    }
  })
);

// Update or delete a lecture plan
lecturePlanRouter
  .route('/:planId')
  .put(
    protect,
    validateLecturePlanInput,
    asyncHandler(async (req: AuthenticatedRequest<{ subjectId: string; planId: string; }, any, UpdateLectureRequest>, res: Response) => {
      try {
        const lecturePlan = await LecturePlan.findByIdAndUpdate(
          req.params.planId,
          req.body,
          { new: true }
        );
        logger.info(`Lecture plan updated: ${req.params.planId}`);
        res.json(lecturePlan);
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error('Error updating lecture plan:', error.message);
        } else {
          logger.error('Unknown error updating lecture plan');
        }
        res.status(500).json({ message: 'Failed to update lecture plan' });
      }
    })
  )
  .delete(
    protect,
    asyncHandler(async (req: AuthenticatedRequest<{ subjectId: string; planId: string; }, any, any>, res: Response) => {
      try {
        await LecturePlan.findByIdAndDelete(req.params.planId);
        logger.info(`Lecture plan deleted: ${req.params.planId}`);
        res.json({ message: 'Lecture plan deleted' });
      } catch (error: unknown) {
        if (error instanceof Error) {
          logger.error('Error deleting lecture plan:', error.message);
        } else {
          logger.error('Unknown error deleting lecture plan');
        }
        res.status(500).json({ message: 'Failed to delete lecture plan' });
      }
    })
  );
