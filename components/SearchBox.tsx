"use client";

import { useState, useCallback } from "react";
import { Search, Sparkles, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  relevanceReason?: string;
}

interface SearchBoxProps {
  onSearch?: (query: string) => void;
  onResultClick?: (result: SearchResult) => void;
  className?: string;
}

const EXAMPLE_QUESTIONS = [
  "React state management libraries",
  "Python machine learning frameworks",
  "TypeScript utilities",
  "CLI tools for developers",
  "API frameworks",
  "Testing libraries",
];

export function SearchBox({
  onSearch,
  onResultClick,
  className,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setIsLoading(true);
      setShowResults(true);

      try {
        // Call the AI search API
        const response = await fetch("/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!response.ok) {
          throw new Error("Search failed");
        }

        const data = await response.json();
        setResults(data.results || []);

        if (onSearch) {
          onSearch(searchQuery);
        }
      } catch (error) {
        console.error("Search error:", error);
        // For demo purposes, show mock results
        setResults([
          {
            id: 1,
            repo_name: "react",
            owner_login: "facebook",
            repo_full_name: "facebook/react",
            description:
              "A declarative, efficient, and flexible JavaScript library for building user interfaces.",
            language: "JavaScript",
            stargazers_count: 220000,
            relevanceReason: "Popular React library matching your query",
          },
          {
            id: 2,
            repo_name: "next.js",
            owner_login: "vercel",
            repo_full_name: "vercel/next.js",
            description: "The React Framework for Production",
            language: "JavaScript",
            stargazers_count: 120000,
            relevanceReason: "Full-stack React framework",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    handleSearch(example);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Ask AI to find repositories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-20 h-12 text-base"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={handleClear}
              >
                <X className="size-4" />
              </Button>
            )}
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="size-4 mr-1" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Example Questions */}
      {!showResults && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((example) => (
              <Badge
                key={example}
                variant="outline"
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {showResults && (
        <div className="space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Searching with AI...
                </span>
              </CardContent>
            </Card>
          ) : results.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Found {results.length} relevant repositories:
              </p>
              <div className="space-y-2">
                {results.map((result) => (
                  <Card
                    key={result.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => onResultClick?.(result)}
                  >
                    <CardContent className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <h4 className="font-medium text-primary truncate">
                            {result.repo_full_name}
                          </h4>
                          {result.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {result.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {result.language && (
                              <span>{result.language}</span>
                            )}
                            <span>
                              {result.stargazers_count.toLocaleString()} stars
                            </span>
                          </div>
                        </div>
                      </div>
                      {result.relevanceReason && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            <Sparkles className="size-3 inline mr-1" />
                            {result.relevanceReason}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No repositories found matching your query.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
