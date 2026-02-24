"use client";

import Link from "next/link";
import { Star, GitFork, Circle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Language colors mapping
const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#239120",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  Scala: "#c22d40",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Shell: "#89e051",
  Lua: "#000080",
  Perl: "#39457e",
  R: "#198CE7",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Clojure: "#db5855",
  CoffeeScript: "#244776",
  Elm: "#60B5CC",
  Erlang: "#B83998",
  Julia: "#a270ba",
  Nim: "#ffc200",
  OCaml: "#ef7a08",
  PowerShell: "#012456",
  PureScript: "#1D222D",
  Racket: "#ae17ff",
  Reason: "#ff5847",
  Scheme: "#1e4aec",
  "F#": "#b845fc",
  D: "#ba595e",
  Groovy: "#4298b8",
  ObjectiveC: "#438eff",
  Crystal: "#000100",
  Fortran: "#4d41b1",
  Ada: "#02f88c",
  Apex: "#1797c0",
  Zig: "#ec915c",
  Matlab: "#e16737",
  Assembly: "#6E4C13",
  VHDL: "#adb2cb",
  Verilog: "#b2b7f8",
  Makefile: "#427819",
};

export interface Repository {
  id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork_count?: number;
  topics?: string[] | null;
  starred_at?: string;
  created_at?: string;
  updated_at?: string;
}

interface RepositoryCardProps {
  repository: Repository;
  showOwner?: boolean;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

function getLanguageColor(language: string | null): string {
  if (!language) return "#8b8b8b";
  return languageColors[language] || "#8b8b8b";
}

export function RepositoryCard({ repository, showOwner = true }: RepositoryCardProps) {
  const {
    repo_name,
    owner_login,
    description,
    html_url,
    language,
    stargazers_count,
    fork_count = 0,
    topics = [],
  } = repository;

  return (
    <Card className="group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold truncate">
              <Link
                href={`/repo/${owner_login}/${repo_name}`}
                className="text-primary hover:underline flex items-center gap-1"
              >
                {showOwner ? (
                  <>
                    <span className="text-muted-foreground font-normal">
                      {owner_login}/
                    </span>
                    {repo_name}
                  </>
                ) : (
                  repo_name
                )}
              </Link>
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            asChild
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <a
              href={html_url}
              target="_blank"
              rel="noopener noreferrer"
              title="View on GitHub"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}

        {/* Topics */}
        {topics && topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topics.slice(0, 5).map((topic) => (
              <Badge
                key={topic}
                variant="secondary"
                className="text-xs px-2 py-0.5"
              >
                {topic}
              </Badge>
            ))}
            {topics.length > 5 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                +{topics.length - 5}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {/* Language */}
          {language && (
            <div className="flex items-center gap-1.5">
              <Circle
                className="size-3"
                fill={getLanguageColor(language)}
                style={{ color: getLanguageColor(language) }}
              />
              <span>{language}</span>
            </div>
          )}

          {/* Stars */}
          <div className="flex items-center gap-1">
            <Star className="size-3.5" />
            <span>{formatNumber(stargazers_count)}</span>
          </div>

          {/* Forks */}
          <div className="flex items-center gap-1">
            <GitFork className="size-3.5" />
            <span>{formatNumber(fork_count)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
