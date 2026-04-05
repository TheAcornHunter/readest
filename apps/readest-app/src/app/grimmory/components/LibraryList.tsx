'use client';

import { useEffect, useState } from 'react';
import { MdArrowBack } from 'react-icons/md';
import { IoBook } from 'react-icons/io5';
import { useTranslation } from '@/hooks/useTranslation';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import type { GrimmoryLibrary, GrimmoryServer } from '@/types/grimmory';

interface LibraryListProps {
  server: GrimmoryServer;
  onBack: () => void;
  onSelectLibrary: (library: GrimmoryLibrary) => void;
}

export function LibraryList({ server, onBack, onSelectLibrary }: LibraryListProps) {
  const _ = useTranslation();
  const [libraries, setLibraries] = useState<GrimmoryLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLibraries = async () => {
    setLoading(true);
    setError(null);
    try {
      const client = new GrimmoryClient(server);
      const data = await client.getLibraries();
      setLibraries(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || _('Failed to load libraries.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='sticky top-0 z-10 bg-base-100/90 px-4 py-2 backdrop-blur-sm'>
        <button onClick={onBack} className='btn btn-ghost btn-sm'>
          <MdArrowBack className='h-4 w-4' />
          {_('Back')}
        </button>
        <h2 className='mt-1 text-base font-bold'>{server.name}</h2>
        <p className='text-base-content/60 text-xs'>{server.url}</p>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto px-4 pb-8'>
        {loading && (
          <div className='flex h-32 items-center justify-center'>
            <span className='loading loading-spinner loading-md' />
          </div>
        )}

        {!loading && error && (
          <div className='flex h-32 flex-col items-center justify-center text-center'>
            <p className='text-error mb-3 text-sm'>{error}</p>
            <button onClick={fetchLibraries} className='btn btn-ghost btn-sm'>
              {_('Retry')}
            </button>
          </div>
        )}

        {!loading && !error && libraries.length === 0 && (
          <div className='flex h-32 items-center justify-center text-center'>
            <p className='text-base-content/60 text-sm'>{_('No libraries found.')}</p>
          </div>
        )}

        {!loading && !error && libraries.length > 0 && (
          <div className='grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2'>
            {libraries.map((library) => (
              <button
                key={library.id}
                onClick={() => onSelectLibrary(library)}
                className='card bg-base-100 border-base-300 cursor-pointer border text-left shadow-sm transition-shadow hover:shadow-md'
              >
                <div className='card-body p-4'>
                  <div className='flex items-center gap-3'>
                    <span className='text-2xl'>{library.icon || '📚'}</span>
                    <div className='min-w-0'>
                      <h3 className='card-title line-clamp-1 text-sm'>{library.name}</h3>
                      {library.paths && library.paths.length > 0 && (
                        <p className='text-base-content/50 line-clamp-1 text-xs'>
                          {library.paths[0]?.path}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className='mt-2 flex items-center gap-1 text-xs'>
                    <IoBook className='text-base-content/40 h-3 w-3' />
                    <span className='text-base-content/60'>{_('Browse books')}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
