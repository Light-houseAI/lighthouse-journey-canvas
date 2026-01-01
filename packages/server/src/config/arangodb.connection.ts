/**
 * ArangoDB Connection Configuration
 *
 * Manages the connection to ArangoDB for Graph RAG functionality
 * Provides singleton pattern for connection management
 */

import { Database } from 'arangojs';

export interface ArangoDBConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

export class ArangoDBConnection {
  private static instance: Database | null = null;
  private static isConnected: boolean = false;
  private static config: ArangoDBConfig | null = null;

  /**
   * Initialize ArangoDB connection with configuration
   */
  static async initialize(config: ArangoDBConfig): Promise<void> {
    this.config = config;
    await this.getConnection();
  }

  /**
   * Get or create ArangoDB connection
   */
  static async getConnection(): Promise<Database> {
    if (this.instance && this.isConnected) {
      return this.instance;
    }

    if (!this.config) {
      throw new Error(
        'ArangoDB connection not initialized. Call ArangoDBConnection.initialize() first.'
      );
    }

    try {
      this.instance = new Database({
        url: this.config.url,
        databaseName: this.config.database,
        auth: {
          username: this.config.username,
          password: this.config.password,
        },
        agentOptions: {
          maxSockets: 20, // Connection pooling
          keepAlive: true,
          keepAliveMsecs: 30000,
        },
      });

      // Test connection
      await this.instance.version();
      this.isConnected = true;

      console.log('ArangoDB connection established', {
        url: this.config.url,
        database: this.config.database,
      });

      return this.instance;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to connect to ArangoDB', errorMessage);
      this.isConnected = false;
      throw new Error('ArangoDB connection failed: ' + errorMessage);
    }
  }

  /**
   * Disconnect from ArangoDB
   */
  static async disconnect(): Promise<void> {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
      this.isConnected = false;
      console.log('ArangoDB connection closed');
    }
  }

  /**
   * Health check for ArangoDB connection
   */
  static async healthCheck(): Promise<boolean> {
    try {
      if (!this.instance) {
        return false;
      }
      await this.instance.version();
      return true;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Get connection status
   */
  static getStatus(): { connected: boolean; config: ArangoDBConfig | null } {
    return {
      connected: this.isConnected,
      config: this.config,
    };
  }
}
