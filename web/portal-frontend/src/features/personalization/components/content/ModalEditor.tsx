/**
 * Modal editor with WYSIWYG editing and live preview
 */
import {
  Button,
  Card,
  Checkbox,
  Icon,
  Select,
  Tab,
  TabList,
  TabPanel,
  TabProvider,
  Text,
  TextInput,
} from '@gravity-ui/uikit';
import { Eye, Xmark } from '@gravity-ui/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  HomePageModal,
  HomePageModalInput,
  ModalFormState,
  ModalType,
  ModalTranslations,
} from '../../types';
import { ModalPreview } from './ModalPreview';
import { RichTextEditor } from './RichTextEditor';
import './ModalEditor.css';

interface ModalEditorProps {
  modal?: HomePageModal | null;
  onSave: (data: HomePageModalInput) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

const MODAL_TYPE_OPTIONS = [
  { value: 'info', content: 'Information' },
  { value: 'warning', content: 'Warning' },
  { value: 'success', content: 'Success' },
  { value: 'promo', content: 'Promotion' },
];

const INITIAL_FORM_STATE: ModalFormState = {
  title: '',
  content: '',
  contentHtml: '',
  buttonText: 'OK',
  buttonUrl: '',
  modalType: 'info',
  isActive: true,
  displayOnce: false,
  startDate: null,
  endDate: null,
  order: 0,
  translations: {},
};

/**
 * Convert modal to form state
 */
function modalToFormState(modal: HomePageModal): ModalFormState {
  return {
    title: modal.title,
    content: modal.content,
    contentHtml: modal.content_html || '',
    buttonText: modal.button_text,
    buttonUrl: modal.button_url,
    modalType: modal.modal_type,
    isActive: modal.is_active,
    displayOnce: modal.display_once,
    startDate: modal.start_date ? new Date(modal.start_date) : null,
    endDate: modal.end_date ? new Date(modal.end_date) : null,
    order: modal.order,
    translations: modal.translations || {},
  };
}

/**
 * Convert form state to API input
 */
function formStateToInput(state: ModalFormState): HomePageModalInput {
  return {
    title: state.title,
    content: state.content,
    content_html: state.contentHtml,
    button_text: state.buttonText,
    button_url: state.buttonUrl,
    modal_type: state.modalType,
    is_active: state.isActive,
    display_once: state.displayOnce,
    start_date: state.startDate?.toISOString() || null,
    end_date: state.endDate?.toISOString() || null,
    order: state.order,
    translations: Object.keys(state.translations).length > 0 ? state.translations : undefined,
  };
}

export function ModalEditor({
  modal,
  onSave,
  onCancel,
  isSaving,
}: ModalEditorProps) {
  const [formState, setFormState] = useState<ModalFormState>(INITIAL_FORM_STATE);
  const [activeTab, setActiveTab] = useState('content');
  const [previewLanguage, setPreviewLanguage] = useState('en');
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isEditing = !!modal;

  // Initialize form state when modal changes
  useEffect(() => {
    if (modal) {
      setFormState(modalToFormState(modal));
    } else {
      setFormState(INITIAL_FORM_STATE);
    }
  }, [modal]);

  // Update field
  const updateField = useCallback(
    <K extends keyof ModalFormState>(field: K, value: ModalFormState[K]) => {
      setFormState((prev) => ({ ...prev, [field]: value }));
      // Clear error when field is updated
      if (errors[field]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    },
    [errors]
  );

  // Validate form
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formState.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formState.content.trim() && !formState.contentHtml.trim()) {
      newErrors.content = 'Content is required';
    }

    if (formState.endDate && formState.startDate) {
      if (formState.endDate < formState.startDate) {
        newErrors.endDate = 'End date must be after start date';
      }
    }

    if (formState.buttonUrl && !isValidUrl(formState.buttonUrl)) {
      newErrors.buttonUrl = 'Please enter a valid URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formState]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validate()) return;

    await onSave(formStateToInput(formState));
  }, [formState, onSave, validate]);

  // Preview data
  const previewData = useMemo(() => {
    const translated =
      previewLanguage !== 'en' && formState.translations[previewLanguage]
        ? {
            title: formState.translations[previewLanguage].title || formState.title,
            content:
              formState.translations[previewLanguage].content || formState.content,
            button_text:
              formState.translations[previewLanguage].button_text ||
              formState.buttonText,
          }
        : {
            title: formState.title,
            content: formState.content,
            button_text: formState.buttonText,
          };

    return {
      ...translated,
      content_html: formState.contentHtml,
      button_url: formState.buttonUrl,
      modal_type: formState.modalType,
    };
  }, [formState, previewLanguage]);

  return (
    <div className="modal-editor">
      <div className="modal-editor__header">
        <Text variant="header-1">
          {isEditing ? 'Edit Modal' : 'Create Modal'}
        </Text>
        <Button view="flat" onClick={onCancel}>
          <Icon data={Xmark} />
        </Button>
      </div>

      <div className="modal-editor__body">
        {/* Editor Form */}
        <div className="modal-editor__form">
          <TabProvider value={activeTab} onUpdate={setActiveTab}>
            <TabList>
              <Tab value="content">Content</Tab>
              <Tab value="settings">Settings</Tab>
              <Tab value="translations">Translations</Tab>
            </TabList>

            <div className="modal-editor__tab-content">
              {/* Content Tab */}
              <TabPanel value="content">
              <div className="modal-editor__fields">
                <div className="modal-editor__field">
                  <TextInput
                    label="Title"
                    value={formState.title}
                    onUpdate={(value) => updateField('title', value)}
                    error={errors.title}
                    placeholder="Enter modal title"
                    autoFocus
                  />
                </div>

                <div className="modal-editor__field">
                  <Text variant="body-1" className="modal-editor__label">
                    Content
                  </Text>
                  <RichTextEditor
                    value={formState.contentHtml || formState.content}
                    onChange={(html, plain) => {
                      updateField('contentHtml', html);
                      updateField('content', plain);
                    }}
                    error={errors.content}
                  />
                </div>

                <div className="modal-editor__field-row">
                  <TextInput
                    label="Button Text"
                    value={formState.buttonText}
                    onUpdate={(value) => updateField('buttonText', value)}
                    placeholder="OK"
                  />
                  <TextInput
                    label="Button URL (optional)"
                    value={formState.buttonUrl}
                    onUpdate={(value) => updateField('buttonUrl', value)}
                    error={errors.buttonUrl}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="modal-editor__field">
                  <Select
                    label="Modal Type"
                    value={[formState.modalType]}
                    options={MODAL_TYPE_OPTIONS}
                    onUpdate={([value]) =>
                      updateField('modalType', value as ModalType)
                    }
                    width="max"
                  />
                </div>
              </div>
              </TabPanel>

              {/* Settings Tab */}
              <TabPanel value="settings">
              <div className="modal-editor__fields">
                <Card className="modal-editor__card">
                  <Text variant="subheader-1">Display Settings</Text>
                  <div className="modal-editor__checkboxes">
                    <Checkbox
                      checked={formState.isActive}
                      onUpdate={(checked) => updateField('isActive', checked)}
                    >
                      Active (visible to users)
                    </Checkbox>
                    <Checkbox
                      checked={formState.displayOnce}
                      onUpdate={(checked) => updateField('displayOnce', checked)}
                    >
                      Show only once per user
                    </Checkbox>
                  </div>
                </Card>

                <Card className="modal-editor__card">
                  <Text variant="subheader-1">Schedule</Text>
                  <div className="modal-editor__field-row">
                    <div className="modal-editor__field">
                      <Text variant="body-1" className="modal-editor__label">
                        Start Date
                      </Text>
                      <input
                        type="datetime-local"
                        className="modal-editor__datetime"
                        value={
                          formState.startDate
                            ? formState.startDate.toISOString().slice(0, 16)
                            : ''
                        }
                        onChange={(e) =>
                          updateField(
                            'startDate',
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                    </div>
                    <div className="modal-editor__field">
                      <Text variant="body-1" className="modal-editor__label">
                        End Date
                      </Text>
                      <input
                        type="datetime-local"
                        className="modal-editor__datetime"
                        value={
                          formState.endDate
                            ? formState.endDate.toISOString().slice(0, 16)
                            : ''
                        }
                        onChange={(e) =>
                          updateField(
                            'endDate',
                            e.target.value ? new Date(e.target.value) : null
                          )
                        }
                      />
                      {errors.endDate && (
                        <Text
                          variant="body-1"
                          color="danger"
                          className="modal-editor__error"
                        >
                          {errors.endDate}
                        </Text>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="modal-editor__card">
                  <Text variant="subheader-1">Display Order</Text>
                  <TextInput
                    type="number"
                    value={String(formState.order)}
                    onUpdate={(value) => updateField('order', parseInt(value) || 0)}
                    placeholder="0"
                    note="Lower numbers display first"
                  />
                </Card>
              </div>
              </TabPanel>

              {/* Translations Tab */}
              <TabPanel value="translations">
                <div className="modal-editor__fields">
                  <TranslationsEditor
                    translations={formState.translations}
                    onChange={(translations) =>
                      updateField('translations', translations)
                    }
                    defaultTitle={formState.title}
                    defaultContent={formState.content}
                    defaultButtonText={formState.buttonText}
                  />
                </div>
              </TabPanel>
            </div>
          </TabProvider>
        </div>

        {/* Live Preview */}
        <div className="modal-editor__preview">
          <div className="modal-editor__preview-header">
            <Text variant="subheader-1">Live Preview</Text>
            <div className="modal-editor__preview-controls">
              <Select
                value={[previewLanguage]}
                options={[
                  { value: 'en', content: 'English' },
                  { value: 'ru', content: 'Русский' },
                ]}
                onUpdate={([value]) => setPreviewLanguage(value)}
                width={120}
              />
              <Button
                view="flat"
                onClick={() => setShowFullPreview(true)}
                title="Full screen preview"
              >
                <Icon data={Eye} />
              </Button>
            </div>
          </div>
          <div className="modal-editor__preview-frame">
            <ModalPreview
              title={previewData.title}
              content={previewData.content}
              contentHtml={previewData.content_html}
              buttonText={previewData.button_text}
              buttonUrl={previewData.button_url}
              modalType={previewData.modal_type}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="modal-editor__footer">
        <Button view="flat" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button view="action" onClick={handleSave} loading={isSaving}>
          {isEditing ? 'Save Changes' : 'Create Modal'}
        </Button>
      </div>

      {/* Full screen preview */}
      {showFullPreview && (
        <div
          className="modal-editor__fullscreen-preview"
          onClick={() => setShowFullPreview(false)}
        >
          <ModalPreview
            title={previewData.title}
            content={previewData.content}
            contentHtml={previewData.content_html}
            buttonText={previewData.button_text}
            buttonUrl={previewData.button_url}
            modalType={previewData.modal_type}
            fullscreen
          />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Translations Editor
// =============================================================================

interface TranslationsEditorProps {
  translations: ModalTranslations;
  onChange: (translations: ModalTranslations) => void;
  defaultTitle: string;
  defaultContent: string;
  defaultButtonText: string;
}

function TranslationsEditor({
  translations,
  onChange,
  defaultTitle,
  defaultContent,
  defaultButtonText,
}: TranslationsEditorProps) {
  const [activeLanguage, setActiveLanguage] = useState('ru');

  const currentTranslation = translations[activeLanguage] || {};

  const updateTranslation = (
    field: 'title' | 'content' | 'button_text',
    value: string
  ) => {
    onChange({
      ...translations,
      [activeLanguage]: {
        ...currentTranslation,
        [field]: value,
      },
    });
  };

  return (
    <div className="translations-editor">
      <Text variant="body-1" color="secondary" className="translations-editor__note">
        Add translations for different languages. English is the default
        language.
      </Text>

      <TabProvider value={activeLanguage} onUpdate={setActiveLanguage}>
        <TabList>
          <Tab value="ru">Русский</Tab>
        </TabList>

        <TabPanel value="ru">
          <div className="translations-editor__fields">
            <TextInput
              label="Title"
              value={currentTranslation.title || ''}
              onUpdate={(value) => updateTranslation('title', value)}
              placeholder={defaultTitle}
            />
            <div className="modal-editor__field">
              <Text variant="body-1" className="modal-editor__label">
                Content
              </Text>
              <textarea
                className="modal-editor__textarea"
                value={currentTranslation.content || ''}
                onChange={(e) => updateTranslation('content', e.target.value)}
                placeholder={defaultContent}
                rows={4}
              />
            </div>
            <TextInput
              label="Button Text"
              value={currentTranslation.button_text || ''}
              onUpdate={(value) => updateTranslation('button_text', value)}
              placeholder={defaultButtonText}
            />
          </div>
        </TabPanel>
      </TabProvider>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function isValidUrl(string: string): boolean {
  if (!string) return true; // Empty is valid (optional field)
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}
