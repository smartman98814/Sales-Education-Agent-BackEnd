/**
 * File Parser Service
 * Extracts text content from various file formats (PDF, DOCX, TXT, DOC)
 */
import * as fs from 'fs/promises';
import * as mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export class FileParser {
  /**
   * Parse a PDF file and extract text content
   */
  private async parsePDF(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const data = await parser.getText();

      return data.text;
    } catch (error) {
      throw new Error(`Failed to parse PDF: ${error}`);
    }
  }

  /**
   * Parse a DOCX file and extract text content
   */
  private async parseDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      return result.value;
    } catch (error) {
      throw new Error(`Failed to parse DOCX: ${error}`);
    }
  }

  /**
   * Parse a TXT file and extract text content
   */
  private async parseTXT(buffer: Buffer): Promise<string> {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      throw new Error(`Failed to parse TXT: ${error}`);
    }
  }

  /**
   * Parse a DOC file (legacy Word format)
   * Note: mammoth primarily supports DOCX, but we'll attempt to parse DOC files
   */
  private async parseDOC(buffer: Buffer): Promise<string> {
    try {
      // Try to parse as DOCX (mammoth may handle some DOC files)
      const result = await mammoth.extractRawText({ buffer });

      return result.value;
    } catch (error) {
      throw new Error(
        `Failed to parse DOC: ${error}. Legacy DOC format may not be fully supported. Please convert to DOCX.`,
      );
    }
  }

  /**
   * Parse a file based on its extension
   */
  async parseFile(buffer: Buffer, filename: string): Promise<string> {
    const extension = filename.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return this.parsePDF(buffer);
      case 'docx':
        return this.parseDOCX(buffer);
      case 'doc':
        return this.parseDOC(buffer);
      case 'txt':
        return this.parseTXT(buffer);
      default:
        throw new Error(
          `Unsupported file format: ${extension}. Supported formats: PDF, DOCX, DOC, TXT`,
        );
    }
  }

  /**
   * Parse a file from a file path
   */
  async parseFileFromPath(filePath: string): Promise<string> {
    try {
      const buffer = await fs.readFile(filePath);

      return this.parseFile(buffer, filePath);
    } catch (error) {
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  /**
   * Validate if a file format is supported
   */
  isSupportedFormat(filename: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();

    return ['pdf', 'docx', 'doc', 'txt'].includes(extension || '');
  }
}

export const fileParser = new FileParser();
