import { Request, Response, NextFunction } from 'express';

export const validateLectureInput = (req: Request, res: Response, next: NextFunction) => {
    const { title, subjectId, scheduledDate, duration } = req.body;
    
    if (!title || !subjectId || !scheduledDate || !duration) {
        return res.status(400).json({ 
            message: 'Missing required fields: title, subjectId, scheduledDate, duration' 
        });
    }
    
    if (typeof duration !== 'number' || duration <= 0) {
        return res.status(400).json({ 
            message: 'Duration must be a positive number' 
        });
    }
    
    next();
};

export const validateLecturePlanInput = (req: Request, res: Response, next: NextFunction) => {
    const { subjectId, startDate, endDate, topics } = req.body;

    if (!subjectId || !startDate || !endDate || !topics) {
        return res.status(400).json({
            message: 'Missing required fields: subjectId, startDate, endDate, topics',
        });
    }

    if (!Array.isArray(topics) || topics.length === 0) {
        return res.status(400).json({
            message: 'Topics must be a non-empty array',
        });
    }

    if (new Date(startDate) >= new Date(endDate)) {
        return res.status(400).json({
            message: 'Start date must be before end date',
        });
    }

    next();
};