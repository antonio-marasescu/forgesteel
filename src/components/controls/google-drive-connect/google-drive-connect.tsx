/**
 * Google Drive Connect Component
 *
 * Provides UI for connecting to Google Drive, selecting a folder,
 * and managing the connection.
 */

import {
  CloudOutlined,
  CloudSyncOutlined,
  DisconnectOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  GoogleOutlined,
  LoadingOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Modal, Space, Spin, Tree, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { DriveFolder, GoogleDriveClient } from '@/service/google/google-drive-client';

import { ConnectionSettings } from '@/models/connection-settings';
import { DriveSyncStatus } from '@/hooks/use-google-drive-sync';
import { GoogleAuthService } from '@/service/google/google-auth-service';

import './google-drive-connect.scss';

const { Text } = Typography;

interface Props {
  connectionSettings: ConnectionSettings;
  syncStatus: DriveSyncStatus;
  lastSyncTime: Date | null;
  onConnect: (settings: Partial<ConnectionSettings>) => void;
  onDisconnect: () => void;
  onForceSync?: () => void;
}

interface TreeNode {
  title: string;
  key: string;
  isLeaf: boolean;
  children?: TreeNode[];
}

export const GoogleDriveConnect = (props: Props) => {
  const { connectionSettings, syncStatus, lastSyncTime, onConnect, onDisconnect, onForceSync } =
    props;

  const [isConnecting, setIsConnecting] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [folders, setFolders] = useState<TreeNode[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('Forgesteel');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const isConnected =
    connectionSettings.useGoogleDrive &&
    connectionSettings.googleDriveFolderId &&
    connectionSettings.googleDriveAccessToken;

  /**
   * Check if Google client ID is configured
   */
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isConfigured = !!clientId;

  /**
   * Initialize Google Auth Service with client ID
   */
  useEffect(() => {
    if (clientId) {
      GoogleAuthService.initialize(clientId);
    }
  }, [clientId]);

  /**
   * Handle Google Sign In
   */
  const handleSignIn = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const result = await GoogleAuthService.signIn();

      // Update settings with the new token (but don't enable yet - need folder selection)
      onConnect({
        googleDriveAccessToken: result.accessToken,
        googleDriveTokenExpiry: result.expiresAt,
      });

      // Open folder picker
      setIsFolderPickerOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in';
      setError(message);
      console.error('Google sign in error:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Load folders from Google Drive
   */
  const loadFolders = useCallback(
    async (parentId?: string): Promise<TreeNode[]> => {
      if (!connectionSettings.googleDriveAccessToken) {
        return [];
      }

      const client = new GoogleDriveClient(connectionSettings.googleDriveAccessToken);
      const drivefolders = await client.listFolders(parentId);

      return drivefolders.map((folder: DriveFolder) => ({
        title: folder.name,
        key: folder.id,
        isLeaf: false,
      }));
    },
    [connectionSettings.googleDriveAccessToken],
  );

  /**
   * Load root folders when picker opens
   */
  useEffect(() => {
    if (isFolderPickerOpen && connectionSettings.googleDriveAccessToken) {
      setLoadingFolders(true);
      loadFolders()
        .then(setFolders)
        .catch(err => {
          console.error('Error loading folders:', err);
          setError('Failed to load folders');
        })
        .finally(() => setLoadingFolders(false));
    }
  }, [isFolderPickerOpen, connectionSettings.googleDriveAccessToken, loadFolders]);

  /**
   * Handle folder tree expand (lazy loading)
   */
  const handleLoadData = async (node: TreeNode): Promise<void> => {
    if (node.children) {
      return;
    }

    const children = await loadFolders(node.key);
    setFolders(prev => updateTreeData(prev, node.key, children));
  };

  /**
   * Update tree data with children
   */
  const updateTreeData = (list: TreeNode[], key: string, children: TreeNode[]): TreeNode[] => {
    return list.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });
  };

  /**
   * Handle folder selection
   */
  const handleSelectFolder = (selectedKeys: React.Key[], info: { node: TreeNode }) => {
    if (selectedKeys.length > 0) {
      setSelectedFolderId(selectedKeys[0] as string);
      setSelectedFolderName(info.node.title);
    }
  };

  /**
   * Confirm folder selection and enable Google Drive sync
   */
  const handleConfirmFolder = () => {
    if (selectedFolderId && selectedFolderName) {
      onConnect({
        useGoogleDrive: true,
        googleDriveFolderId: selectedFolderId,
        googleDriveFolderName: selectedFolderName,
      });
      setIsFolderPickerOpen(false);
      setSelectedFolderId(null);
      setSelectedFolderName(null);
    }
  };

  /**
   * Handle disconnect
   */
  const handleDisconnect = async () => {
    if (connectionSettings.googleDriveAccessToken) {
      try {
        await GoogleAuthService.signOut(connectionSettings.googleDriveAccessToken);
      } catch (err) {
        console.error('Error signing out:', err);
      }
    }
    onDisconnect();
  };

  /**
   * Cancel folder picker
   */
  const handleCancelPicker = () => {
    setIsFolderPickerOpen(false);
    setSelectedFolderId(null);
    setSelectedFolderName(null);
    // If we haven't selected a folder yet, clear the tokens
    if (!connectionSettings.googleDriveFolderId) {
      onConnect({
        googleDriveAccessToken: null,
        googleDriveTokenExpiry: null,
      });
    }
  };

  /**
   * Create a new folder in Google Drive root
   */
  const handleCreateFolder = async () => {
    if (!connectionSettings.googleDriveAccessToken || !newFolderName.trim()) {
      return;
    }

    setIsCreatingFolder(true);
    setError(null);

    try {
      const client = new GoogleDriveClient(connectionSettings.googleDriveAccessToken);
      const folderId = await client.createFolder(newFolderName.trim());

      // Add the new folder to the list and select it
      const newFolder: TreeNode = {
        title: newFolderName.trim(),
        key: folderId,
        isLeaf: false,
      };
      setFolders(prev => [newFolder, ...prev]);
      setSelectedFolderId(folderId);
      setSelectedFolderName(newFolderName.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create folder';
      setError(message);
      console.error('Error creating folder:', err);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  /**
   * Get sync status icon
   */
  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <SyncOutlined spin />;
      case 'synced':
        return <CloudSyncOutlined />;
      case 'error':
        return <WarningOutlined />;
      case 'offline':
        return <DisconnectOutlined />;
      default:
        return <CloudOutlined />;
    }
  };

  /**
   * Get sync status text
   */
  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return lastSyncTime ? `Synced at ${lastSyncTime.toLocaleTimeString()}` : 'Synced';
      case 'error':
        return 'Sync error';
      case 'offline':
        return 'Offline';
      default:
        return 'Ready';
    }
  };

  // Not configured - show setup instructions
  if (!isConfigured) {
    return (
      <div className="google-drive-connect">
        <Alert
          type="warning"
          showIcon
          message="Google Drive not configured"
          description={
            <div>
              <p>To enable Google Drive sync, you need to configure a Google Cloud Client ID.</p>
              <p>
                Set the <code>VITE_GOOGLE_CLIENT_ID</code> environment variable.
              </p>
            </div>
          }
        />
      </div>
    );
  }

  // Connected state
  if (isConnected) {
    return (
      <div className="google-drive-connect connected">
        <div className="connection-status">
          <div className="status-icon">{getSyncStatusIcon()}</div>
          <div className="status-info">
            <Text strong>Connected to Google Drive</Text>
            <Text type="secondary">
              Folder: {connectionSettings.googleDriveFolderName || 'Unknown'}
            </Text>
            <Text type="secondary" className="sync-status">
              {getSyncStatusText()}
            </Text>
          </div>
        </div>
        <Space>
          {onForceSync && (
            <Button
              icon={<SyncOutlined spin={syncStatus === 'syncing'} />}
              onClick={onForceSync}
              disabled={syncStatus === 'syncing'}
            >
              Sync Now
            </Button>
          )}
          <Button icon={<FolderOpenOutlined />} onClick={() => setIsFolderPickerOpen(true)}>
            Change Folder
          </Button>
          <Button danger icon={<DisconnectOutlined />} onClick={handleDisconnect}>
            Disconnect
          </Button>
        </Space>

        <Modal
          title="Select Google Drive Folder"
          open={isFolderPickerOpen}
          onOk={handleConfirmFolder}
          onCancel={handleCancelPicker}
          okText="Select Folder"
          okButtonProps={{ disabled: !selectedFolderId }}
        >
          {loadingFolders ? (
            <div className="loading-folders">
              <Spin indicator={<LoadingOutlined />} />
              <Text>Loading folders...</Text>
            </div>
          ) : folders.length === 0 ? (
            <div className="no-folders">
              <Alert
                type="info"
                message="No folders found"
                description="Create a new folder to store your Forgesteel data."
                style={{ marginBottom: 16 }}
              />
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onPressEnter={handleCreateFolder}
                  disabled={isCreatingFolder}
                />
                <Button
                  type="primary"
                  icon={isCreatingFolder ? <LoadingOutlined /> : <FolderAddOutlined />}
                  onClick={handleCreateFolder}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                >
                  Create
                </Button>
              </Space.Compact>
            </div>
          ) : (
            <>
              <Tree
                showIcon
                defaultExpandAll={false}
                treeData={folders}
                loadData={handleLoadData as (node: TreeNode) => Promise<void>}
                onSelect={
                  handleSelectFolder as (
                    selectedKeys: React.Key[],
                    info: { node: TreeNode },
                  ) => void
                }
                selectedKeys={selectedFolderId ? [selectedFolderId] : []}
              />
              <div className="create-folder-section" style={{ marginTop: 16 }}>
                <Text type="secondary">Or create a new folder:</Text>
                <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                  <Input
                    placeholder="Folder name"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onPressEnter={handleCreateFolder}
                    disabled={isCreatingFolder}
                  />
                  <Button
                    icon={isCreatingFolder ? <LoadingOutlined /> : <FolderAddOutlined />}
                    onClick={handleCreateFolder}
                    disabled={isCreatingFolder || !newFolderName.trim()}
                  >
                    Create
                  </Button>
                </Space.Compact>
              </div>
            </>
          )}
          {error && (
            <Alert
              type="error"
              message={error}
              style={{ marginTop: 16 }}
              closable
              onClose={() => setError(null)}
            />
          )}
          {selectedFolderName && (
            <div className="selected-folder">
              <Text>
                Selected: <strong>{selectedFolderName}</strong>
              </Text>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // Disconnected state
  return (
    <div className="google-drive-connect disconnected">
      {error && (
        <Alert
          type="error"
          showIcon
          message="Connection Error"
          description={error}
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="connect-info">
        <CloudOutlined className="cloud-icon" />
        <div className="info-text">
          <Text strong>Sync with Google Drive</Text>
          <Text type="secondary">
            Store your heroes, sourcebooks, and settings in your Google Drive for cross-device
            access.
          </Text>
        </div>
      </div>

      <Button
        type="primary"
        icon={isConnecting ? <LoadingOutlined /> : <GoogleOutlined />}
        onClick={handleSignIn}
        loading={isConnecting}
        disabled={isConnecting}
        size="large"
      >
        {isConnecting ? 'Connecting...' : 'Connect to Google Drive'}
      </Button>

      <Modal
        title="Select Google Drive Folder"
        open={isFolderPickerOpen}
        onOk={handleConfirmFolder}
        onCancel={handleCancelPicker}
        okText="Select Folder"
        okButtonProps={{ disabled: !selectedFolderId }}
      >
        <p>Choose a folder in your Google Drive to store Forgesteel data:</p>
        {loadingFolders ? (
          <div className="loading-folders">
            <Spin indicator={<LoadingOutlined />} />
            <Text>Loading folders...</Text>
          </div>
        ) : folders.length === 0 ? (
          <div className="no-folders">
            <Alert
              type="info"
              message="No folders found"
              description="Create a new folder to store your Forgesteel data."
              style={{ marginBottom: 16 }}
            />
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onPressEnter={handleCreateFolder}
                disabled={isCreatingFolder}
              />
              <Button
                type="primary"
                icon={isCreatingFolder ? <LoadingOutlined /> : <FolderAddOutlined />}
                onClick={handleCreateFolder}
                disabled={isCreatingFolder || !newFolderName.trim()}
              >
                Create
              </Button>
            </Space.Compact>
          </div>
        ) : (
          <>
            <Tree
              showIcon
              defaultExpandAll={false}
              treeData={folders}
              loadData={handleLoadData as (node: TreeNode) => Promise<void>}
              onSelect={
                handleSelectFolder as (selectedKeys: React.Key[], info: { node: TreeNode }) => void
              }
              selectedKeys={selectedFolderId ? [selectedFolderId] : []}
            />
            <div className="create-folder-section" style={{ marginTop: 16 }}>
              <Text type="secondary">Or create a new folder:</Text>
              <Space.Compact style={{ width: '100%', marginTop: 8 }}>
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onPressEnter={handleCreateFolder}
                  disabled={isCreatingFolder}
                />
                <Button
                  icon={isCreatingFolder ? <LoadingOutlined /> : <FolderAddOutlined />}
                  onClick={handleCreateFolder}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                >
                  Create
                </Button>
              </Space.Compact>
            </div>
          </>
        )}
        {error && (
          <Alert
            type="error"
            message={error}
            style={{ marginTop: 16 }}
            closable
            onClose={() => setError(null)}
          />
        )}
        {selectedFolderName && (
          <div className="selected-folder">
            <Text>
              Selected: <strong>{selectedFolderName}</strong>
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
};
