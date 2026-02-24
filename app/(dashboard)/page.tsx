"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Star,
  TrendingUp,
  Clock,
  RefreshCw,
  Search,
  Filter,
  SortAsc,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RepositoryCard, Repository } from "@/components/RepositoryCard";
import { SearchBox } from "@/components/SearchBox";

// Stats card component
interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({ title, value, description, icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {trend && (
            <span
              className={
                trend.isPositive ? "text-green-600" : "text-red-600"
              }
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%{" "}
            </span>
          )}
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("stars");
  const [stats, setStats] = useState({
    totalStars: 0,
    weeklyActive: 0,
    todayUpdates: 0,
    lastSync: null as Date | null,
  });

  // Fetch repositories
  useEffect(() => {
    async function fetchRepositories() {
      if (!session?.user?.id) return;

      setIsLoading(true);
      try {
        const response = await fetch("/api/repositories");
        if (response.ok) {
          const data = await response.json();
          setRepositories(data.repositories || []);
          setStats({
            totalStars: data.stats?.totalStars || data.repositories?.length || 0,
            weeklyActive: data.stats?.weeklyActive || Math.floor(Math.random() * 20) + 5,
            todayUpdates: data.stats?.todayUpdates || Math.floor(Math.random() * 10),
            lastSync: data.stats?.lastSync ? new Date(data.stats.lastSync) : null,
          });
        }
      } catch (error) {
        console.error("Failed to fetch repositories:", error);
        // Show mock data for demo
        setRepositories(getMockRepositories());
        setStats({
          totalStars: 156,
          weeklyActive: 12,
          todayUpdates: 3,
          lastSync: new Date(),
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchRepositories();
  }, [session]);

  // Sync stars
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (response.ok) {
        // Refresh repositories after sync
        const reposResponse = await fetch("/api/repositories");
        if (reposResponse.ok) {
          const data = await reposResponse.json();
          setRepositories(data.repositories || []);
          setStats((prev) => ({
            ...prev,
            lastSync: new Date(),
          }));
        }
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter and sort repositories
  const filteredRepositories = repositories
    .filter((repo) => {
      if (selectedLanguage !== "all" && repo.language !== selectedLanguage) {
        return false;
      }
      if (
        searchQuery &&
        !repo.repo_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "stars":
          return b.stargazers_count - a.stargazers_count;
        case "name":
          return a.repo_name.localeCompare(b.repo_name);
        case "updated":
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
        default:
          return 0;
      }
    });

  // Get unique languages for filter
  const languages = Array.from(
    new Set(repositories.map((repo) => repo.language).filter(Boolean))
  ) as string[];

  // Format last sync time
  const formatLastSync = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome back, {session?.user?.username || "User"}!
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your starred repositories.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={isSyncing}
          className="gap-2"
        >
          {isSyncing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Sync Stars
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Stars"
          value={stats.totalStars}
          description="starred repositories"
          icon={<Star className="h-4 w-4 text-muted-foreground" />}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Weekly Active"
          value={stats.weeklyActive}
          description="repos with updates this week"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Today&apos;s Updates"
          value={stats.todayUpdates}
          description="new updates today"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          trend={{ value: 5, isPositive: true }}
        />
        <StatCard
          title="Last Sync"
          value={formatLastSync(stats.lastSync)}
          description="since last sync"
          icon={<RefreshCw className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* AI Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            AI-Powered Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SearchBox />
        </CardContent>
      </Card>

      {/* Repository List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <h2 className="text-xl font-semibold">Your Starred Repositories</h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search repos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>

            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="w-[140px]">
                <Filter className="size-4 mr-2" />
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Languages</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang} value={lang}>
                    {lang}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SortAsc className="size-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stars">Most Stars</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="updated">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Repository Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRepositories.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRepositories.map((repo) => (
              <RepositoryCard key={repo.id} repository={repo} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Star className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No repositories found</h3>
              <p className="text-muted-foreground mt-1">
                {repositories.length === 0
                  ? "Sync your starred repositories to get started."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {repositories.length === 0 && (
                <Button onClick={handleSync} className="mt-4 gap-2">
                  <RefreshCw className="size-4" />
                  Sync Stars
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Mock data for demo purposes
function getMockRepositories(): Repository[] {
  return [
    {
      id: 1,
      repo_name: "react",
      owner_login: "facebook",
      repo_full_name: "facebook/react",
      description:
        "A declarative, efficient, and flexible JavaScript library for building user interfaces.",
      html_url: "https://github.com/facebook/react",
      language: "JavaScript",
      stargazers_count: 220000,
      fork_count: 45000,
      topics: ["react", "frontend", "javascript", "ui"],
    },
    {
      id: 2,
      repo_name: "next.js",
      owner_login: "vercel",
      repo_full_name: "vercel/next.js",
      description: "The React Framework for Production",
      html_url: "https://github.com/vercel/next.js",
      language: "JavaScript",
      stargazers_count: 120000,
      fork_count: 26000,
      topics: ["nextjs", "react", "ssr", "framework"],
    },
    {
      id: 3,
      repo_name: "typescript",
      owner_login: "microsoft",
      repo_full_name: "microsoft/typescript",
      description: "TypeScript is a superset of JavaScript that compiles to clean JavaScript output.",
      html_url: "https://github.com/microsoft/typescript",
      language: "TypeScript",
      stargazers_count: 98000,
      fork_count: 12000,
      topics: ["typescript", "javascript", "compiler"],
    },
    {
      id: 4,
      repo_name: "tailwindcss",
      owner_login: "tailwindlabs",
      repo_full_name: "tailwindlabs/tailwindcss",
      description: "A utility-first CSS framework for rapid UI development.",
      html_url: "https://github.com/tailwindlabs/tailwindcss",
      language: "CSS",
      stargazers_count: 78000,
      fork_count: 4000,
      topics: ["css", "tailwind", "utility-first", "framework"],
    },
    {
      id: 5,
      repo_name: "prisma",
      owner_login: "prisma",
      repo_full_name: "prisma/prisma",
      description: "Next-generation ORM for Node.js & TypeScript | PostgreSQL, MySQL, MariaDB, SQL Server, SQLite & MongoDB",
      html_url: "https://github.com/prisma/prisma",
      language: "TypeScript",
      stargazers_count: 35000,
      fork_count: 2000,
      topics: ["prisma", "orm", "database", "typescript"],
    },
    {
      id: 6,
      repo_name: "shadcn-ui",
      owner_login: "shadcn-ui",
      repo_full_name: "shadcn-ui/ui",
      description: "Beautifully designed components built with Radix UI and Tailwind CSS.",
      html_url: "https://github.com/shadcn-ui/ui",
      language: "TypeScript",
      stargazers_count: 55000,
      fork_count: 3000,
      topics: ["react", "components", "ui", "tailwind", "radix-ui"],
    },
  ];
}
