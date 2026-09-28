import { cloudSyncSnapshotSchema, type CloudSyncSnapshot } from "./appSchemas";

/** Only the schema's named portable fields may cross a sync or restore boundary. */
export const serializePortableSnapshot = (candidate: unknown): CloudSyncSnapshot =>
  cloudSyncSnapshotSchema.parse(candidate);
