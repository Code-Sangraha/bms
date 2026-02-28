import "./auth.scss";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="authLayout">{children}</div>;
}
