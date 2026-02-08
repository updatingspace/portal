import React, {useMemo} from 'react';
import {Text} from '@gravity-ui/uikit';
import {renderYfmHtml} from '../utils/yfm';

// ВАЖНО: стили YFM подключаем локально (можно вынести в общий entry позже)
import '@diplodoc/transform/dist/css/yfm.css';

type Props = {
    markup?: string | null;
    emptyText?: string;
    className?: string;
};

export const MarkdownPreview: React.FC<Props> = ({
    markup,
    emptyText = 'Описание пока не добавлено.',
    className,
}) => {
    const html = useMemo(() => renderYfmHtml(String(markup ?? '')), [markup]);

    if (!String(markup ?? '').trim()) {
        return <Text color="secondary">{emptyText}</Text>;
    }

    return (
        <div
            className={['yfm', className].filter(Boolean).join(' ')}
            dangerouslySetInnerHTML={{__html: html}}
        />
    );
};
