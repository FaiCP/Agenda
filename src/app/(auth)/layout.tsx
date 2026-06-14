import Link from "next/link";
import { CalendarDays } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4">
      <Link
        href="/"
        className="mb-6 flex items-center gap-2 text-xl font-semibold"
      >
        <CalendarDays className="h-6 w-6 text-primary" />
        AgendaPro
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
