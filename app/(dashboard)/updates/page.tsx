"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Bell,
  GitCommit,
  CircleDot,
  GitPullRequest,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UpdateItemCard, UpdateItem, UpdateType } from "@/components/UpdateItem";

type FilterType = "all" | UpdateType;

interface UpdatesResponse {
  updates: UpdateItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const filterOptions: { value: FilterType; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "All", icon: <Bell className="size-4" /> },
  { value: "commit", label: "Commits", icon: <GitCommit className="size-4" /> },
  { value: "issue", label: "Issues", icon: <CircleDot className="size-4" /> },
  { value: "pr", label: "PRs", icon: <GitPullRequest className="size-4" /> },
  { value: "release", label: "Releases", icon: <FileText className="size-4" /> },
];

export default function UpdatesPage() {
  const { data: session } = useSession();
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchUpdates = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (filter !== "all") {
        params.set("type", filter);
      }

      const response = await fetch(`/api/updates?${params.toString()}`);
      if (response.ok) {
        const data: UpdatesResponse = await response.json();
        setUpdates(data.updates || []);
        setPagination(data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        });
      } else {
        // Use mock data for demo
        const mockData = getMockUpdates(filter, page);
        setUpdates(mockData.updates);
        setPagination(mockData.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch updates:", error);
      // Use mock data for demo
      const mockData = getMockUpdates(filter, page);
      setUpdates(mockData.updates);
      setPagination(mockData.pagination);
    } finally {
      setIsLoading(false);
    }
  }, [session, filter, page]);

  useEffect(() => {
    fetchUpdates();
  }, [fetchUpdates]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page < pagination.totalPages) {
      setPage(page + 1);
    }
  };

  // Count updates by type for badges
  const getUpdateCountByType = (type: FilterType): number | null => {
    if (type === "all") {
      return pagination.total || null;
    }
    // For demo purposes, return mock counts
    const counts: Record<string, number> = {
      commit: 15,
      issue: 8,
      pr: 5,
      release: 3,
    };
    return counts[type] || null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="size-6" />
            Updates
          </h1>
          <p className="text-muted-foreground">
            Recent activity from your starred repositories
          </p>
        </div>
      </div>

      {/* Filter and Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter Updates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setFilter(option.value)}
              >
                {option.icon}
                {option.label}
                {getUpdateCountByType(option.value) !== null && (
                  <Badge variant="secondary" className="ml-1">
                    {getUpdateCountByType(option.value)}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Updates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : updates.length > 0 ? (
        <div className="space-y-3">
          {updates.map((update) => (
            <UpdateItemCard key={update.id} update={update} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No updates yet</h3>
            <p className="text-muted-foreground mt-1">
              {filter !== "all"
                ? `No ${filter} updates found. Try a different filter.`
                : "Updates will appear here when there is activity in your starred repositories."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} updates
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum: number;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={page >= pagination.totalPages}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Mock data for demo purposes
function getMockUpdates(filter: FilterType, page: number): UpdatesResponse {
  const allUpdates: UpdateItem[] = [
    {
      id: 1,
      repo_id: 1,
      update_type: "commit",
      title: "feat: Add new hooks for async data fetching",
      description: "This PR adds useAsyncEffect and useAsyncCallback hooks for better async handling",
      url: "https://github.com/facebook/react/commit/abc123",
      author: "gaearon",
      detected_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
      is_read: false,
      repo_name: "react",
      repo_full_name: "facebook/react",
      owner_login: "facebook",
    },
    {
      id: 2,
      repo_id: 2,
      update_type: "pr",
      title: "feat: Add server actions support",
      description: "Implements server actions with proper error handling and type safety",
      url: "https://github.com/vercel/next.js/pull/12345",
      author: "shuding",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      is_read: false,
      repo_name: "next.js",
      repo_full_name: "vercel/next.js",
      owner_login: "vercel",
    },
    {
      id: 3,
      repo_id: 3,
      update_type: "issue",
      title: "Bug: TypeScript strict mode causes compilation errors",
      description: "When using strict mode, some types are incorrectly inferred",
      url: "https://github.com/microsoft/typescript/issues/54321",
      author: "orta",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
      is_read: true,
      repo_name: "TypeScript",
      repo_full_name: "microsoft/TypeScript",
      owner_login: "microsoft",
    },
    {
      id: 4,
      repo_id: 4,
      update_type: "release",
      title: "v3.4.0 - New color system and animations",
      description: "This release includes a completely redesigned color system and new animation utilities",
      url: "https://github.com/tailwindlabs/tailwindcss/releases/tag/v3.4.0",
      author: "adamwathan",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
      is_read: false,
      repo_name: "tailwindcss",
      repo_full_name: "tailwindlabs/tailwindcss",
      owner_login: "tailwindlabs",
    },
    {
      id: 5,
      repo_id: 5,
      update_type: "commit",
      title: "fix: Resolve memory leak in connection pooling",
      description: "Fixed a critical memory leak that occurred when connections were reused",
      url: "https://github.com/prisma/prisma/commit/def456",
      author: "janpio",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
      is_read: true,
      repo_name: "prisma",
      repo_full_name: "prisma/prisma",
      owner_login: "prisma",
    },
    {
      id: 6,
      repo_id: 6,
      update_type: "pr",
      title: "feat: Add new data table component",
      description: "Adds a fully featured data table with sorting, filtering, and pagination",
      url: "https://github.com/shadcn-ui/ui/pull/67890",
      author: "shadcn",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
      is_read: true,
      repo_name: "ui",
      repo_full_name: "shadcn-ui/ui",
      owner_login: "shadcn-ui",
    },
    {
      id: 7,
      repo_id: 1,
      update_type: "issue",
      title: "Feature Request: Add support for concurrent rendering",
      description: "Would love to see concurrent rendering support for better performance",
      url: "https://github.com/facebook/react/issues/11111",
      author: "sebmarkbage",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(), // 4 days ago
      is_read: true,
      repo_name: "react",
      repo_full_name: "facebook/react",
      owner_login: "facebook",
    },
    {
      id: 8,
      repo_id: 2,
      update_type: "release",
      title: "v14.1.0 - Turbopack improvements and bug fixes",
      description: "Major improvements to Turbopack stability and performance",
      url: "https://github.com/vercel/next.js/releases/tag/v14.1.0",
      author: "timneutkens",
      detected_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
      is_read: true,
      repo_name: "next.js",
      repo_full_name: "vercel/next.js",
      owner_login: "vercel",
    },
  ];

  // Filter by type
  let filteredUpdates = allUpdates;
  if (filter !== "all") {
    filteredUpdates = allUpdates.filter((u) => u.update_type === filter);
  }

  // Paginate
  const limit = 20;
  const startIndex = (page - 1) * limit;
  const paginatedUpdates = filteredUpdates.slice(startIndex, startIndex + limit);

  return {
    updates: paginatedUpdates,
    pagination: {
      page,
      limit,
      total: filteredUpdates.length,
      totalPages: Math.ceil(filteredUpdates.length / limit),
    },
  };
}
