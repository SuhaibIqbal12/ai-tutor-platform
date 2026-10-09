export interface TextSegment { text: string; pageNumber?: number; timestamp?: number }
export interface TextChunk extends TextSegment { chunkIndex: number }
export function cleanText(text: string): string {
  return text.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
// MiniLM has a short input window. Large 800-word chunks would truncate most evidence.
// Keep a 120-word baseline with 25-word overlap; page/transcript boundaries are preserved.
export function splitSegments(segments: TextSegment[], size = 120, overlap = 25): TextChunk[] {
  if (size <= overlap || overlap < 0 || size < 1) throw new Error('Invalid chunking parameters');
  const chunks: TextChunk[] = [];
  for (const segment of segments) {
    const words = cleanText(segment.text).split(/\s+/).filter(Boolean);
    for (let start = 0; start < words.length; start += size - overlap) {
      let end = Math.min(start + size, words.length);
      // Prefer a sentence ending near the limit, while guaranteeing progress.
      if (end < words.length) {
        for (let i = end; i > start + Math.floor(size * 0.7); i--) {
          if (/[.!?]$/.test(words[i-1])) { end = i; break; }
        }
      }
      chunks.push({ text: words.slice(start, end).join(' '), pageNumber: segment.pageNumber, timestamp: segment.timestamp, chunkIndex: chunks.length });
      if (end === words.length) break;
      start = end - size; // loop increment makes the next start equal end - overlap
    }
  }
  return chunks;
}
