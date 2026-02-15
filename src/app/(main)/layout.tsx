import Link from "next/link";
import { logout } from "@/app/(main)/actions";

const navItems = [
  { href: "/forecast", label: "Calendar" },
  { href: "/trainers", label: "Trainers" },
  { href: "/dogs", label: "Dogs" },
  { href: "/classes", label: "Classes" },
];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-muted/40 p-4 flex flex-col gap-1">
        <h1 className="text-lg font-bold mb-4 px-2">GDF Scheduler</h1>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <form action={logout} className="mt-auto pt-4">
            <button
              type="submit"
              className="w-full text-left px-3 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
            >
              Logout
            </button>
          </form>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
