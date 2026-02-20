"use client";

import { useEffect, useState, useRef } from "react";

type Milestone = {
  id: string;
  label: string;
  done: boolean;
  weight: number;
};

type OnboardingProgress = {
  percent: number;
  complete: boolean;
  milestones: Milestone[];
};

export default function OnboardingBarPage() {
  const [token, setToken] = useState<string | null>(null);
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const requestTokenFromParent = () => {
    window.parent?.postMessage({ type: "request-token" }, "*");
  };

  const fetchProgress = async (authToken: string) => {
    try {
      const response = await fetch("/api/onboarding-progress", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch progress: ${response.status}`);
      }

      const data = await response.json();
      setProgress(data);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[OnboardingBar] Error fetching progress:", message);
      setError(message);
    }
  };

  // Listen for token from parent and poll for updates
  useEffect(() => {
    const urlToken = (() => {
      try {
        const u = new URL(window.location.href);
        return u.searchParams.get("outseta_token");
      } catch {
        return null;
      }
    })();

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "outseta-token" && typeof data.token === "string") {
        setToken(data.token);
      }
    };

    window.addEventListener("message", handleMessage);

    if (urlToken) {
      setToken(urlToken);
    } else {
      requestTokenFromParent();
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // Fetch progress when token is available + event-driven updates
  useEffect(() => {
    if (!token) return;

    // Fetch immediately
    fetchProgress(token);

    const handleDataChanged = (event: MessageEvent) => {
      if (event.data?.type === 'hub-data-changed' || event.data?.type === 'data-changed') {
        // Debounce: don't fetch if we just fetched
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
          fetchProgress(token);
        }, 300);
      }
    };

    window.addEventListener('message', handleDataChanged);

    // Safety net: one poll per minute as fallback
    const safetyInterval = setInterval(() => {
      if (!progress?.complete) {
        fetchProgress(token);
      }
    }, 60000);

    return () => {
      window.removeEventListener('message', handleDataChanged);
      clearInterval(safetyInterval);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [token, progress]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1a2e] text-red-400 px-4">
        <p className="text-sm">Error: {error}</p>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex items-center justify-center h-full bg-[#1a1a2e] text-gray-400 px-4">
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  const completedMilestones = progress.milestones.filter((m) => m.done).length;
  const totalMilestones = progress.milestones.length;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#1a1a2e] px-6 py-4">
      {/* Header */}
      <div className="w-full max-w-4xl mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-sm font-semibold">
            {progress.complete ? "🎉 You're all set!" : "Getting Started"}
          </h2>
          <span className="text-gray-400 text-xs">
            {completedMilestones} / {totalMilestones} completed
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full max-w-4xl mb-4">
        <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-teal-400 transition-all duration-500 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <div className="text-center mt-2">
          <span className="text-teal-400 text-lg font-bold">{progress.percent}%</span>
        </div>
      </div>

      {/* Milestones */}
      <div className="w-full max-w-4xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {progress.milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="flex flex-col items-center text-center p-2"
          >
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center mb-1 transition-colors ${
                milestone.done
                  ? "bg-green-500 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              {milestone.done ? "✓" : ""}
            </div>
            <span
              className={`text-xs ${
                milestone.done ? "text-gray-300" : "text-gray-500"
              }`}
            >
              {milestone.label}
            </span>
          </div>
        ))}
      </div>

      {/* Celebration Message */}
      {progress.complete && (
        <div className="w-full max-w-4xl mt-4 p-4 bg-gradient-to-r from-green-900/30 to-teal-900/30 border border-green-500/30 rounded-lg">
          <p className="text-center text-green-400 text-sm font-medium">
            Congratulations! You&apos;ve completed the onboarding process. 🎉
          </p>
        </div>
      )}
    </div>
  );
}
