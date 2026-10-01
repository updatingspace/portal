/** A recognizable fallback until the community has its own artwork. */
export function CommunityMark({ name }: { name: string }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => Array.from(word)[0])
          .join('')
      : Array.from(words[0] ?? '')
          .slice(0, Array.from(words[0] ?? '').length <= 3 ? 3 : 1)
          .join('')
  ).toLocaleUpperCase();
  const tone =
    Array.from(name).reduce(
      (sum, character) => sum + character.codePointAt(0)!,
      0,
    ) % 4;
  return (
    <span
      className={`space-chooser__mark space-chooser__mark--${tone}`}
      aria-hidden="true"
    >
      <span>{initials}</span>
    </span>
  );
}
