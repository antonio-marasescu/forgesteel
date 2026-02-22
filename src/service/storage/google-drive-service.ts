/**
 * Google Drive Storage Service
 *
 * Implements the StorageService interface for Google Drive.
 * Stores Forgesteel data as JSON files in a user-selected Google Drive folder.
 *
 * File mapping:
 *   Storage Key                 -> Drive File
 *   forgesteel-heroes           -> forgesteel-heroes.json
 *   forgesteel-homebrew-settings -> forgesteel-homebrew.json
 *   forgesteel-session          -> forgesteel-session.json
 *   forgesteel-options          -> forgesteel-options.json
 *   forgesteel-hidden-setting-ids -> forgesteel-hidden-ids.json
 */

import { DriveFile, GoogleDriveClient } from '@/service/google/google-drive-client';

import { ConnectionSettings } from '@/models/connection-settings';
import { GoogleAuthService } from '@/service/google/google-auth-service';
import { StorageService } from '@/service/storage/storage-service';

// Maps storage keys to file names on Google Drive
const FILE_NAME_MAP: Record<string, string> = {
  'forgesteel-heroes': 'forgesteel-heroes.json',
  'forgesteel-homebrew-settings': 'forgesteel-homebrew.json',
  'forgesteel-session': 'forgesteel-session.json',
  'forgesteel-options': 'forgesteel-options.json',
  'forgesteel-hidden-setting-ids': 'forgesteel-hidden-ids.json',
};

// Cache file IDs to avoid repeated lookups
interface FileCache {
  [key: string]: {
    fileId: string;
    modifiedTime: string;
  };
}

export class GoogleDriveService implements StorageService {
  private settings: ConnectionSettings;
  private client: GoogleDriveClient | null = null;
  private fileCache: FileCache = {};
  private onTokenRefresh: ((settings: ConnectionSettings) => void) | null = null;

  constructor(
    settings: ConnectionSettings,
    onTokenRefresh?: (settings: ConnectionSettings) => void,
  ) {
    this.settings = settings;
    this.onTokenRefresh = onTokenRefresh || null;

    if (settings.googleDriveAccessToken) {
      this.client = new GoogleDriveClient(settings.googleDriveAccessToken);
    }
  }

  /**
   * Initialize the service - check token validity and folder access
   */
  async initialize(): Promise<boolean> {
    if (!this.settings.useGoogleDrive || !this.settings.googleDriveFolderId) {
      return false;
    }

    // Check if token needs refresh
    if (GoogleAuthService.isTokenExpired(this.settings.googleDriveTokenExpiry)) {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        console.error('Failed to refresh Google Drive token:', error);
        return false;
      }
    }

    if (!this.client) {
      return false;
    }

    // Verify folder access
    try {
      const hasAccess = await this.client.checkFolderAccess(this.settings.googleDriveFolderId);
      if (!hasAccess) {
        console.error('Cannot access the configured Google Drive folder');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking Google Drive folder access:', error);
      return false;
    }
  }

  /**
   * Refresh the access token using GoogleAuthService
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      const result = await GoogleAuthService.refreshToken();
      this.settings.googleDriveAccessToken = result.accessToken;
      this.settings.googleDriveTokenExpiry = result.expiresAt;

      if (this.client) {
        this.client.setAccessToken(result.accessToken);
      } else {
        this.client = new GoogleDriveClient(result.accessToken);
      }

      // Notify caller to persist updated settings
      if (this.onTokenRefresh) {
        this.onTokenRefresh(this.settings);
      }
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Ensure we have a valid client with non-expired token
   */
  private async ensureValidClient(): Promise<GoogleDriveClient> {
    if (GoogleAuthService.isTokenExpired(this.settings.googleDriveTokenExpiry)) {
      await this.refreshAccessToken();
    }

    if (!this.client) {
      throw new Error('Google Drive client not initialized');
    }

    return this.client;
  }

  /**
   * Get the file name for a storage key
   */
  private getFileName(key: string): string {
    return FILE_NAME_MAP[key] || `${key}.json`;
  }

  /**
   * Find or get cached file info for a storage key
   */
  private async getFileInfo(key: string): Promise<DriveFile | null> {
    const client = await this.ensureValidClient();
    const fileName = this.getFileName(key);
    const folderId = this.settings.googleDriveFolderId!;

    // Check cache first
    if (this.fileCache[key]) {
      return {
        id: this.fileCache[key].fileId,
        name: fileName,
        mimeType: 'application/json',
        modifiedTime: this.fileCache[key].modifiedTime,
      };
    }

    // Search for the file
    const file = await client.findFile(fileName, folderId);
    if (file) {
      this.fileCache[key] = {
        fileId: file.id,
        modifiedTime: file.modifiedTime,
      };
    }

    return file;
  }

  /**
   * Get data from Google Drive
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.ensureValidClient();
      const fileInfo = await this.getFileInfo(key);

      if (!fileInfo) {
        return null;
      }

      const data = await client.readFile<T>(fileInfo.id);
      return data;
    } catch (error) {
      console.error(`Error reading ${key} from Google Drive:`, error);
      throw error;
    }
  }

  /**
   * Save data to Google Drive
   */
  async put<T>(key: string, value: T): Promise<T> {
    try {
      const client = await this.ensureValidClient();
      const fileName = this.getFileName(key);
      const folderId = this.settings.googleDriveFolderId!;

      // Get existing file info (from cache or by searching Drive)
      const existingFile = await this.getFileInfo(key);
      const existingFileId = existingFile?.id;

      // Write the file (creates if new, updates if exists)
      const fileId = await client.writeFile(fileName, value, folderId, existingFileId);

      // Update cache
      this.fileCache[key] = {
        fileId,
        modifiedTime: new Date().toISOString(),
      };

      return value;
    } catch (error) {
      console.error(`Error writing ${key} to Google Drive:`, error);
      throw error;
    }
  }

  /**
   * Clear the file cache (e.g., when switching folders)
   */
  clearCache(): void {
    this.fileCache = {};
  }

  /**
   * Get the last modified time for a specific key (for conflict detection)
   */
  async getLastModified(key: string): Promise<Date | null> {
    try {
      const fileInfo = await this.getFileInfo(key);
      if (!fileInfo) {
        return null;
      }
      return new Date(fileInfo.modifiedTime);
    } catch {
      return null;
    }
  }

  /**
   * Update settings (e.g., after token refresh from outside)
   */
  updateSettings(settings: ConnectionSettings): void {
    this.settings = settings;
    if (settings.googleDriveAccessToken) {
      if (this.client) {
        this.client.setAccessToken(settings.googleDriveAccessToken);
      } else {
        this.client = new GoogleDriveClient(settings.googleDriveAccessToken);
      }
    }
  }
}
