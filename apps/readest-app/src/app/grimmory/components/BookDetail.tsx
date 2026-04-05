'use client';

import { useEffect, useState } from 'react';
import {
  IoStar,
  IoStarOutline,
  IoStarHalf,
  IoCloudDownloadOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5';
import { MdArrowBack } from 'react-icons/md';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { saveSysSettings } from '@/helpers/settings';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import { GrimmoryImage } from './GrimmoryImage';
import type {
  GrimmoryBook,
  GrimmoryBookLink,
  GrimmoryBookReview,
  GrimmoryServer,
} from '@/types/grimmory';

interface BookDetailProps {
  server: GrimmoryServer;
  libraryId: number;
  bookId: number;
  onBack: () => void;
}

// Threshold for displaying a half-star (>=40% of the way to the next full star)
const HALF_STAR_THRESHOLD = 0.4;

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const normalized = (rating / max) * 5;
  return (
    <span className='inline-flex items-center gap-0.5'>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < Math.floor(normalized);
        const half = !filled && i < Math.ceil(normalized) && normalized % 1 >= HALF_STAR_THRESHOLD;
        return filled ? (
          <IoStar key={i} className='h-4 w-4 text-yellow-400' />
        ) : half ? (
          <IoStarHalf key={i} className='h-4 w-4 text-yellow-400' />
        ) : (
          <IoStarOutline key={i} className='h-4 w-4 text-yellow-400' />
        );
      })}
      <span className='text-base-content/60 ml-1 text-xs'>{rating.toFixed(1)}</span>
    </span>
  );
}

function ReviewCard({ review }: { review: GrimmoryBookReview }) {
  const _ = useTranslation();
  return (
    <div className='bg-base-200 rounded-lg p-4'>
      <div className='mb-2 flex items-start justify-between gap-2'>
        <div>
          <p className='text-sm font-medium'>{review.reviewerName || _('Anonymous')}</p>
          {review.metadataProvider && (
            <p className='text-base-content/50 text-xs'>{review.metadataProvider}</p>
          )}
        </div>
        <div className='flex flex-col items-end gap-1'>
          {review.rating !== undefined && review.rating !== null && (
            <StarRating rating={review.rating} />
          )}
          {review.date && (
            <span className='text-base-content/40 text-xs'>
              {new Date(review.date).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {review.title && <p className='mb-1 text-sm font-semibold'>{review.title}</p>}
      {review.body && (
        <p className='text-base-content/80 line-clamp-4 text-sm leading-relaxed'>{review.body}</p>
      )}
      {review.spoiler && <span className='badge badge-warning badge-xs mt-2'>{_('Spoiler')}</span>}
    </div>
  );
}

export function BookDetail({ server, libraryId, bookId, onBack }: BookDetailProps) {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { settings } = useSettingsStore();
  const { library } = useLibraryStore();
  const [book, setBook] = useState<GrimmoryBook | null>(null);
  const [reviews, setReviews] = useState<GrimmoryBookReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      setLoading(true);
      setError(null);
      try {
        const client = new GrimmoryClient(server);
        const [bookData, reviewsData] = await Promise.all([
          client.getBook(libraryId, bookId),
          client.getBookReviews(bookId).catch(() => []),
        ]);
        setBook(bookData);
        setReviews(reviewsData);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg || _('Failed to load book details.'));
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, libraryId, bookId]);

  useEffect(() => {
    const links = settings.grimmory?.bookLinks ?? [];
    const linked = links.some((l) => l.serverId === server.id && l.bookId === bookId);
    setIsLinked(linked);
  }, [settings.grimmory?.bookLinks, server.id, bookId]);

  const handleDownloadToLibrary = async () => {
    if (!appService || !book) return;
    const primaryFile = book.primaryFile;
    if (!primaryFile) {
      setDownloadError(_('No file available for download.'));
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const client = new GrimmoryClient(server);
      const blob = await client.downloadBookFile(bookId);
      const fileName = primaryFile.fileName ?? `book-${bookId}.${primaryFile.extension ?? 'epub'}`;
      const file = new File([blob], fileName, { type: blob.type || 'application/epub+zip' });

      const imported = await appService.importBook(file, library);
      if (!imported) {
        setDownloadError(_('Failed to import book.'));
        return;
      }

      const newLink: GrimmoryBookLink = {
        bookHash: imported.hash,
        serverId: server.id,
        bookId,
        fileId: primaryFile.id,
      };
      const existingLinks = settings.grimmory?.bookLinks ?? [];
      const updatedLinks = existingLinks.filter(
        (l) => !(l.serverId === server.id && l.bookId === bookId),
      );
      updatedLinks.push(newLink);
      await saveSysSettings(envConfig, 'grimmory', {
        ...settings.grimmory,
        bookLinks: updatedLinks,
      });
      setIsLinked(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setDownloadError(msg || _('Download failed.'));
    } finally {
      setIsDownloading(false);
    }
  };

  const client = new GrimmoryClient(server);
  const coverUrl = client.getCoverUrl(bookId);
  const authHeader = client.getAuthHeader();

  if (loading) {
    return (
      <div className='flex h-full items-center justify-center p-8'>
        <span className='loading loading-spinner loading-lg' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex h-full flex-col items-center justify-center p-8 text-center'>
        <p className='text-error mb-4'>{error}</p>
        <button onClick={onBack} className='btn btn-ghost btn-sm'>
          <MdArrowBack className='h-4 w-4' />
          {_('Back')}
        </button>
      </div>
    );
  }

  if (!book) return null;

  const meta = book.metadata;
  const primaryFile = book.primaryFile;
  const altFormats = book.alternativeFormats ?? [];
  const allFiles = primaryFile ? [primaryFile, ...altFormats] : altFormats;
  const tags = meta?.tags ?? [];
  const categories = meta?.categories ?? [];

  const formatFileSize = (sizeKb: number | undefined) => {
    if (!sizeKb) return null;
    if (sizeKb < 1024) return `${sizeKb} KB`;
    return `${(sizeKb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className='h-full overflow-y-auto'>
      <div className='bg-base-100/90 sticky top-0 z-10 px-4 py-2 backdrop-blur-sm'>
        <button onClick={onBack} className='btn btn-ghost btn-sm'>
          <MdArrowBack className='h-4 w-4' />
          {_('Back')}
        </button>
      </div>

      <div className='mx-auto max-w-2xl px-4 pb-8'>
        {/* Cover + Title */}
        <div className='flex gap-4 py-4'>
          <div className='flex-shrink-0'>
            {!coverError ? (
              <GrimmoryImage
                src={coverUrl}
                authHeader={authHeader}
                alt={book.title || _('Book cover')}
                className='h-36 w-24 rounded-md object-cover shadow-md'
                onError={() => setCoverError(true)}
              />
            ) : (
              <div className='bg-base-300 flex h-36 w-24 items-center justify-center rounded-md'>
                <span className='text-3xl'>📚</span>
              </div>
            )}
          </div>

          <div className='flex min-w-0 flex-1 flex-col'>
            <h1 className='text-lg font-bold leading-tight'>{book.title || _('Untitled')}</h1>
            {meta?.subtitle && (
              <p className='text-base-content/70 text-sm italic'>{meta.subtitle}</p>
            )}
            {meta?.authors && meta.authors.length > 0 && (
              <p className='text-base-content/80 mt-1 text-sm'>{meta.authors.join(', ')}</p>
            )}
            {meta?.seriesName && (
              <p className='text-base-content/60 text-xs'>
                {meta.seriesName}
                {meta.seriesNumber !== undefined && ` #${meta.seriesNumber}`}
              </p>
            )}

            {/* Ratings */}
            <div className='mt-2 flex flex-wrap gap-2'>
              {meta?.rating !== undefined && meta.rating > 0 && (
                <div className='flex items-center gap-1'>
                  <span className='text-base-content/60 text-xs'>{_('Rating')}:</span>
                  <StarRating rating={meta.rating} />
                </div>
              )}
              {meta?.amazonRating !== undefined && meta.amazonRating > 0 && (
                <div className='flex items-center gap-1'>
                  <span className='text-base-content/60 text-xs'>Amazon:</span>
                  <StarRating rating={meta.amazonRating} max={5} />
                </div>
              )}
              {meta?.goodreadsRating !== undefined && meta.goodreadsRating > 0 && (
                <div className='flex items-center gap-1'>
                  <span className='text-base-content/60 text-xs'>Goodreads:</span>
                  <StarRating rating={meta.goodreadsRating} max={5} />
                </div>
              )}
            </div>

            {/* Download to Library */}
            {primaryFile && (
              <div className='mt-3'>
                {isLinked ? (
                  <div className='text-success flex items-center gap-1 text-xs'>
                    <IoCheckmarkCircle className='h-4 w-4' />
                    {_('In your library')}
                  </div>
                ) : (
                  <button
                    onClick={handleDownloadToLibrary}
                    disabled={isDownloading}
                    className='btn btn-primary btn-sm'
                  >
                    {isDownloading ? (
                      <span className='loading loading-spinner loading-xs' />
                    ) : (
                      <IoCloudDownloadOutline className='h-4 w-4' />
                    )}
                    {isDownloading ? _('Downloading…') : _('Download to Library')}
                  </button>
                )}
                {downloadError && <p className='text-error mt-1 text-xs'>{downloadError}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {meta?.description && (
          <div className='mb-4'>
            <h2 className='mb-2 text-sm font-semibold'>{_('Description')}</h2>
            <p className='text-base-content/80 text-sm leading-relaxed'>{meta.description}</p>
          </div>
        )}

        {/* Tags & Categories */}
        {(tags.length > 0 || categories.length > 0) && (
          <div className='mb-4'>
            <h2 className='mb-2 text-sm font-semibold'>{_('Tags')}</h2>
            <div className='flex flex-wrap gap-1'>
              {categories.map((cat) => (
                <span key={cat} className='badge badge-primary badge-sm'>
                  {cat}
                </span>
              ))}
              {tags.map((tag) => (
                <span key={tag} className='badge badge-outline badge-sm'>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* File Information */}
        {allFiles.length > 0 && (
          <div className='mb-4'>
            <h2 className='mb-2 text-sm font-semibold'>{_('Files')}</h2>
            <div className='space-y-1'>
              {allFiles.map((file) => (
                <div
                  key={file.id}
                  className='bg-base-200 flex items-center justify-between rounded px-3 py-2 text-xs'
                >
                  <span className='font-mono'>
                    {file.extension?.toUpperCase() || file.bookType || '?'}
                  </span>
                  {file.fileName && (
                    <span className='text-base-content/60 mx-2 flex-1 truncate'>
                      {file.fileName}
                    </span>
                  )}
                  {file.fileSizeKb !== undefined && (
                    <span className='text-base-content/60 flex-shrink-0'>
                      {formatFileSize(file.fileSizeKb)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata details */}
        <div className='mb-4'>
          <h2 className='mb-2 text-sm font-semibold'>{_('Details')}</h2>
          <dl className='grid grid-cols-2 gap-x-4 gap-y-1 text-xs'>
            {meta?.publisher && (
              <>
                <dt className='text-base-content/60'>{_('Publisher')}</dt>
                <dd>{meta.publisher}</dd>
              </>
            )}
            {meta?.publishedDate && (
              <>
                <dt className='text-base-content/60'>{_('Published')}</dt>
                <dd>{meta.publishedDate}</dd>
              </>
            )}
            {meta?.language && (
              <>
                <dt className='text-base-content/60'>{_('Language')}</dt>
                <dd>{meta.language.toUpperCase()}</dd>
              </>
            )}
            {meta?.pageCount && (
              <>
                <dt className='text-base-content/60'>{_('Pages')}</dt>
                <dd>{meta.pageCount}</dd>
              </>
            )}
            {meta?.isbn13 && (
              <>
                <dt className='text-base-content/60'>ISBN-13</dt>
                <dd className='font-mono'>{meta.isbn13}</dd>
              </>
            )}
            {meta?.isbn10 && (
              <>
                <dt className='text-base-content/60'>ISBN-10</dt>
                <dd className='font-mono'>{meta.isbn10}</dd>
              </>
            )}
            {book.addedOn && (
              <>
                <dt className='text-base-content/60'>{_('Added')}</dt>
                <dd>{new Date(book.addedOn).toLocaleDateString()}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className='mb-4'>
            <h2 className='mb-2 text-sm font-semibold'>
              {_('Reviews')} ({reviews.length})
            </h2>
            <div className='space-y-3'>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
