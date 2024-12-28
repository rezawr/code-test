export interface ExtractedData {
  page: number;
  text: string;
  words: Array < {
    text: string;
    boundingBox: {
      x0: number;y0: number;x1: number;y1: number
    };
  } > ;
}