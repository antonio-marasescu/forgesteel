import { ConnectionSettings } from '@/models/connection-settings';

export class ConnectionSettingsUpdateLogic {
  static updateSettings = (settings: ConnectionSettings) => {
    if (settings.useWarehouse === undefined) {
      settings.useWarehouse = false;
    }

    if (settings.warehouseHost === undefined) {
      settings.warehouseHost = '';
    }

    if (settings.warehouseToken === undefined) {
      settings.warehouseToken = '';
    }

    if (settings.patreonConnected === undefined) {
      settings.patreonConnected = false;
    }

    // Google Drive settings
    if (settings.useGoogleDrive === undefined) {
      settings.useGoogleDrive = false;
    }

    if (settings.googleDriveFolderId === undefined) {
      settings.googleDriveFolderId = null;
    }

    if (settings.googleDriveFolderName === undefined) {
      settings.googleDriveFolderName = null;
    }

    if (settings.googleDriveAccessToken === undefined) {
      settings.googleDriveAccessToken = null;
    }

    if (settings.googleDriveRefreshToken === undefined) {
      settings.googleDriveRefreshToken = null;
    }

    if (settings.googleDriveTokenExpiry === undefined) {
      settings.googleDriveTokenExpiry = null;
    }
  };
}
