import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/lecture';

// Type-safe async handler
export const asyncHandler = (
    fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthenticatedRequest;
        if (!authReq.teacher) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        Promise.resolve(fn(authReq, res, next)).catch(next);
    };
};
