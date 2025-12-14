/**
 * Text tokenization utilities for RAG processing
 * Provides paragraph, sentence, and word tokenization
 */

export interface WordTokenizer {
  tokenize(text: string): string[];
  formatWords(words: string[]): string;
}

export interface SentenceTokenizer {
  tokenize(text: string): string[];
}

/**
 * Basic word tokenizer that preserves punctuation
 */
export class BasicWordTokenizer implements WordTokenizer {
  private ignorePunctuation: boolean;

  constructor(ignorePunctuation: boolean = false) {
    this.ignorePunctuation = ignorePunctuation;
  }

  tokenize(text: string): string[] {
    if (this.ignorePunctuation) {
      return text.split(/\s+/).filter((word) => word.length > 0);
    }

    // Split on whitespace while preserving punctuation
    return text.split(/(\s+)/).filter((word) => word.length > 0);
  }

  formatWords(words: string[]): string {
    return words.join('');
  }
}

/**
 * Basic sentence tokenizer using common sentence boundaries
 */
export class BasicSentenceTokenizer implements SentenceTokenizer {
  tokenize(text: string): string[] {
    // Split on sentence boundaries (., !, ?) followed by whitespace
    const sentences = text.split(/(?<=[.!?])\s+/);

    return sentences.filter((s) => s.trim().length > 0);
  }
}

/**
 * Tokenize text into paragraphs
 */
export function tokenizeParagraphs(text: string): string[] {
  // Split on double newlines or more
  const paragraphs = text.split(/\n\s*\n/);

  return paragraphs.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Sentence chunker that splits text into overlapping chunks
 */
export class SentenceChunker {
  private maxChunkSize: number;
  private chunkOverlap: number;
  private paragraphTokenizer: (text: string) => string[];
  private sentenceTokenizer: SentenceTokenizer;
  private wordTokenizer: WordTokenizer;

  constructor(
    options: {
      maxChunkSize?: number;
      chunkOverlap?: number;
      paragraphTokenizer?: (text: string) => string[];
      sentenceTokenizer?: SentenceTokenizer;
      wordTokenizer?: WordTokenizer;
    } = {},
  ) {
    this.maxChunkSize = options.maxChunkSize ?? 120;
    this.chunkOverlap = options.chunkOverlap ?? 30;
    this.paragraphTokenizer = options.paragraphTokenizer ?? tokenizeParagraphs;
    this.sentenceTokenizer = options.sentenceTokenizer ?? new BasicSentenceTokenizer();
    this.wordTokenizer = options.wordTokenizer ?? new BasicWordTokenizer(false);
  }

  chunk(text: string): string[] {
    const chunks: string[] = [];
    let bufWords: string[] = [];

    for (const paragraph of this.paragraphTokenizer(text)) {
      let lastBufWords: string[] = [];

      for (const sentence of this.sentenceTokenizer.tokenize(paragraph)) {
        for (const word of this.wordTokenizer.tokenize(sentence)) {
          const reconstructed = this.wordTokenizer.formatWords([...bufWords, word]);

          if (reconstructed.length > this.maxChunkSize) {
            while (this.wordTokenizer.formatWords(lastBufWords).length > this.chunkOverlap) {
              lastBufWords = lastBufWords.slice(1);
            }

            const newChunk = this.wordTokenizer.formatWords([...lastBufWords, ...bufWords]);
            chunks.push(newChunk);
            lastBufWords = bufWords;
            bufWords = [];
          }

          bufWords.push(word);
        }
      }

      if (bufWords.length > 0) {
        while (this.wordTokenizer.formatWords(lastBufWords).length > this.chunkOverlap) {
          lastBufWords = lastBufWords.slice(1);
        }

        const newChunk = this.wordTokenizer.formatWords([...lastBufWords, ...bufWords]);
        chunks.push(newChunk);
        bufWords = [];
      }
    }

    return chunks;
  }
}
