/**
 * File Transport for NIS2 Audit Logs
 * Handles file writing with optional rotation
 * @module @nis2shield/express-middleware
 */

/* eslint-disable no-console */
import { appendFile, stat, rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';

export interface FileTransportOptions {
  /** Path to the log file */
  filePath: string;
  /** Maximum file size in bytes before rotation (default: 10MB) */
  maxSize?: number;
  /** Maximum number of rotated files to keep (default: 5) */
  maxFiles?: number;
  /** Whether to create directory if it doesn't exist (default: true) */
  createDir?: boolean;
}

/**
 * FileTransport handles writing logs to files with rotation support.
 *
 * @example
 * ```typescript
 * const transport = new FileTransport({
 *   filePath: '/var/log/nis2-audit.log',
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   maxFiles: 5
 * });
 *
 * await transport.write('{"event": "audit"}');
 * ```
 */
export class FileTransport {
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;
  private createDir: boolean;
  private initialized: boolean = false;
  private currentSize: number = 0;

  constructor(options: FileTransportOptions) {
    this.filePath = options.filePath;
    this.maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles ?? 5;
    this.createDir = options.createDir ?? true;
  }

  /**
   * Initialize the transport (create directory, get current file size)
   */
  private async init(): Promise<void> {
    if (this.initialized) return;

    // Create directory if needed
    if (this.createDir) {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }
    }

    // Get current file size if file exists
    try {
      const stats = await stat(this.filePath);
      this.currentSize = stats.size;
    } catch {
      // File doesn't exist yet, size is 0
      this.currentSize = 0;
    }

    this.initialized = true;
  }

  /**
   * Write a log line to the file
   * @param line - The log line to write (will have newline appended)
   */
  async write(line: string): Promise<void> {
    try {
      await this.init();

      const content = line + '\n';
      const contentSize = Buffer.byteLength(content, 'utf8');

      // Check if rotation is needed
      if (this.currentSize + contentSize > this.maxSize) {
        await this.rotate();
      }

      // Append to file
      await appendFile(this.filePath, content, 'utf8');
      this.currentSize += contentSize;
    } catch (error) {
      // Fail silently but log to console as fallback
      console.error('[NIS2 Shield] File transport error:', error);
      console.log(line); // Fallback to console
    }
  }

  /**
   * Rotate log files
   * file.log -> file.log.1, file.log.1 -> file.log.2, etc.
   */
  private async rotate(): Promise<void> {
    try {
      // Delete oldest file if it exists
      const oldestFile = `${this.filePath}.${this.maxFiles}`;
      if (existsSync(oldestFile)) {
        const { unlink } = await import('fs/promises');
        await unlink(oldestFile);
      }

      // Rotate existing files
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const from = i === 1 ? this.filePath : `${this.filePath}.${i - 1}`;
        const to = `${this.filePath}.${i}`;

        if (existsSync(from)) {
          await rename(from, to);
        }
      }

      // Rename current file
      if (existsSync(this.filePath)) {
        await rename(this.filePath, `${this.filePath}.1`);
      }

      // Reset size counter
      this.currentSize = 0;
    } catch (error) {
      console.error('[NIS2 Shield] Log rotation error:', error);
    }
  }

  /**
   * Get the current file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

// Singleton instances cache (keyed by file path)
const transports: Map<string, FileTransport> = new Map();

/**
 * Get or create a FileTransport instance for the given path
 */
export function getFileTransport(options: FileTransportOptions): FileTransport {
  const existing = transports.get(options.filePath);
  if (existing) {
    return existing;
  }

  const transport = new FileTransport(options);
  transports.set(options.filePath, transport);
  return transport;
}
