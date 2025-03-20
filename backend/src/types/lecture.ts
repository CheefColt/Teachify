import { Slide } from '../models/Lecture';
import { Response, Request } from 'express';
import { ITeacher } from '../models/Teacher';

export interface RouteParams {
    [key: string]: string;
    subjectId: string;
    planId: string;
    lectureId: string;
}

export interface AuthenticatedRequest<P extends RouteParams = RouteParams, ResBody = any, ReqBody = any> extends Request<P, ResBody, ReqBody> {
    user: ITeacher & {
        id: string;      // Required
        email: string;   // Required
        role: string;    // Required
    };
    teacher: ITeacher;
}

export type AuthHandler = (
    req: AuthenticatedRequest,
    res: Response
) => Promise<void>;


export interface CreateLectureRequest {
    subjectId: string;
    title: string;
    slides: Slide[];
    content: {
        resources: string[];
        estimatedDuration: number;
    };
    scheduledDate: string;
    duration: number;
    startDate: string;
    endDate: string;
    topics: string[];
    resources: string[];
}

export interface UpdateLectureRequest {
    subjectId?: string;
    title?: string;
    slides?: Slide[];
    content?: {
        resources: string[];
        estimatedDuration: number;
    };
    scheduledDate?: string;
    duration?: number;
    status?: 'planned' | 'completed';
    startDate?: string;
    endDate?: string;
    topics?: string[];
    resources?: string[];
}

export interface UpdateSlidesRequest {
    slides: Slide[];
}

export interface GenerateOutlineRequest {
    context: string;
    analyzedTopic?: {
        title: string;
        subtopics: string[];
    };
    subjectId: string;
    startDate: string;
    endDate: string;
    topics: string[];
    resources: string[];
}

export interface LectureOutline {
    sections: {
        title: string;
        content: string;
    }[];
    keyPoints: string[];
    examples: string[];
    exercises: string[];
}