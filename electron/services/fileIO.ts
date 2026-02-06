import { promises as fs } from 'fs'
import { join, dirname } from 'path'

/**
 * Low-level file I/O utilities for the Cadmus app
 */
export class FileIO {
  /**
   * Read a file as UTF-8 string
   */
  static async readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8')
  }

  /**
   * Read a file as JSON
   */
  static async readJson<T>(filePath: string): Promise<T> {
    const content = await this.readText(filePath)
    return JSON.parse(content)
  }

  /**
   * Write text to a file, creating directories if needed
   */
  static async writeText(filePath: string, content: string): Promise<void> {
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  /**
   * Write JSON to a file, creating directories if needed
   */
  static async writeJson(filePath: string, data: unknown): Promise<void> {
    await this.writeText(filePath, JSON.stringify(data, null, 2))
  }

  /**
   * Check if a file or directory exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a directory recursively
   */
  static async mkdir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true })
  }

  /**
   * Delete a file
   */
  static async deleteFile(filePath: string): Promise<void> {
    await fs.unlink(filePath)
  }

  /**
   * Delete a directory recursively
   */
  static async deleteDir(dirPath: string): Promise<void> {
    await fs.rm(dirPath, { recursive: true, force: true })
  }

  /**
   * Copy a file
   */
  static async copyFile(src: string, dest: string): Promise<void> {
    await fs.mkdir(dirname(dest), { recursive: true })
    await fs.copyFile(src, dest)
  }

  /**
   * Move a file
   */
  static async moveFile(src: string, dest: string): Promise<void> {
    await fs.mkdir(dirname(dest), { recursive: true })
    await fs.rename(src, dest)
  }

  /**
   * List files in a directory
   */
  static async listDir(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map(entry => entry.name)
  }

  /**
   * List files in a directory with full paths
   */
  static async listDirFull(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath)
    return entries.map(entry => join(dirPath, entry))
  }

  /**
   * Get file stats
   */
  static async stat(filePath: string): Promise<fs.FileHandle | null> {
    try {
      const stats = await fs.stat(filePath)
      return stats as unknown as fs.FileHandle
    } catch {
      return null
    }
  }

  /**
   * Get file size in bytes
   */
  static async getSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath)
    return stats.size
  }

  /**
   * Read a file as Buffer
   */
  static async readBuffer(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath)
  }

  /**
   * Write a Buffer to file
   */
  static async writeBuffer(filePath: string, data: Buffer): Promise<void> {
    await fs.mkdir(dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, data)
  }
}
