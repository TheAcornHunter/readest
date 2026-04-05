export interface GrimmoryServer {
  id: string;
  name: string;
  url: string;
  username?: string;
  token?: string;
  refreshToken?: string;
}

export interface GrimmoryBookLink {
  bookHash: string;
  serverId: string;
  bookId: number;
  fileId: number;
}

export interface GrimmorySettings {
  servers: GrimmoryServer[];
  bookLinks?: GrimmoryBookLink[];
}

export interface GrimmoryReadProgressRequest {
  bookId: number;
  fileProgress: {
    bookFileId: number;
    positionData: string;
    positionHref: string;
    progressPercent: number;
  };
}

export interface GrimmoryLoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface GrimmoryVersionInfo {
  current: string;
  latest: string;
}

export interface GrimmoryLibraryPath {
  id: number;
  path: string;
}

export interface GrimmoryLibrary {
  id: number;
  name: string;
  icon?: string;
  paths?: GrimmoryLibraryPath[];
}

export interface GrimmoryBookFile {
  id: number;
  bookId?: number;
  fileName?: string;
  filePath?: string;
  bookType?: string;
  fileSizeKb?: number;
  extension?: string;
  addedOn?: string;
}

export interface GrimmoryBookMetadata {
  title?: string;
  subtitle?: string;
  publisher?: string;
  publishedDate?: string;
  description?: string;
  seriesName?: string;
  seriesNumber?: number;
  isbn13?: string;
  isbn10?: string;
  pageCount?: number;
  language?: string;
  authors?: string[];
  categories?: string[];
  tags?: string[];
  bookReviews?: GrimmoryBookReview[];
  rating?: number;
  amazonRating?: number;
  goodreadsRating?: number;
}

export interface GrimmoryBook {
  id: number;
  libraryId?: number;
  libraryName?: string;
  title?: string;
  primaryFile?: GrimmoryBookFile;
  alternativeFormats?: GrimmoryBookFile[];
  metadata?: GrimmoryBookMetadata;
  addedOn?: string;
  lastReadTime?: string;
}

export interface GrimmoryBookReview {
  id: number;
  metadataProvider?: string;
  reviewerName?: string;
  title?: string;
  rating?: number;
  date?: string;
  body?: string;
  country?: string;
  spoiler?: boolean;
}
