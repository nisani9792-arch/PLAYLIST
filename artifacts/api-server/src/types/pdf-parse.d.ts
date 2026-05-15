declare module "pdf-parse/lib/pdf-parse.js" {
  function pdfParse(data: Buffer): Promise<{ text: string; numpages?: number }>;
  export default pdfParse;
}

declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages?: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  function pdfParse(
    data: Buffer,
    options?: Record<string, unknown>,
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
