import React, { useEffect, useState } from 'react';
import { Modal, Loader, Link } from '@gravity-ui/uikit';
import { getBuildId } from '../utils/version';
import { fetchBackendVersion, type VersionInfo } from '../api/version';
import { logger } from '../utils/logger';

interface AboutProjectModalProps {
  open: boolean;
  onClose: () => void;
}

const REPOSITORY_URL = 'https://github.com/updatingspace/aef-vote';

export const AboutProjectModal: React.FC<AboutProjectModalProps> = ({ open, onClose }) => {
  const [backendVersion, setBackendVersion] = useState<VersionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frontendBuildId = getBuildId();

  useEffect(() => {
    if (!open) return;

    const loadBackendVersion = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const version = await fetchBackendVersion();
        setBackendVersion(version);
      } catch (err) {
        logger.error('Failed to fetch backend version', { error: err });
        setError('Не удалось загрузить версию бэкенда');
      } finally {
        setIsLoading(false);
      }
    };

    loadBackendVersion();
  }, [open]);

  return (
    <Modal open={open} onClose={onClose}>
      <div style={{ padding: '24px', minWidth: '400px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
          <div className="logo-box" style={{ fontSize: '14px', padding: '8px 12px' }}>
            Логотип<br />от Альжумже
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>AEF Vote</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--g-color-text-secondary)', fontSize: '14px' }}>
              Платформа для голосования
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Информация о версии</h3>
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
              <Loader size="m" />
            </div>
          )}

          {error && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'var(--g-color-base-warning-light)', 
              borderRadius: '8px',
              marginBottom: '12px'
            }}>
              <p style={{ margin: 0, fontSize: '14px' }}>{error}</p>
            </div>
          )}

          {!isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontWeight: 500 }}>Фронтенд:</span>
                <code style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '13px',
                  backgroundColor: 'var(--g-color-base-generic-hover)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {frontendBuildId}
                </code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ fontWeight: 500 }}>Бэкенд:</span>
                <code style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '13px',
                  backgroundColor: 'var(--g-color-base-generic-hover)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {backendVersion?.build_id ?? '—'}
                </code>
              </div>
            </div>
          )}
        </div>

        <div style={{ 
          padding: '16px', 
          backgroundColor: 'var(--g-color-base-generic-hover)',
          borderRadius: '8px',
          marginBottom: '16px'
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
            Это open-source проект для проведения голосований и выбора лучших игр.
          </p>
          <p style={{ margin: 0, fontSize: '14px' }}>
            Подробнее о проекте и актуальная версия доступны в репозитории.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer" view="normal">
            Репозиторий проекта на GitHub
          </Link>
        </div>
      </div>
    </Modal>
  );
};
