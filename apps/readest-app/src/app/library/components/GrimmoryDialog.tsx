import { clsx } from 'clsx';
import { useTranslation } from '@/hooks/useTranslation';
import { GrimmoryServerManager } from '@/app/grimmory/components/ServerManager';
import Dialog from '@/components/Dialog';

interface GrimmoryDialogProps {
  onClose: () => void;
}

export function GrimmoryDialog({ onClose }: GrimmoryDialogProps) {
  const _ = useTranslation();
  return (
    <Dialog
      isOpen={true}
      title={_('Grimmory')}
      onClose={onClose}
      bgClassName={'sm:!bg-black/75'}
      boxClassName='sm:min-w-[520px] sm:w-3/4 sm:h-[85%] sm:!max-w-screen-sm'
    >
      <div className={clsx('bg-base-100 relative flex flex-col overflow-y-auto pb-4')}>
        <GrimmoryServerManager />
      </div>
    </Dialog>
  );
}
