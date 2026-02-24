"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Star,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Github,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    href: "/updates",
    label: "Updates",
    icon: <Bell className="size-4" />,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: <Settings className="size-4" />,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const userInitials = session.user.username
    ? session.user.username.slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4">
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </Button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mr-6">
            <Star className="size-5 text-primary" />
            <span className="font-bold text-lg hidden sm:inline-block">
              GitStarHub
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 flex-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  {item.icon}
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Sync Button */}
            <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
              <RefreshCw className="size-4" />
              Sync Stars
            </Button>

            {/* GitHub Link */}
            <Button variant="ghost" size="icon" asChild>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="size-4" />
              </a>
            </Button>

            {/* User Menu */}
            <div className="relative group">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar size="sm">
                  {session.user.avatar_url ? (
                    <AvatarImage
                      src={session.user.avatar_url}
                      alt={session.user.username}
                    />
                  ) : null}
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </Button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="bg-popover border rounded-md shadow-lg p-1">
                  <div className="px-2 py-1.5 border-b mb-1">
                    <p className="text-sm font-medium">
                      {session.user.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.user.email}
                    </p>
                  </div>
                  <Link href="/settings">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <Settings className="size-4" />
                      Settings
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-background border-r pt-14">
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    className="w-full justify-start gap-2"
                  >
                    {item.icon}
                    {item.label}
                  </Button>
                </Link>
              ))}
              <hr className="my-2" />
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-4 py-6">{children}</main>
    </div>
  );
}
