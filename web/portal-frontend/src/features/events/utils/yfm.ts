import transform from '@diplodoc/transform';

export function renderYfmHtml(markup: string) {
    const {result} = transform(markup ?? '', {
        sanitizeHtml: true,
    });

    return result.html;
}
