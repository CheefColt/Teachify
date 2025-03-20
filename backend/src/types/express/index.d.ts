import { ITeacher } from '../../models/Teacher';

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        role: string;
      };
      teacher?: ITeacher;
    }
  }
}