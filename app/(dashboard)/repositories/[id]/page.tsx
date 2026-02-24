"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  GitFork,
  Circle,
  ExternalLink,
  Calendar,
  Code,
  CircleDot,
  GitPullRequest,
  Loader2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface Repository {
  id: number;
  github_repo_id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  fork_count: number;
  open_issues_count: number;
  topics: string[] | null;
  created_at: string;
  updated_at: string;
}

interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  url: string;
}

interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  url: string;
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateString);
}

function getLanguageColor(language: string | null): string {
  if (!language) return "#8b8b8b";
  return languageColors[language] || "#8b8b8b";
}

export default function RepositoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [repository, setRepository] = useState<Repository | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("commits");

  useEffect(() => {
    async function fetchRepositoryDetail() {
      setIsLoading(true);
      try {
        const repoId = params.id;

        // Fetch repository details
        const repoResponse = await fetch(`/api/repositories/${repoId}`);
        if (repoResponse.ok) {
          const repoData = await repoResponse.json();
          setRepository(repoData.repository);

          // Fetch commits, issues, and PRs (mock data for now)
          // In production, these would come from GitHub API
          setCommits(getMockCommits());
          setIssues(getMockIssues());
          setPullRequests(getMockPRs());
        } else {
          // Use mock data for demo
          setRepository(getMockRepository());
          setCommits(getMockCommits());
          setIssues(getMockIssues());
          setPullRequests(getMockPRs());
        }
      } catch (error) {
        console.error("Failed to fetch repository details:", error);
        // Use mock data for demo
        setRepository(getMockRepository());
        setCommits(getMockCommits());
        setIssues(getMockIssues());
        setPullRequests(getMockPRs());
      } finally {
        setIsLoading(false);
      }
    }

    fetchRepositoryDetail();
  }, [params.id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!repository) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <h2 className="text-xl font-semibold">Repository not found</h2>
        <p className="text-muted-foreground mt-2">
          The repository you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button className="mt-4" onClick={() => router.push("/")}>
          <ArrowLeft className="size-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          onClick={() => router.push("/")}
        >
          <ArrowLeft className="size-4" />
          Back to List
        </Button>
      </div>

      {/* Repository Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl font-bold">
                <span className="text-muted-foreground font-normal">
                  {repository.owner_login}/
                </span>
                {repository.repo_name}
              </CardTitle>
              {repository.description && (
                <p className="text-muted-foreground mt-2">
                  {repository.description}
                </p>
              )}
            </div>
            <Button asChild>
              <a
                href={repository.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="size-4" />
                View on GitHub
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Topics */}
          {repository.topics && repository.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {repository.topics.map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            {/* Language */}
            {repository.language && (
              <div className="flex items-center gap-1.5">
                <Circle
                  className="size-3"
                  fill={getLanguageColor(repository.language)}
                  style={{ color: getLanguageColor(repository.language) }}
                />
                <span>{repository.language}</span>
              </div>
            )}

            {/* Stars */}
            <div className="flex items-center gap-1">
              <Star className="size-4" />
              <span>{formatNumber(repository.stargazers_count)} stars</span>
            </div>

            {/* Forks */}
            <div className="flex items-center gap-1">
              <GitFork className="size-4" />
              <span>{formatNumber(repository.fork_count)} forks</span>
            </div>

            {/* Issues */}
            <div className="flex items-center gap-1">
              <CircleDot className="size-4" />
              <span>{repository.open_issues_count} issues</span>
            </div>

            {/* Updated Time */}
            <div className="flex items-center gap-1">
              <Clock className="size-4" />
              <span>Updated {formatRelativeTime(repository.updated_at)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="commits" className="gap-1.5">
            <Code className="size-4" />
            Commits
          </TabsTrigger>
          <TabsTrigger value="issues" className="gap-1.5">
            <CircleDot className="size-4" />
            Issues
          </TabsTrigger>
          <TabsTrigger value="prs" className="gap-1.5">
            <GitPullRequest className="size-4" />
            PRs
          </TabsTrigger>
        </TabsList>

        {/* Commits Tab */}
        <TabsContent value="commits" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Commits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {commits.length > 0 ? (
                  commits.map((commit) => (
                    <div
                      key={commit.sha}
                      className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline line-clamp-1"
                        >
                          {commit.message}
                        </a>
                        <p className="text-sm text-muted-foreground mt-1">
                          {commit.author} committed {formatRelativeTime(commit.date)}
                        </p>
                      </div>
                      <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        {commit.sha.slice(0, 7)}
                      </code>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No commits found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Issues Tab */}
        <TabsContent value="issues" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Open Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {issues.length > 0 ? (
                  issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block size-2 rounded-full ${
                              issue.state === "open"
                                ? "bg-green-500"
                                : "bg-purple-500"
                            }`}
                          />
                          <a
                            href={issue.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline line-clamp-1"
                          >
                            {issue.title}
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          #{issue.number} opened {formatRelativeTime(issue.created_at)} by {issue.author}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No issues found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRs Tab */}
        <TabsContent value="prs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pull Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pullRequests.length > 0 ? (
                  pullRequests.map((pr) => (
                    <div
                      key={pr.id}
                      className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <GitPullRequest
                            className={`size-4 ${
                              pr.state === "open"
                                ? "text-green-500"
                                : "text-purple-500"
                            }`}
                          />
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline line-clamp-1"
                          >
                            {pr.title}
                          </a>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          #{pr.number} opened {formatRelativeTime(pr.created_at)} by {pr.author}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No pull requests found
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Mock data functions
function getMockRepository(): Repository {
  return {
    id: 1,
    github_repo_id: 10270250,
    repo_name: "react",
    owner_login: "facebook",
    repo_full_name: "facebook/react",
    description:
      "A declarative, efficient, and flexible JavaScript library for building user interfaces.",
    html_url: "https://github.com/facebook/react",
    language: "JavaScript",
    stargazers_count: 220000,
    fork_count: 45000,
    open_issues_count: 850,
    topics: ["react", "frontend", "javascript", "ui", "library"],
    created_at: "2013-05-24T16:15:26Z",
    updated_at: new Date().toISOString(),
  };
}

function getMockCommits(): Commit[] {
  return [
    {
      sha: "abc1234567890abcdef1234567890abcdef1234",
      message: "fix: resolve hydration warning in development mode",
      author: "gaearon",
      date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      url: "https://github.com/facebook/react/commit/abc123",
    },
    {
      sha: "def2345678901abcdef2345678901abcdef2345",
      message: "feat: add new experimental feature for concurrent rendering",
      author: "sebmarkbage",
      date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      url: "https://github.com/facebook/react/commit/def234",
    },
    {
      sha: "ghi3456789012abcdef3456789012abcdef3456",
      message: "docs: update README with new examples",
      author: "rickhanlonii",
      date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      url: "https://github.com/facebook/react/commit/ghi345",
    },
    {
      sha: "jkl4567890123abcdef4567890123abcdef4567",
      message: "refactor: improve performance of reconciliation algorithm",
      author: "acdlite",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      url: "https://github.com/facebook/react/commit/jkl456",
    },
    {
      sha: "mno5678901234abcdef5678901234abcdef5678",
      message: "test: add unit tests for new hooks API",
      author: "eps1lon",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      url: "https://github.com/facebook/react/commit/mno567",
    },
  ];
}

function getMockIssues(): Issue[] {
  return [
    {
      id: 1,
      number: 28475,
      title: "Bug: useEffect not running on initial mount in StrictMode",
      state: "open",
      author: "developer1",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      url: "https://github.com/facebook/react/issues/28475",
    },
    {
      id: 2,
      number: 28474,
      title: "Feature Request: Add support for async components",
      state: "open",
      author: "developer2",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      url: "https://github.com/facebook/react/issues/28474",
    },
    {
      id: 3,
      number: 28473,
      title: "Documentation: Clarify usage of useMemo with complex dependencies",
      state: "open",
      author: "developer3",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      url: "https://github.com/facebook/react/issues/28473",
    },
  ];
}

function getMockPRs(): PullRequest[] {
  return [
    {
      id: 1,
      number: 28480,
      title: "feat: implement new scheduler algorithm",
      state: "open",
      author: "contributor1",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
      url: "https://github.com/facebook/react/pull/28480",
    },
    {
      id: 2,
      number: 28479,
      title: "fix: correct type definitions for ReactNode",
      state: "open",
      author: "contributor2",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
      url: "https://github.com/facebook/react/pull/28479",
    },
    {
      id: 3,
      number: 28478,
      title: "chore: update dependencies to latest versions",
      state: "closed",
      author: "contributor3",
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      url: "https://github.com/facebook/react/pull/28478",
    },
  ];
}
