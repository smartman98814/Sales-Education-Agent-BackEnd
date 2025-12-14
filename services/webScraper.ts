/**
 * Web Scraper
 * Scrapes web pages and extracts content
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';

import { createScopedLogger } from '../utils';

const logger = createScopedLogger('services/webScraper');

interface ScraperOptions {
  urls?: string[];
  outputFile?: string;
}

export class WebScraper {
  private urlsToScrape: string[];
  private visitedUrls: Set<string>;
  private content: string[];
  private outputFile: string;

  constructor(options: ScraperOptions = {}) {
    this.urlsToScrape = options.urls ?? [];
    this.visitedUrls = new Set<string>();
    this.content = [];
    this.outputFile = options.outputFile ?? path.join(__dirname, '../data/raw_data.txt');
  }

  /**
   * Fetch a single page and extract its content
   */
  private async fetchPage(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.status !== 200) {
        logger.warn(`Failed to fetch ${url}: ${response.status}`);

        return '';
      }

      const $ = cheerio.load(response.data);

      // Extract the main content
      const mainContent = $('main');
      if (mainContent.length === 0) {
        return '';
      }

      // Remove unwanted elements
      mainContent.find('nav, footer, header, script, style').remove();

      // Clean up the text
      let text = mainContent.text();
      // Remove excessive newlines
      text = text.replace(/\n\s*\n/g, '\n\n');

      return text.trim();
    } catch (error) {
      logger.error(`Error fetching ${url}: ${error}`);

      return '';
    }
  }

  /**
   * Main scraping function
   */
  async scrape(): Promise<void> {
    // Process each URL
    for (const url of this.urlsToScrape) {
      if (this.visitedUrls.has(url)) {
        continue;
      }

      this.visitedUrls.add(url);

      const content = await this.fetchPage(url);
      if (content) {
        this.content.push(`Content from ${url}:\n\n${content}\n\n`);
      }
    }
  }

  /**
   * Save the scraped content to a file
   */
  async saveContent(): Promise<void> {
    // Ensure the directory exists
    const dir = path.dirname(this.outputFile);
    await fs.mkdir(dir, { recursive: true });

    // Write the content
    await fs.writeFile(this.outputFile, this.content.join('\n'));
  }

  /**
   * Get the scraped content as a string
   */
  getContent(): string {
    return this.content.join('\n');
  }
}
