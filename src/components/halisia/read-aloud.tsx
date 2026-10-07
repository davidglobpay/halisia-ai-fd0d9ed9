import { ListenButton } from "./listen-button";
/** Shared browser reader: no paid voice call and one active tile at a time. */
export function ReadAloud({
  text,
  label = "Listen",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  if (!text?.trim()) return null;
  return (
    <span data-testid="read-aloud" className={className}>
      <ListenButton text={text} label={label} />
    </span>
  );
}
