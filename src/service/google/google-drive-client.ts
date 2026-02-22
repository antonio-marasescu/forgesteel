/**
 * Google Drive API Client
 *
 * Wrapper for Google Drive REST API v3 operations.
 * Handles file CRUD operations for storing Forgesteel data as JSON files.
 */

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

interface DriveListResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

export class GoogleDriveClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Update the access token (e.g., after refresh)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Make an authenticated request to Google Drive API
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Google Drive API error: ${response.status} ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    // Handle empty responses (e.g., DELETE)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return {} as T;
  }

  /**
   * List folders in the user's Drive (or within a specific folder)
   * If no parentId is provided, lists folders in the root of My Drive
   */
  async listFolders(parentId?: string): Promise<DriveFolder[]> {
    // If no parentId specified, use 'root' to get folders at the root of My Drive
    const parent = parentId || 'root';
    const query = `mimeType='application/vnd.google-apps.folder' and '${parent}' in parents and trashed=false`;

    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: '100',
    });

    const response = await this.request<DriveListResponse>(`${DRIVE_API_BASE}/files?${params}`);

    return response.files.map(f => ({ id: f.id, name: f.name }));
  }

  /**
   * Create a new folder in Google Drive
   */
  async createFolder(name: string, parentId?: string): Promise<string> {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      metadata.parents = [parentId];
    }

    const response = await this.request<DriveFile>(`${DRIVE_API_BASE}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    return response.id;
  }

  /**
   * Find a file by name within a specific folder
   */
  async findFile(name: string, folderId: string): Promise<DriveFile | null> {
    const query = `name='${name}' and '${folderId}' in parents and trashed=false`;

    const params = new URLSearchParams({
      q: query,
      fields: 'files(id,name,mimeType,modifiedTime)',
      pageSize: '1',
    });

    const response = await this.request<DriveListResponse>(`${DRIVE_API_BASE}/files?${params}`);

    return response.files.length > 0 ? response.files[0] : null;
  }

  /**
   * Read a file's content and parse as JSON
   */
  async readFile<T>(fileId: string): Promise<T> {
    const params = new URLSearchParams({
      alt: 'media',
    });

    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Write (create or update) a JSON file to Google Drive
   * If fileId is provided, updates existing file; otherwise creates new file
   */
  async writeFile<T>(name: string, content: T, folderId: string, fileId?: string): Promise<string> {
    const jsonContent = JSON.stringify(content, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });

    if (fileId) {
      // Update existing file
      const params = new URLSearchParams({
        uploadType: 'media',
      });

      const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?${params}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: blob,
      });

      if (!response.ok) {
        throw new Error(`Failed to update file: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    } else {
      // Create new file using multipart upload
      const metadata = {
        name,
        parents: [folderId],
        mimeType: 'application/json',
      };

      const boundary = '-------forgesteel_boundary';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        jsonContent +
        closeDelimiter;

      const params = new URLSearchParams({
        uploadType: 'multipart',
        fields: 'id',
      });

      const response = await fetch(`${UPLOAD_API_BASE}/files?${params}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (!response.ok) {
        throw new Error(`Failed to create file: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.id;
    }
  }

  /**
   * Get file metadata including modification time
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    const params = new URLSearchParams({
      fields: 'id,name,mimeType,modifiedTime,size',
    });

    return this.request<FileMetadata>(`${DRIVE_API_BASE}/files/${fileId}?${params}`);
  }

  /**
   * Delete a file from Google Drive
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.request<void>(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Check if a folder exists and is accessible
   */
  async checkFolderAccess(folderId: string): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        fields: 'id,name,mimeType',
      });

      const response = await this.request<DriveFile>(
        `${DRIVE_API_BASE}/files/${folderId}?${params}`,
      );

      return response.mimeType === 'application/vnd.google-apps.folder';
    } catch {
      return false;
    }
  }
}
