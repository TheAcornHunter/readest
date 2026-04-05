import { useCallback, useEffect, useMemo } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import { debounce } from '@/utils/debounce';

export const useGrimmorySync = (bookKey: string) => {
  const { settings } = useSettingsStore();
  const { getProgress, getView } = useReaderStore();
  const { getBookData } = useBookDataStore();

  const progress = getProgress(bookKey);

  const getLink = useCallback(() => {
    const bookHash = bookKey.split('-')[0];
    if (!bookHash) return null;
    const links = settings.grimmory?.bookLinks ?? [];
    return links.find((l) => l.bookHash === bookHash) ?? null;
  }, [bookKey, settings.grimmory?.bookLinks]);

  const getClient = useCallback(() => {
    const link = getLink();
    if (!link) return null;
    const server = (settings.grimmory?.servers ?? []).find((s) => s.id === link.serverId);
    if (!server) return null;
    return new GrimmoryClient(server);
  }, [getLink, settings.grimmory?.servers]);

  const pushProgress = useMemo(
    () =>
      debounce(async () => {
        const link = getLink();
        const client = getClient();
        if (!link || !client) return;

        const currentProgress = getProgress(bookKey);
        if (!currentProgress?.location) return;

        const view = getView(bookKey);
        const bookData = getBookData(bookKey);
        if (!view || !bookData) return;

        const pageInfo = currentProgress.pageinfo;
        const percentage =
          pageInfo && pageInfo.total > 0 ? (pageInfo.current + 1) / pageInfo.total : 0;

        let positionHref = '';
        try {
          const contents = view.renderer.getContents();
          const primaryIndex = view.renderer.primaryIndex;
          const content = contents.find((x) => x.index === primaryIndex) ?? contents[0];
          if (content) {
            positionHref = (content as { src?: string }).src ?? '';
          }
        } catch {
          // ignore renderer errors
        }

        try {
          await client.updateReadingProgress(
            link.bookId,
            link.fileId,
            currentProgress.location,
            positionHref,
            percentage,
          );
        } catch (e) {
          console.warn('[GrimmorySync] Failed to push progress:', e);
        }
      }, 5000),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bookKey, getLink, getClient],
  );

  useEffect(() => {
    return () => {
      pushProgress.flush();
    };
  }, [pushProgress]);

  useEffect(() => {
    if (!progress?.location) return;
    const link = getLink();
    if (!link) return;
    pushProgress();
  }, [progress?.location, getLink, pushProgress]);
};
