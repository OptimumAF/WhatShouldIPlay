import { serializePortableSnapshot } from "./portableSnapshot";

interface CloudSyncFileEntry {
  content?: string;
  raw_url?: string;
}

export class CloudSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudSyncError";
  }
}

export const updateSyncGist = async (params: {
  gistId: string;
  token: string;
  snapshot: unknown;
}) => {
  const response = await fetch(`https://api.github.com/gists/${params.gistId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.token}`,
      accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      files: {
        "whatshouldiplay-sync.json": {
          content: JSON.stringify(serializePortableSnapshot(params.snapshot), null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new CloudSyncError(`Cloud sync upload failed (${response.status}).`);
  }
};

export const createSyncGist = async (params: {
  token: string;
  snapshot: unknown;
}) => {
  const response = await fetch("https://api.github.com/gists", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${params.token}`,
      accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      description: "WhatShouldIPlay cloud sync",
      public: false,
      files: {
        "whatshouldiplay-sync.json": {
          content: JSON.stringify(serializePortableSnapshot(params.snapshot), null, 2),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new CloudSyncError(`Could not create gist (${response.status}).`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new CloudSyncError("GitHub API did not return gist id.");
  }
  return json.id;
};

const resolveSyncFile = (files: Record<string, CloudSyncFileEntry> | undefined) => {
  if (!files) {
    return undefined;
  }
  return files["whatshouldiplay-sync.json"] ?? Object.values(files)[0];
};

export const pullSyncSnapshot = async (params: {
  gistId: string;
  token: string;
  noFileError: string;
  emptyFileError: string;
}) => {
  const response = await fetch(`https://api.github.com/gists/${params.gistId}`, {
    headers: {
      authorization: `Bearer ${params.token}`,
      accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new CloudSyncError(`Cloud sync download failed (${response.status}).`);
  }

  const json = (await response.json()) as {
    files?: Record<string, CloudSyncFileEntry>;
  };

  const file = resolveSyncFile(json.files);
  if (!file) {
    throw new CloudSyncError(params.noFileError);
  }

  let content = file.content ?? "";
  if (!content && file.raw_url) {
    const raw = await fetch(file.raw_url);
    if (!raw.ok) {
      throw new CloudSyncError(`Failed to load gist raw file (${raw.status}).`);
    }
    content = await raw.text();
  }
  if (!content) {
    throw new CloudSyncError(params.emptyFileError);
  }
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new CloudSyncError("Sync file is not valid JSON.");
  }
};
