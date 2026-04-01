import type { NewsMediaItem } from '../../../types/activity';

export const YOUTUBE_REGEX =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/gi;
export const TAG_REGEX = /#([\p{L}\p{N}_-]{2,})/gu;
export const TITLE_REGEX = /^#\s+(.+)$/m;

export const extractTitle = (markup: string) => {
  const match = markup.match(TITLE_REGEX);
  return match?.[1]?.trim() ?? '';
};

export const extractTags = (markup: string) => {
  const withoutTitle = markup.replace(TITLE_REGEX, '');
  const tags = new Set<string>();
  const matches = withoutTitle.matchAll(TAG_REGEX);
  for (const match of matches) {
    const tag = match[1]?.toLowerCase();
    if (tag) tags.add(tag);
  }
  return Array.from(tags);
};

export const extractYoutubeIds = (markup: string) => {
  const ids = new Set<string>();
  const matches = markup.matchAll(YOUTUBE_REGEX);
  for (const match of matches) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
};

export const mapYoutubeMediaFromIds = (ids: string[]): NewsMediaItem[] =>
  ids.map((id) => ({
    type: 'youtube',
    url: `https://youtu.be/${id}`,
    video_id: id,
  }));
