export interface ConnectionSettings {
  useWarehouse: boolean;
  warehouseHost: string;
  warehouseToken: string;
  patreonConnected: boolean;
  // Google Drive settings
  useGoogleDrive: boolean;
  googleDriveFolderId: string | null;
  googleDriveFolderName: string | null;
  googleDriveAccessToken: string | null;
  googleDriveRefreshToken: string | null;
  googleDriveTokenExpiry: number | null;
}

export const defaultConnectionSettings: ConnectionSettings = {
  useWarehouse: false,
  warehouseHost: '',
  warehouseToken: '',
  patreonConnected: false,
  useGoogleDrive: false,
  googleDriveFolderId: null,
  googleDriveFolderName: null,
  googleDriveAccessToken: null,
  googleDriveRefreshToken: null,
  googleDriveTokenExpiry: null,
};
