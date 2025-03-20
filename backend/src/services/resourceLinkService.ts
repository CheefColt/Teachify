import { Types } from 'mongoose';
import { Resource, IResource } from '../models/Resource';
import { Content, IContent } from '../models/Content';

export class ResourceLinkService {
  async linkResourceToContent(
    resourceId: string,
    contentId: string,
    linkType: 'primary' | 'supplementary'
  ): Promise<IResource> {
    const session = await Resource.startSession();
    session.startTransaction();

    try {
      // Validate IDs
      if (!Types.ObjectId.isValid(resourceId) || !Types.ObjectId.isValid(contentId)) {
        throw new Error('Invalid resource or content ID');
      }

      const resource = await Resource.findById(resourceId).session(session);
      const content = await Content.findById(contentId).session(session);

      if (!resource || !content) {
        throw new Error('Resource or Content not found');
      }

      // Update resource with content reference
      resource.content = new Types.ObjectId(contentId);
      resource.linkType = linkType;
      await resource.save({ session });

      // Update content with resource reference
      if (!Array.isArray(content.resources)) {
        content.resources = [];
      }
      
      const resourceObjectId = new Types.ObjectId(resourceId);
      if (!content.resources.some(id => id.equals(resourceObjectId))) {
        content.resources.push(resourceObjectId);
        await content.save({ session });
      }

      await session.commitTransaction();
      return resource;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to link resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      session.endSession();
    }
  }
}