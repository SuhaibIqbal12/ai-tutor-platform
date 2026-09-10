declare module 'pdf-parse' {
  export class PDFParse {
    constructor(dataBuffer: Buffer, options?: any);
    load(): Promise<any>;
    getText(options?: any): Promise<{ text: string; pages: any[]; total: number }>;
  }
}
