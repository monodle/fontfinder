export interface FontsourceItem {
  id: string;
  family: string;
  subsets: string[];
  weights: number[];
  styles: string[];
  defSubset?: string;
  variable: boolean;
  lastModified?: string;
  category: "sans-serif" | "serif" | "display" | "handwriting" | "monospace" | "icons" | "other" | string;
  license: string;
  type?: "google" | "other" | string;
}

