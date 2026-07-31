import DOMPurify from 'dompurify';

/**
 * Санитизация HTML перед вставкой через dangerouslySetInnerHTML.
 *
 * DOMPurify по умолчанию вырезает <script>, обработчики on* (onerror/onclick),
 * javascript:-ссылки и прочие XSS-векторы, сохраняя безопасную форматирующую
 * разметку. Используется для админского rich-text контента, который затем
 * рендерится другим пользователям (stored XSS).
 */
export function sanitizeRichHtml(dirty: string | null | undefined): string {
  return DOMPurify.sanitize(String(dirty ?? ''), {
    USE_PROFILES: { html: true },
  });
}

/**
 * Санитизация SVG (например, QR-кода MFA, приходящего от бэкенда).
 *
 * Разрешаем SVG-разметку, но вырезаем script и on*-обработчики, которые может
 * нести вредоносный SVG, выдаваемый за изображение.
 */
export function sanitizeSvg(dirty: string | null | undefined): string {
  return DOMPurify.sanitize(String(dirty ?? ''), {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
