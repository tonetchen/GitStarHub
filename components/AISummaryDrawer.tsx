"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AISummaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AISummaryDrawer({ isOpen, onClose }: AISummaryDrawerProps) {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setIsLoading(true);
    setSummary("");
    setError(null);

    try {
      const response = await fetch("/api/ai-summary", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch summary");
      }

      const contentType = response.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.content) {
          setSummary(data.content);
        } else if (data.error) {
          throw new Error(data.error);
        }
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let currentSummary = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                currentSummary += parsed.content;
                setSummary(currentSummary);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
  }, [isOpen]);

  // Clean up body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const renderMarkdownLine = (line: string, index: number) => {
    if (!line.trim()) return <div key={index} className="h-4" />;

    // Headers
    if (line.startsWith("# ")) {
      return <h1 key={index} className="text-2xl font-bold mt-8 mb-4 border-b pb-2">{line.slice(2)}</h1>;
    }
    if (line.startsWith("## ")) {
      return <h2 key={index} className="text-xl font-bold mt-6 mb-3 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-primary rounded-full inline-block" />
        {line.slice(3)}
      </h2>;
    }
    if (line.startsWith("### ")) {
      return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
    }

    // List items
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return <div key={index} className="flex gap-2 ml-2 mb-1.5">
        <span className="text-primary mt-1.5 select-none">•</span>
        <span>{line.slice(2)}</span>
      </div>;
    }
    
    // Numbered items
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      return <div key={index} className="flex gap-2 ml-2 mb-1.5">
        <span className="text-primary font-bold min-w-[1.5rem] mt-1 select-none">{numMatch[1]}.</span>
        <span>{numMatch[2]}</span>
      </div>;
    }

    // Bold text
    if (line.includes("**")) {
        const parts = line.split(/(\*\*.*?\*\*)/);
        return <p key={index} className="mb-3 leading-relaxed">
            {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                    return <strong key={i} className="text-primary font-bold">{part.slice(2, -2)}</strong>;
                }
                return part;
            })}
        </p>;
    }

    return <p key={index} className="mb-3 leading-relaxed text-foreground/80">{line}</p>;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ease-in-out",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[550px] bg-background border-l shadow-2xl z-[101] flex flex-col transition-transform duration-500 ease-in-out transform",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10 -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -z-10 -ml-24 -mb-24" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl border border-primary/20 shadow-inner">
              <Sparkles className="size-5 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Daily AI Summary
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                AI is reading your repository updates...
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="rounded-full hover:bg-muted/80"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
          {isLoading && !summary && (
            <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <Loader2 className="size-16 animate-spin text-primary relative" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">AI is thinking...</p>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  Analyzing today&apos;s updates and extracting key information.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
              <div className="bg-destructive/10 p-4 rounded-full mb-4">
                <X className="size-10 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Failed to generate summary</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[300px]">
                {error}. Please check your connection or AI configuration.
              </p>
              <Button variant="outline" onClick={fetchSummary} className="gap-2">
                <RefreshCw className="size-4" />
                Try Again
              </Button>
            </div>
          )}

          {summary && (
            <div className="animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out">
              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-2 mb-4 text-primary font-semibold text-sm uppercase tracking-wider">
                    <Sparkles className="size-4" />
                    AI Insights
                </div>
                <div className="font-sans text-[15px]">
                  {summary.split("\n").map((line, i) => renderMarkdownLine(line, i))}
                </div>
              </div>
              
              <div className="flex items-center gap-4 py-8 opacity-40">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">End of Summary</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-muted/20 backdrop-blur-sm">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="px-6 border-primary/20 hover:bg-primary/5"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-primary/90 to-primary shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
              onClick={fetchSummary}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Regenerate Summary
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] text-center mt-4 text-muted-foreground uppercase tracking-widest font-medium">
            Powered by GitStarHub AI
          </p>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(var(--primary), 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(var(--primary), 0.2);
        }
      `}</style>
    </>
  );
}
