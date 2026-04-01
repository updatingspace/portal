/**
 * Simple Rich Text Editor with formatting toolbar
 * Using contentEditable for MVP, can be replaced with Lexical/TipTap later
 */
import { Button, Flex, Icon, Text } from '@gravity-ui/uikit';
import { Bold, Italic, ListUl, Link, Code } from '@gravity-ui/icons';
import { useCallback, useRef } from 'react';
import './RichTextEditor.css';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string, plainText: string) => void;
  error?: string;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  error,
  placeholder = 'Enter content...',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Execute formatting command
  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleChange();
  }, []);

  // Handle content change
  const handleChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const plainText = editorRef.current.textContent || '';
      onChange(html, plainText);
    }
  }, [onChange]);

  // Format as bold
  const handleBold = useCallback(() => {
    execCommand('bold');
  }, [execCommand]);

  // Format as italic
  const handleItalic = useCallback(() => {
    execCommand('italic');
  }, [execCommand]);

  // Insert unordered list
  const handleList = useCallback(() => {
    execCommand('insertUnorderedList');
  }, [execCommand]);

  // Insert link
  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  }, [execCommand]);

  // Format as code
  const handleCode = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const code = document.createElement('code');
      code.appendChild(range.extractContents());
      range.insertNode(code);
      handleChange();
    }
  }, [handleChange]);

  // Handle paste - strip formatting
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
      handleChange();
    },
    [handleChange]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            handleBold();
            break;
          case 'i':
            e.preventDefault();
            handleItalic();
            break;
          case 'k':
            e.preventDefault();
            handleLink();
            break;
        }
      }
    },
    [handleBold, handleItalic, handleLink]
  );

  return (
    <div className={`rich-editor ${error ? 'rich-editor--error' : ''}`}>
      {/* Toolbar */}
      <div className="rich-editor__toolbar">
        <Flex gap={1}>
          <Button
            view="flat"
            size="s"
            onClick={handleBold}
            title="Bold (Cmd+B)"
          >
            <Icon data={Bold} />
          </Button>
          <Button
            view="flat"
            size="s"
            onClick={handleItalic}
            title="Italic (Cmd+I)"
          >
            <Icon data={Italic} />
          </Button>
          <Button
            view="flat"
            size="s"
            onClick={handleList}
            title="Bullet List"
          >
            <Icon data={ListUl} />
          </Button>
          <Button
            view="flat"
            size="s"
            onClick={handleLink}
            title="Insert Link (Cmd+K)"
          >
            <Icon data={Link} />
          </Button>
          <Button
            view="flat"
            size="s"
            onClick={handleCode}
            title="Inline Code"
          >
            <Icon data={Code} />
          </Button>
        </Flex>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        className="rich-editor__content"
        contentEditable
        suppressContentEditableWarning
        onInput={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value }}
        role="textbox"
        aria-multiline="true"
        aria-label="Content editor"
      />

      {/* Error message */}
      {error && (
        <Text variant="body-1" color="danger" className="rich-editor__error">
          {error}
        </Text>
      )}
    </div>
  );
}
