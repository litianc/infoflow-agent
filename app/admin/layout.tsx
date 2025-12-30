// Parent layout for all admin routes - no auth check here
// Auth is handled in (dashboard) layout
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
