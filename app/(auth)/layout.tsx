/**
 * Bare passthrough — auth pages now style their own full-page layout via
 * shadcn Card components. Kept for compatibility with route imports.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
