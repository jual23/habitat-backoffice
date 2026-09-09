export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'success' | 'neutral' | 'warning' | 'danger';
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
