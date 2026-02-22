/**
 * Google OAuth 2.0 Authentication Service
 *
 * Uses Google Identity Services (GIS) library for OAuth 2.0 authentication.
 * Each user authenticates with their own Google account to access their own Google Drive.
 */

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, callback: () => void) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: TokenError) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface TokenError {
  type: string;
  message: string;
}

export interface GoogleAuthResult {
  accessToken: string;
  expiresAt: number;
}

// Required scopes for Google Drive file access
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export class GoogleAuthService {
  private static clientId: string | null = null;
  private static tokenClient: TokenClient | null = null;
  private static isGisLoaded = false;

  /**
   * Initialize the Google Auth Service with the client ID
   */
  static initialize(clientId: string): void {
    this.clientId = clientId;
  }

  /**
   * Check if Google Identity Services library is loaded
   */
  static isLibraryLoaded(): boolean {
    return typeof window !== 'undefined' && !!window.google?.accounts?.oauth2;
  }

  /**
   * Wait for GIS library to load
   */
  static async waitForLibrary(timeout = 10000): Promise<boolean> {
    if (this.isLibraryLoaded()) {
      this.isGisLoaded = true;
      return true;
    }

    return new Promise(resolve => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.isLibraryLoaded()) {
          this.isGisLoaded = true;
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Sign in with Google and request Drive access
   * Returns access token and expiry time
   */
  static async signIn(): Promise<GoogleAuthResult> {
    if (!this.clientId) {
      throw new Error('Google Auth not initialized. Call initialize() with client ID first.');
    }

    if (!this.isGisLoaded) {
      const loaded = await this.waitForLibrary();
      if (!loaded) {
        throw new Error(
          'Google Identity Services library not loaded. Make sure the script is included in index.html.',
        );
      }
    }

    return new Promise((resolve, reject) => {
      this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: this.clientId!,
        scope: SCOPES,
        callback: (response: TokenResponse) => {
          if (response.error) {
            reject(new Error(`${response.error}: ${response.error_description}`));
            return;
          }

          const expiresAt = Date.now() + response.expires_in * 1000;
          resolve({
            accessToken: response.access_token,
            expiresAt,
          });
        },
        error_callback: (error: TokenError) => {
          reject(new Error(`Google Auth Error: ${error.message}`));
        },
      });

      // Request access token with consent prompt
      this.tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  /**
   * Silently refresh the access token (no user interaction)
   * Used when the token is about to expire
   */
  static async refreshToken(): Promise<GoogleAuthResult> {
    if (!this.clientId) {
      throw new Error('Google Auth not initialized.');
    }

    if (!this.isGisLoaded) {
      const loaded = await this.waitForLibrary();
      if (!loaded) {
        throw new Error('Google Identity Services library not loaded.');
      }
    }

    return new Promise((resolve, reject) => {
      this.tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: this.clientId!,
        scope: SCOPES,
        callback: (response: TokenResponse) => {
          if (response.error) {
            reject(new Error(`${response.error}: ${response.error_description}`));
            return;
          }

          const expiresAt = Date.now() + response.expires_in * 1000;
          resolve({
            accessToken: response.access_token,
            expiresAt,
          });
        },
        error_callback: (error: TokenError) => {
          reject(new Error(`Google Auth Error: ${error.message}`));
        },
      });

      // Request without prompt - will use existing session if available
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  /**
   * Revoke the access token and sign out
   */
  static async signOut(accessToken: string): Promise<void> {
    if (!this.isGisLoaded) {
      return;
    }

    return new Promise(resolve => {
      window.google!.accounts.oauth2.revoke(accessToken, () => {
        resolve();
      });
    });
  }

  /**
   * Check if the token is expired or about to expire (within 5 minutes)
   */
  static isTokenExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true;
    // Consider expired if less than 5 minutes remaining
    return Date.now() > expiresAt - 5 * 60 * 1000;
  }

  /**
   * Get the client ID (for debugging/display purposes)
   */
  static getClientId(): string | null {
    return this.clientId;
  }
}
