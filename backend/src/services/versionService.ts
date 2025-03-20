import { Types } from 'mongoose';
import { Content, IContent } from '../models/Content';

// Interface should match the schema in Content.ts
interface Version {
  versionNumber: number;
  content: {
    title: string;
    description: string;
    resources: Types.ObjectId[];
    syllabusData?: any;
  };
  changes: string[];
  createdAt: Date;
  createdBy: Types.ObjectId;
}

export class VersionService {
  async createVersion(contentId: string, userId: string, updates: any, changeDescription: string[]): Promise<Version> {
    try {
      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      // Initialize versions array if it doesn't exist
      if (!Array.isArray(content.versions)) {
        content.versions = [];
      }

      // Create new version with specific content fields
      const newVersion: Version = {
        versionNumber: content.versions.length + 1,
        content: {
          title: updates.title || content.title,
          description: updates.description || content.description,
          resources: updates.resources || content.resources || [],
          syllabusData: updates.syllabusData || content.syllabusData
        },
        changes: changeDescription,
        createdAt: new Date(),
        createdBy: new Types.ObjectId(userId)
      };

      // Add version to array
      content.versions.push(newVersion);
      content.currentVersion = newVersion.versionNumber;

      // Update content with new values
      if (updates.title) content.title = updates.title;
      if (updates.description) content.description = updates.description;
      if (updates.resources) content.resources = updates.resources;
      if (updates.syllabusData) content.syllabusData = updates.syllabusData;
      
      await content.save();
      return newVersion;
    } catch (error) {
      throw new Error(`Failed to create version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getVersion(contentId: string, versionNumber: number): Promise<Version> {
    try {
      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      const version = content.versions?.find(v => v.versionNumber === versionNumber);
      if (!version) {
        throw new Error('Version not found');
      }

      return version;
    } catch (error) {
      throw new Error(`Failed to get version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listVersions(contentId: string): Promise<Version[]> {
    try {
      const content = await Content.findById(contentId);
      if (!content) {
        throw new Error('Content not found');
      }

      return content.versions || [];
    } catch (error) {
      throw new Error(`Failed to list versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}