import { Resource, IResource } from '../models/Resource';
import { Types } from 'mongoose';

interface ResourcePool {
  [key: string]: IResource[];
}

export class ResourcePoolService {
  async poolResources(subjectId: string, contentIds: string[]): Promise<ResourcePool> {
    try {
      // Validate inputs
      if (!Types.ObjectId.isValid(subjectId)) {
        throw new Error('Invalid subject ID');
      }

      if (!Array.isArray(contentIds) || !contentIds.every(id => Types.ObjectId.isValid(id))) {
        throw new Error('Invalid content IDs');
      }

      const pooledResources = await Resource.find({
        $or: [
          { subject: new Types.ObjectId(subjectId) },
          { content: { $in: contentIds.map(id => new Types.ObjectId(id)) } }
        ]
      })
      .populate('content')
      .populate('subject')
      .lean();

      return this.categorizeResources(pooledResources);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to pool resources: ${error.message}`);
      }
      throw new Error('Failed to pool resources: Unknown error');
    }
  }

  private categorizeResources(resources: IResource[]): ResourcePool {
    return resources.reduce((acc: ResourcePool, resource: IResource) => {
      if (!acc[resource.type]) {
        acc[resource.type] = [];
      }
      acc[resource.type].push(resource);
      return acc;
    }, {});
  }
}