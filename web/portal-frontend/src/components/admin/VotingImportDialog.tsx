import React, { useRef } from 'react';
import { Button, Dialog, Icon, Loader, Switch } from '@gravity-ui/uikit';
import FileArrowUp from '@gravity-ui/icons/FileArrowUp';

import type { VotingImportPreview } from '../../api/votings';

type Props = {
  open: boolean;
  rawJson: string;
  preview: VotingImportPreview | null;
  isPreviewLoading: boolean;
  isImporting: boolean;
  forceImport: boolean;
  error?: string | null;
  onClose: () => void;
  onChangeJson: (value: string) => void;
  onToggleForce: (next: boolean) => void;
  onPreview: () => void;
  onImport: () => void;
};

export const VotingImportDialog: React.FC<Props> = ({
  open,
  rawJson,
  preview,
  isPreviewLoading,
  isImporting,
  forceImport,
  error,
  onClose,
  onChangeJson,
  onToggleForce,
  onPreview,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChangeJson(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onClose={onClose} size="l" hasCloseButton>
      <Dialog.Header caption="Импорт голосования из JSON" />
      <Dialog.Body>
        <p className="text-muted small mb-3">
          Загрузите JSON с конфигурацией голосования. Перед добавлением покажем предпросмотр,
          чтобы избежать случайных изменений.
        </p>
        <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
          <Button
            size="m"
            view="flat-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon data={FileArrowUp} size={14} /> Загрузить файл
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleFileChange}
          />
          <Button
            size="m"
            view="outlined"
            onClick={onPreview}
            disabled={!rawJson.trim() || isPreviewLoading}
          >
            {isPreviewLoading ? 'Проверяем...' : 'Показать превью'}
          </Button>
          <Switch
            size="m"
            checked={forceImport}
            onChange={(event) => onToggleForce(event.target.checked)}
            content="Перезаписать при совпадении кода"
          />
        </div>
        <textarea
          className="admin-editable-textarea"
          rows={8}
          value={rawJson}
          onChange={(event) => onChangeJson(event.target.value)}
          placeholder='Вставьте JSON вида {"code":"main","title":"Голосование","nominations":[...]}'
        />
        {error ? <div className="text-warning small mt-2">{error}</div> : null}

        {isPreviewLoading ? (
          <div className="admin-loader-box mt-3">
            <Loader size="m" />
            <div className="text-muted small">Строим предпросмотр...</div>
          </div>
        ) : preview ? (
          <div className="status-block status-block-info mt-3">
            <div className="status-title">
              {preview.voting.title} <span className="text-muted">({preview.voting.code})</span>
            </div>
            <p className="text-muted mb-2">
              Номинаций: {preview.totals.nominations} · Карточек: {preview.totals.options} · Игр: {preview.totals.games}
            </p>
            {preview.willReplace ? (
              <div className="text-warning small mb-2">
                Голосование с кодом {preview.voting.code} уже существует. Включите перезапись, если готовы заменить данные.
              </div>
            ) : (
              <div className="text-muted small mb-2">Новых конфликтов не нашли.</div>
            )}
            <div className="admin-news-list">
              {preview.voting.nominations.slice(0, 4).map((item) => (
                <div key={item.id} className="admin-news-item">
                  <div className="admin-news-body">
                    <div className="admin-news-title">{item.title}</div>
                    <div className="text-muted small">
                      Карточек: {item.options.length} · Порядок: {item.order ?? 0}
                    </div>
                  </div>
                </div>
              ))}
              {preview.voting.nominations.length > 4 ? (
                <div className="text-muted small mt-1">
                  Показаны первые 4 номинации из {preview.voting.nominations.length}.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog.Body>
      <Dialog.Footer
        onClickButtonApply={onImport}
        onClickButtonCancel={onClose}
        textButtonCancel="Отмена"
        textButtonApply={isImporting ? 'Импортируем...' : 'Импортировать'}
        loading={isImporting}
        propsButtonApply={{ disabled: !preview || (preview.willReplace && !forceImport) }}
      />
    </Dialog>
  );
};
