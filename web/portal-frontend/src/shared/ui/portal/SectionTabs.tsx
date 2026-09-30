import { Button } from '@gravity-ui/uikit';

/** A compact single-choice control with native button keyboard behavior. */
export function SectionTabs<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="portal-section-tabs" role="group" aria-label={label}>
      {items.map((item) => (
        <Button
          key={item.id}
          view="flat"
          size="xl"
          selected={value === item.id}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
