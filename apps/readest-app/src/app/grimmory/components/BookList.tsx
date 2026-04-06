'use client';

import { useEffect, useState } from 'react';
import { MdArrowBack } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import { GrimmoryImage } from './GrimmoryImage';
import type { GrimmoryBook, GrimmoryServer } from '@/types/grimmory';

interface BookListProps {
  server: GrimmoryServer;
  libraryId: number;
  libraryName: string;
  onBack: () => void;
  onSelectBook: (bookId: number) => void;
}

function BookCard({
  book,
  server,
  onSelect,
}: {
  book: GrimmoryBook;
  server: GrimmoryServer;
  onSelect: () => void;
}) {
  const _ = useTranslation();
  const [coverError, setCoverError] = useState(false);
  const client = new GrimmoryClient(server);
  const thumbnailUrl = client.getThumbnailUrl(book.id);
  const authHeader = client.getAuthHeader();

  const meta = book.metadata;
  const primaryFile = book.primaryFile;
  const formatFileSize = (sizeKb: number | undefined) => {
    if (!sizeKb) return null;
    if (sizeKb < 1024) return `${sizeKb} KB`;
    return `${(sizeKb / 1024).toFixed(1)} MB`;
  };

  return (
    <button
      onClick={onSelect}
      className='card bg-base-100 border-base-300 cursor-pointer border text-left shadow-sm transition-shadow hover:shadow-md'
    >
      <div className='flex gap-3 p-3'>
        <div className='flex-shrink-0'>
          {!coverError ? (
            <GrimmoryImage
              src={thumbnailUrl}
              authHeader={authHeader}
              alt={book.metadata?.title || book.title || _('Book cover')}
              className='h-20 w-14 rounded object-cover shadow'
              onError={() => setCoverError(true)}
            />
          ) : (
            <div className='bg-base-300 flex h-20 w-14 items-center justify-center rounded text-2xl shadow'>
              📚
            </div>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <h3 className='line-clamp-2 text-sm font-semibold leading-snug'>
            {book.metadata?.title || book.title || _('Untitled')}
          </h3>
          {meta?.authors && meta.authors.length > 0 && (
            <p className='text-base-content/70 line-clamp-1 text-xs'>{meta.authors.join(', ')}</p>
          )}
          {meta?.seriesName && (
            <p className='text-base-content/50 line-clamp-1 text-xs italic'>
              {meta.seriesName}
              {meta.seriesNumber !== undefined && ` #${meta.seriesNumber}`}
            </p>
          )}
          <div className='mt-1 flex flex-wrap gap-1'>
            {primaryFile?.extension && (
              <span className='badge badge-ghost badge-xs font-mono uppercase'>
                {primaryFile.extension}
              </span>
            )}
            {primaryFile?.fileSizeKb !== undefined && (
              <span className='text-base-content/50 text-xs'>
                {formatFileSize(primaryFile.fileSizeKb)}
              </span>
            )}
          </div>
          {meta?.tags && meta.tags.length > 0 && (
            <div className='mt-1 flex flex-wrap gap-0.5'>
              {meta.tags.slice(0, 3).map((tag) => (
                <span key={tag} className='badge badge-outline badge-xs'>
                  {tag}
                </span>
              ))}
              {meta.tags.length > 3 && (
                <span className='text-base-content/40 text-xs'>+{meta.tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function BookList({ server, libraryId, libraryName, onBack, onSelectBook }: BookListProps) {
  const _ = useTranslation();
  const [books, setBooks] = useState<GrimmoryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = new GrimmoryClient(server);
      const data = await client.getBooks(libraryId);
      setBooks(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || _('Failed to load books.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server, libraryId]);

  const filteredBooks = books.filter((book) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (book.metadata?.title || book.title)?.toLowerCase().includes(q) ||
      book.metadata?.authors?.some((a) => a.toLowerCase().includes(q)) ||
      book.metadata?.tags?.some((t) => t.toLowerCase().includes(q)) ||
      book.metadata?.categories?.some((c) => c.toLowerCase().includes(q))
    );
  });

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='sticky top-0 z-10 bg-base-100/90 px-4 py-2 backdrop-blur-sm'>
        <button onClick={onBack} className='btn btn-ghost btn-sm'>
          <MdArrowBack className='h-4 w-4' />
          {_('Back')}
        </button>
        <h2 className='mt-1 text-base font-bold'>{libraryName}</h2>
        {!loading && !error && (
          <p className='text-base-content/60 text-xs'>
            {books.length} {books.length === 1 ? _('book') : _('books')}
          </p>
        )}
      </div>

      {/* Search */}
      {books.length > 5 && (
        <div className='px-4 py-2'>
          <input
            type='text'
            placeholder={_('Search books...')}
            className='input input-bordered w-full text-sm'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-4 pb-8'>
        {loading && (
          <div className='flex h-32 items-center justify-center'>
            <span className='loading loading-spinner loading-md' />
          </div>
        )}

        {!loading && error && (
          <div className='flex h-32 flex-col items-center justify-center text-center'>
            <p className='text-error text-sm'>{error}</p>
            <button
              onClick={fetchBooks}
              className='btn btn-ghost btn-sm mt-2'
            >
              {_('Retry')}
            </button>
          </div>
        )}

        {!loading && !error && filteredBooks.length === 0 && (
          <div className='flex h-32 items-center justify-center text-center'>
            <p className='text-base-content/60 text-sm'>
              {searchQuery ? _('No books match your search.') : _('No books in this library.')}
            </p>
          </div>
        )}

        {!loading && !error && filteredBooks.length > 0 && (
          <div className='grid grid-cols-1 gap-3 pt-2'>
            {filteredBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                server={server}
                onSelect={() => onSelectBook(book.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
