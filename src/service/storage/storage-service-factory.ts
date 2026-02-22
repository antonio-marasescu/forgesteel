import { ConnectionSettings } from '@/models/connection-settings';
import { GoogleDriveService } from '@/service/storage/google-drive-service';
import { LocalService } from '@/service/storage/local-service';
import { StorageService } from '@/service/storage/storage-service';
import { WarehouseService } from '@/service/storage/warehouse-service';

export class StorageServiceFactory {
  static fromConnectionSettings = (
    settings: ConnectionSettings,
    onGoogleDriveTokenRefresh?: (settings: ConnectionSettings) => void,
  ): StorageService => {
    // Priority: Warehouse > Google Drive > Local
    if (settings.useWarehouse) {
      return new WarehouseService(settings);
    }

    if (
      settings.useGoogleDrive &&
      settings.googleDriveFolderId &&
      settings.googleDriveAccessToken
    ) {
      return new GoogleDriveService(settings, onGoogleDriveTokenRefresh);
    }

    return new LocalService();
  };
}
