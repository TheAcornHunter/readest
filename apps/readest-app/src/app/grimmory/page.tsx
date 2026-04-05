'use client';

import clsx from 'clsx';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { GrimmoryServerManager } from './components/ServerManager';
import { LibraryList } from './components/LibraryList';
import { BookList } from './components/BookList';
import { BookDetail } from './components/BookDetail';
import type { GrimmoryLibrary, GrimmoryServer } from '@/types/grimmory';

type ViewMode = 'servers' | 'libraries' | 'books' | 'bookDetail';

interface GrimmoryState {
  server: GrimmoryServer | null;
  library: GrimmoryLibrary | null;
  bookId: number | null;
}

function GrimmoryPageContent() {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { safeAreaInsets, isRoundedWindow } = useThemeStore();
  const { settings } = useSettingsStore();

  const [viewMode, setViewMode] = useState<ViewMode>('servers');
  const [state, setState] = useState<GrimmoryState>({
    server: null,
    library: null,
    bookId: null,
  });

  useTheme({ systemUIVisible: false });

  // Initialize from URL params - navigate to server's libraries view
  useEffect(() => {
    const serverId = searchParams?.get('id');
    if (serverId) {
      const servers = settings.grimmory?.servers ?? [];
      const server = servers.find((s) => s.id === serverId);
      if (server) {
        // When loading from URL, navigate to the libraries view.
        // Deep-linking to books is handled via the handleSelectLibrary flow.
        setState({ server, library: null, bookId: null });
        setViewMode('libraries');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectServer = (server: GrimmoryServer) => {
    setState({ server, library: null, bookId: null });
    setViewMode('libraries');
    router.push(`/grimmory?id=${encodeURIComponent(server.id)}`);
  };

  const handleSelectLibrary = (library: GrimmoryLibrary) => {
    setState((prev) => ({ ...prev, library, bookId: null }));
    setViewMode('books');
    if (state.server) {
      router.push(
        `/grimmory?id=${encodeURIComponent(state.server.id)}&lib=${library.id}`,
      );
    }
  };

  const handleSelectBook = (bookId: number) => {
    setState((prev) => ({ ...prev, bookId }));
    setViewMode('bookDetail');
    if (state.server && state.library) {
      router.push(
        `/grimmory?id=${encodeURIComponent(state.server.id)}&lib=${state.library.id}&book=${bookId}`,
      );
    }
  };

  const handleBackToServers = () => {
    setState({ server: null, library: null, bookId: null });
    setViewMode('servers');
    router.push('/grimmory');
  };

  const handleBackToLibraries = () => {
    setState((prev) => ({ ...prev, library: null, bookId: null }));
    setViewMode('libraries');
    if (state.server) {
      router.push(`/grimmory?id=${encodeURIComponent(state.server.id)}`);
    }
  };

  const handleBackToBooks = () => {
    setState((prev) => ({ ...prev, bookId: null }));
    setViewMode('books');
    if (state.server && state.library) {
      router.push(
        `/grimmory?id=${encodeURIComponent(state.server.id)}&lib=${state.library.id}`,
      );
    }
  };

  if (!safeAreaInsets) return null;

  return (
    <div
      className={clsx(
        'bg-base-100 flex h-screen flex-col',
        isRoundedWindow && 'rounded-window',
      )}
      style={{
        paddingTop: safeAreaInsets.top,
        paddingBottom: safeAreaInsets.bottom,
        paddingLeft: safeAreaInsets.left,
        paddingRight: safeAreaInsets.right,
      }}
    >
      {/* Top bar */}
      <div className='titlebar flex h-12 items-center justify-between px-4 sm:h-10'>
        <h1 className='text-base-content text-base font-bold'>
          {viewMode === 'servers' && _('Grimmory')}
          {viewMode === 'libraries' && (state.server?.name || _('Libraries'))}
          {viewMode === 'books' && (state.library?.name || _('Books'))}
          {viewMode === 'bookDetail' && _('Book Details')}
        </h1>
        <button
          onClick={() => router.push('/library')}
          className='btn btn-ghost btn-sm text-xs'
          aria-label={_('Back to Library')}
        >
          {_('Close')}
        </button>
      </div>

      {/* Content */}
      <div className='flex-1 overflow-hidden'>
        {viewMode === 'servers' && (
          <div className='h-full overflow-y-auto p-4'>
            <GrimmoryServerManager onOpenServer={handleSelectServer} />
          </div>
        )}

        {viewMode === 'libraries' && state.server && (
          <LibraryList
            server={state.server}
            onBack={handleBackToServers}
            onSelectLibrary={handleSelectLibrary}
          />
        )}

        {viewMode === 'books' && state.server && state.library && (
          <BookList
            server={state.server}
            libraryId={state.library.id}
            libraryName={state.library.name}
            onBack={handleBackToLibraries}
            onSelectBook={handleSelectBook}
          />
        )}

        {viewMode === 'bookDetail' && state.server && state.library && state.bookId && (
          <BookDetail
            server={state.server}
            libraryId={state.library.id}
            bookId={state.bookId}
            onBack={handleBackToBooks}
          />
        )}
      </div>
    </div>
  );
}

export default function GrimmoryPage() {
  return (
    <Suspense>
      <GrimmoryPageContent />
    </Suspense>
  );
}
