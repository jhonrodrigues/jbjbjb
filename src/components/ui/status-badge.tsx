import { Badge, type BadgeProps } from "./badge";

type Tone = NonNullable<BadgeProps["variant"]>;

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <Badge variant={tone}>{label}</Badge>;
}
