'use client';

import clsx from 'clsx';
import { useState } from 'react';
import { IoAdd, IoTrash, IoBook, IoOpenOutline } from 'react-icons/io5';
import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { isWebAppPlatform } from '@/services/environment';
import { saveSysSettings } from '@/helpers/settings';
import { isLanAddress } from '@/utils/network';
import { GrimmoryClient } from '@/services/grimmory/GrimmoryClient';
import type { GrimmoryServer } from '@/types/grimmory';
import ModalPortal from '@/components/ModalPortal';

const EMPTY_NEW_SERVER = {
  name: '',
  url: '',
  username: '',
  password: '',
};

export function GrimmoryServerManager({ onOpenServer }: { onOpenServer?: (server: GrimmoryServer) => void }) {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const [servers, setServers] = useState<GrimmoryServer[]>(
    () => settings.grimmory?.servers ?? [],
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newServer, setNewServer] = useState(EMPTY_NEW_SERVER);
  const [showPassword, setShowPassword] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const saveServers = (updated: GrimmoryServer[]) => {
    setServers(updated);
    saveSysSettings(envConfig, 'grimmory', { servers: updated });
  };

  const handleConnect = async () => {
    if (!newServer.name || !newServer.url) return;

    const urlLower = newServer.url.trim().toLowerCase();
    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
      setUrlError(_('URL must start with http:// or https://'));
      return;
    }

    if (
      process.env['NODE_ENV'] === 'production' &&
      isWebAppPlatform() &&
      isLanAddress(newServer.url)
    ) {
      setUrlError(_('Adding LAN addresses is not supported in the web app version.'));
      return;
    }

    setIsConnecting(true);
    setUrlError('');
    setLoginError('');

    try {
      const tempServer: GrimmoryServer = {
        id: Date.now().toString(),
        name: newServer.name,
        url: newServer.url,
      };
      const client = new GrimmoryClient(tempServer);

      // Verify server is reachable
      try {
        await client.getVersion();
      } catch {
        setUrlError(_('Could not reach the Grimmory server. Please check the URL.'));
        setIsConnecting(false);
        return;
      }

      // Login if credentials provided
      let token: string | undefined;
      let refreshToken: string | undefined;
      if (newServer.username && newServer.password) {
        try {
          const loginResp = await client.login(newServer.username, newServer.password);
          token = loginResp.token;
          refreshToken = loginResp.refreshToken;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setLoginError(msg || _('Login failed. Please check your credentials.'));
          setIsConnecting(false);
          return;
        }
      } else if (newServer.username || newServer.password) {
        setLoginError(_('Please provide both username and password.'));
        setIsConnecting(false);
        return;
      }

      const server: GrimmoryServer = {
        id: tempServer.id,
        name: newServer.name,
        url: newServer.url,
        username: newServer.username || undefined,
        token,
        refreshToken,
      };

      saveServers([server, ...servers]);
      setNewServer(EMPTY_NEW_SERVER);
      setShowAddDialog(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRemoveServer = (id: string) => {
    saveServers(servers.filter((s) => s.id !== id));
  };

  const handleOpenServer = (server: GrimmoryServer) => {
    if (onOpenServer) {
      onOpenServer(server);
    } else {
      router.push(`/grimmory?id=${encodeURIComponent(server.id)}`);
    }
  };

  const handleCloseDialog = () => {
    setShowAddDialog(false);
    setNewServer(EMPTY_NEW_SERVER);
    setUrlError('');
    setLoginError('');
    setShowPassword(false);
  };

  return (
    <div className='container max-w-2xl'>
      <div className='mb-8'>
        <h1 className='mb-2 text-base font-bold'>{_('Grimmory Servers')}</h1>
        <p className='text-base-content/70 text-xs'>
          {_('Connect to Grimmory servers to browse and download books')}
        </p>
      </div>

      <section className='mb-12 text-base'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='font-semibold'>{_('My Servers')}</h2>
          <button onClick={() => setShowAddDialog(true)} className='btn btn-primary btn-sm'>
            <IoAdd className='h-4 w-4' />
            {_('Add Server')}
          </button>
        </div>

        {servers.length === 0 ? (
          <div className='border-base-300 rounded-lg border-2 border-dashed p-12 text-center'>
            <IoBook className='text-base-content/30 mx-auto mb-4 h-12 w-12' />
            <h3 className='mb-2 font-semibold'>{_('No servers yet')}</h3>
            <p className='text-base-content/70 mb-4 text-sm'>
              {_('Add your first Grimmory server to start browsing books')}
            </p>
            <button onClick={() => setShowAddDialog(true)} className='btn btn-primary btn-sm'>
              {_('Add Your First Server')}
            </button>
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            {servers.map((server) => (
              <div
                key={server.id}
                className='card bg-base-100 border-base-300 h-full border shadow-sm transition-shadow hover:shadow-md'
              >
                <div className='card-body h-full justify-between p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='min-w-0 flex-1'>
                      <div className='mb-1 flex items-center justify-between'>
                        <h3 className='card-title line-clamp-1 text-sm'>{server.name}</h3>
                        <button
                          onClick={() => handleRemoveServer(server.id)}
                          className='btn btn-ghost btn-xs btn-square'
                          title={_('Remove')}
                        >
                          <IoTrash className='h-4 w-4' />
                        </button>
                      </div>
                      <p className='text-base-content/60 line-clamp-1 text-xs'>{server.url}</p>
                      {server.username && (
                        <p className='text-base-content/50 text-xs'>
                          {_('User')}: {server.username}
                        </p>
                      )}
                      {server.token && (
                        <span className='badge badge-success badge-sm mt-1 text-xs'>
                          {_('Connected')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='card-actions mt-2 justify-end'>
                    <button
                      onClick={() => handleOpenServer(server)}
                      className='btn btn-primary btn-sm'
                    >
                      <IoOpenOutline className='h-4 w-4' />
                      {_('Browse')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showAddDialog && (
        <ModalPortal>
          <div className='modal modal-open'>
            <div className='modal-box max-w-md'>
              <h3 className='mb-4 text-lg font-bold'>{_('Add Grimmory Server')}</h3>

              <div className='space-y-4'>
                <div className='form-control'>
                  <label className='label'>
                    <span className='label-text'>{_('Server Name')}</span>
                  </label>
                  <input
                    type='text'
                    placeholder={_('My Grimmory Server')}
                    className='input input-bordered w-full'
                    value={newServer.name}
                    onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  />
                </div>

                <div className='form-control'>
                  <label className='label'>
                    <span className='label-text'>{_('Server URL')}</span>
                  </label>
                  <input
                    type='url'
                    placeholder='https://grimmory.example.com'
                    className={clsx('input input-bordered w-full', urlError && 'input-error')}
                    value={newServer.url}
                    onChange={(e) => {
                      setNewServer({ ...newServer, url: e.target.value });
                      setUrlError('');
                    }}
                  />
                  {urlError && <p className='text-error mt-1 text-xs'>{urlError}</p>}
                </div>

                <div className='divider text-sm'>{_('Authentication (Optional)')}</div>

                <div className='form-control'>
                  <label className='label'>
                    <span className='label-text'>{_('Username')}</span>
                  </label>
                  <input
                    type='text'
                    placeholder={_('Username')}
                    className='input input-bordered w-full'
                    autoComplete='username'
                    value={newServer.username}
                    onChange={(e) => {
                      setNewServer({ ...newServer, username: e.target.value });
                      setLoginError('');
                    }}
                  />
                </div>

                <div className='form-control'>
                  <label className='label'>
                    <span className='label-text'>{_('Password')}</span>
                  </label>
                  <div className='join w-full'>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={_('Password')}
                      className={clsx(
                        'input input-bordered join-item w-full',
                        loginError && 'input-error',
                      )}
                      autoComplete='current-password'
                      value={newServer.password}
                      onChange={(e) => {
                        setNewServer({ ...newServer, password: e.target.value });
                        setLoginError('');
                      }}
                    />
                    <button
                      type='button'
                      className='btn btn-outline join-item'
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? _('Hide') : _('Show')}
                    </button>
                  </div>
                  {loginError && <p className='text-error mt-1 text-xs'>{loginError}</p>}
                </div>
              </div>

              <div className='modal-action'>
                <button onClick={handleCloseDialog} className='btn btn-ghost'>
                  {_('Cancel')}
                </button>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !newServer.name || !newServer.url}
                  className='btn btn-primary'
                >
                  {isConnecting && <span className='loading loading-spinner loading-sm' />}
                  {_('Connect')}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
