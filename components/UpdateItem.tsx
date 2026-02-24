"use client";

import Link from "next/link";
import { GitCommit, CircleDot, GitPullRequest, ExternalLink, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export type UpdateType = "commit" | "issue" | "pr" | "release" | "readme";

export interface UpdateItem {
  id: number;
  repo_id: number;
  update_type: UpdateType;
  title: string;
  description: string | null;
  url: string;
  author: string;
  detected_at: string;
  is_read: boolean;
  repo_name: string;
  repo_full_name: string;
  owner_login: string;
}

interface UpdateItemProps {
  update: UpdateItem;
}

const updateTypeConfig: Record<UpdateType, {
  icon: React.ReactNode;
  label: string;
  color: string;
}> = {
  commit: {
    icon: <GitCommit className="size-4" />,
    label: "Commit",
    color: "bg-green-500/10 text-green-600 border-green-500/20",
  },
  issue: {
    icon: <CircleDot className="size-4" />,
    label: "Issue",
    color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  },
  pr: {
    icon: <GitPullRequest className="size-4" />,
    label: "PR",
    color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  },
  release: {
    icon: <FileText className="size-4" />,
    label: "Release",
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  },
  readme: {
    icon: <FileText className="size-4" />,
    label: "README",
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  return date.toLocaleDateString();
}

function getAuthorInitials(author: string): string {
  return author.slice(0, 2).toUpperCase();
}

export function UpdateItemCard({ update }: UpdateItemProps) {
  const typeConfig = updateTypeConfig[update.update_type] || updateTypeConfig.commit;
  const githubRepoUrl = `https://github.com/${update.repo_full_name}`;

  return (
    <Card className={`group hover:shadow-md transition-shadow duration-200 ${!update.is_read ? "border-l-2 border-l-primary" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Type Icon */}
          <div className={`flex-shrink-0 p-2 rounded-lg ${typeConfig.color}`}>
            {typeConfig.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Header: Repo + Type Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/repo/${update.owner_login}/${update.repo_name}`}
                className="text-sm font-medium text-primary hover:underline truncate"
              >
                {update.repo_full_name}
              </Link>
              <Badge variant="outline" className={`text-xs ${typeConfig.color}`}>
                {typeConfig.label}
              </Badge>
              {!update.is_read && (
                <Badge variant="default" className="text-xs">
                  New
                </Badge>
              )}
            </div>

            {/* Title */}
            <a
              href={update.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-medium text-sm hover:text-primary line-clamp-2"
            >
              {update.title}
            </a>

            {/* Description */}
            {update.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {update.description}
              </p>
            )}

            {/* Footer: Author + Time + GitHub Link */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {/* Author */}
                <div className="flex items-center gap-1.5">
                  <Avatar size="sm">
                    <AvatarImage
                      src={`https://avatars.githubusercontent.com/${update.author}?size=32`}
                      alt={update.author}
                    />
                    <AvatarFallback>{getAuthorInitials(update.author)}</AvatarFallback>
                  </Avatar>
                  <a
                    href={`https://github.com/${update.author}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    @{update.author}
                  </a>
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(update.detected_at)}
                </span>
              </div>

              {/* External Links */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground p-1"
                  title="View repository on GitHub"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
