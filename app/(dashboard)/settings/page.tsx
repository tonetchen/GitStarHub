"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  RefreshCw,
  Bot,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Settings types
interface SyncSettings {
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
}

interface AiSettings {
  preferredModel: string;
}

// Available AI models
const AI_MODELS = [
  { value: "glm-4", label: "GLM-4 (Recommended)" },
  { value: "glm-4-flash", label: "GLM-4 Flash (Faster)" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  { value: "claude-3", label: "Claude 3" },
];

// Sync interval options
const SYNC_INTERVALS = [
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
  { value: "360", label: "6 hours" },
  { value: "720", label: "12 hours" },
  { value: "1440", label: "24 hours" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  // Sync settings state
  const [syncSettings, setSyncSettings] = useState<SyncSettings>({
    syncEnabled: true,
    syncIntervalMinutes: 120,
    lastSyncAt: null,
  });

  // AI settings state
  const [aiSettings, setAiSettings] = useState<AiSettings>({
    preferredModel: "glm-4",
  });

  // Fetch current settings
  useEffect(() => {
    async function fetchSettings() {
      if (!session?.user?.id) return;

      setIsLoading(true);
      try {
        // Fetch sync settings
        const syncResponse = await fetch("/api/settings/sync");
        if (syncResponse.ok) {
          const syncData = await syncResponse.json();
          setSyncSettings({
            syncEnabled: syncData.syncEnabled ?? true,
            syncIntervalMinutes: syncData.syncIntervalMinutes ?? 120,
            lastSyncAt: syncData.lastSyncAt ?? null,
          });
        }

        // Fetch AI settings
        const aiResponse = await fetch("/api/settings/ai");
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          setAiSettings({
            preferredModel: aiData.preferredModel ?? "glm-4",
          });
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, [session]);

  // Save all settings
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");

    try {
      // Save sync settings
      const syncResponse = await fetch("/api/settings/sync", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncEnabled: syncSettings.syncEnabled,
          syncIntervalMinutes: syncSettings.syncIntervalMinutes,
        }),
      });

      // Save AI settings
      const aiResponse = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preferredModel: aiSettings.preferredModel,
        }),
      });

      if (syncResponse.ok && aiResponse.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // Format last sync time
  const formatLastSync = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your application preferences and configurations.
        </p>
      </div>

      {/* Sync Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="size-5" />
            Data Synchronization
          </CardTitle>
          <CardDescription>
            Configure how your starred repositories are synced with GitHub.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sync Enable Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sync-enabled">Enable Auto Sync</Label>
              <p className="text-sm text-muted-foreground">
                Automatically sync your starred repositories from GitHub.
              </p>
            </div>
            <Switch
              id="sync-enabled"
              checked={syncSettings.syncEnabled}
              onCheckedChange={(checked) =>
                setSyncSettings({ ...syncSettings, syncEnabled: checked })
              }
            />
          </div>

          {/* Sync Interval */}
          <div className="space-y-2">
            <Label htmlFor="sync-interval">Sync Frequency</Label>
            <Select
              value={syncSettings.syncIntervalMinutes.toString()}
              onValueChange={(value) =>
                setSyncSettings({
                  ...syncSettings,
                  syncIntervalMinutes: parseInt(value, 10),
                })
              }
              disabled={!syncSettings.syncEnabled}
            >
              <SelectTrigger id="sync-interval" className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select interval" />
              </SelectTrigger>
              <SelectContent>
                {SYNC_INTERVALS.map((interval) => (
                  <SelectItem key={interval.value} value={interval.value}>
                    {interval.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              How often to check for updates to your starred repositories.
            </p>
          </div>

          {/* Last Sync Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Last synchronized:</span>
            <span className="font-medium">
              {formatLastSync(syncSettings.lastSyncAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            AI Model Configuration
          </CardTitle>
          <CardDescription>
            Configure the AI model used for repository analysis and search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="ai-model">Preferred AI Model</Label>
            <Select
              value={aiSettings.preferredModel}
              onValueChange={(value) =>
                setAiSettings({ ...aiSettings, preferredModel: value })
              }
            >
              <SelectTrigger id="ai-model" className="w-full sm:w-[300px]">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Select the AI model for intelligent repository search and
              recommendations. Different models may have varying response times
              and capabilities.
            </p>
          </div>

          {/* Model Info */}
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium mb-2">Model Information:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>
                <strong>GLM-4</strong> - Best balance of speed and accuracy for
                repository analysis
              </li>
              <li>
                <strong>GLM-4 Flash</strong> - Faster responses, ideal for
                quick searches
              </li>
              <li>
                <strong>GPT-4</strong> - High accuracy, may have slower
                response times
              </li>
              <li>
                <strong>Claude 3</strong> - Excellent for detailed analysis and
                explanations
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Your connected GitHub account details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={session?.user?.username || ""} disabled />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={session?.user?.email || "Not provided"} disabled />
            </div>
            <div className="space-y-1">
              <Label>GitHub ID</Label>
              <Input value={session?.user?.github_id || ""} disabled />
            </div>
            <div className="space-y-1">
              <Label>Member Since</Label>
              <Input value="Active" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save Changes
        </Button>

        {saveStatus === "success" && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="size-4" />
            <span className="text-sm font-medium">Settings saved successfully</span>
          </div>
        )}

        {saveStatus === "error" && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="size-4" />
            <span className="text-sm font-medium">Failed to save settings</span>
          </div>
        )}
      </div>
    </div>
  );
}
