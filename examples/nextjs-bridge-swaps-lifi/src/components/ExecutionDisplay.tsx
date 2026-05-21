"use client";

import { RouteExtended } from "@lifi/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { getExplorerUrl } from "@/lib/utils";

interface ExecutionProgress {
  stepIndex: number;
  stepType: string;
  status: string;
  txHash?: string;
  explorerLink?: string;
  chainId?: number;
  message: string;
}

interface ExecutionDisplayProps {
  activeRoute: RouteExtended | null;
  isExecuting: boolean;
  isRouteCompleted: boolean;
  executionProgress: ExecutionProgress[];
  onResumeRoute: () => void;
  onMoveToBackground: () => void;
  onStopRoute: () => void;
  onBackToForm: () => void;
}

export default function ExecutionDisplay({
  activeRoute,
  isExecuting,
  isRouteCompleted,
  executionProgress,
  onResumeRoute,
  onMoveToBackground,
  onStopRoute,
  onBackToForm,
}: ExecutionDisplayProps) {
  if (!activeRoute) {
    return (
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">Route Execution</CardTitle>
              <button
                onClick={onBackToForm}
                className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-10 flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Initiating swap execution…</p>
            <p className="text-xs text-muted-foreground">Check your wallet for a chain-switch or approval prompt.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "DONE":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "FAILED":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "ACTION_REQUIRED":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "DONE":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "FAILED":
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case "ACTION_REQUIRED":
        return (
          <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
        );
      default:
        return <Eye className="w-5 h-5 text-blue-400" />;
    }
  };

  const getOverallStatus = () => {
    if (isRouteCompleted) return "COMPLETED";
    if (isExecuting) return "EXECUTING";
    return "PAUSED";
  };

  const getOverallStatusColor = () => {
    const status = getOverallStatus();
    switch (status) {
      case "COMPLETED":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "EXECUTING":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "PAUSED":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center space-x-2">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <span>Route Execution</span>
            </CardTitle>
            <button
              onClick={onBackToForm}
              className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Route Details & Progress Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Route Details */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium mb-3">Route Details</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Route ID
                  </span>
                  <span className="font-mono text-xs bg-muted px-2 py-1 rounded border">
                    {activeRoute.id.slice(0, 8)}...{activeRoute.id.slice(-8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${getOverallStatusColor()}`}
                  >
                    {getOverallStatus()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Steps</span>
                  <span className="text-xs text-muted-foreground">
                    {activeRoute.steps.length} step
                    {activeRoute.steps.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Summary */}
            {executionProgress.length > 0 && (
              <div className="bg-muted/40 rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Progress Summary</h4>
                  <span className="text-xs text-muted-foreground">
                    {
                      executionProgress.filter((p) => p.status === "DONE")
                        .length
                    }{" "}
                    / {executionProgress.length} completed
                  </span>
                </div>
                <div className="space-y-2">
                  {executionProgress.map((progress, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-shrink-0">
                        {getStatusIcon(progress.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">
                            Step {progress.stepIndex + 1}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                              progress.status
                            )}`}
                          >
                            {progress.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {progress.stepType}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Execution Control or Completion Status */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border">
            {isRouteCompleted ? (
              <>
                <h4 className="text-sm font-medium mb-3 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span>Route Execution Completed</span>
                </h4>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-3">
                  <p className="text-sm text-green-400 font-medium">
                    ✅ Your cross-chain swap has been completed successfully!
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onBackToForm}
                    className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/80 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm"
                  >
                    Start New Swap
                  </button>
                </div>
                <div className="mt-3 p-2 bg-background rounded border">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Route ID:</span>{" "}
                    {activeRoute.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Status:</span> Completed
                  </p>
                </div>
              </>
            ) : (
              <>
                <h4 className="text-sm font-medium mb-3">
                  Route Execution Control
                </h4>
                <div className="flex flex-wrap gap-3">
                  {isExecuting ? (
                    <>
                      <button
                        onClick={onMoveToBackground}
                        className="px-4 py-2 bg-accent text-accent-foreground font-medium rounded-lg hover:bg-accent/80 transition-colors shadow-sm cursor-pointer text-sm"
                      >
                        Move to Background
                      </button>
                      <button
                        onClick={onStopRoute}
                        className="px-4 py-2 bg-destructive text-destructive-foreground font-medium rounded-lg hover:bg-destructive/80 transition-colors shadow-sm cursor-pointer text-sm"
                      >
                        Stop Execution
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={onResumeRoute}
                      className="px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/80 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm"
                    >
                      Resume Route
                    </button>
                  )}
                </div>
                <div className="mt-3 p-2 bg-background rounded border">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Route ID:</span>{" "}
                    {activeRoute.id.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Status:</span>{" "}
                    {isExecuting ? "Executing" : "Paused"}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Detailed Execution Progress */}
          {executionProgress.length > 0 && (
            <div className="bg-muted/40 rounded-lg p-4 border border-border">
              <h4 className="text-sm font-medium mb-4">Execution Progress</h4>
              <div className="space-y-3">
                {executionProgress.map((progress, index) => {
                  const explorerUrl =
                    progress.explorerLink ||
                    getExplorerUrl(progress.txHash!, progress.chainId);

                  return (
                    <div
                      key={index}
                      className="bg-background rounded-lg p-3 border border-border"
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getStatusIcon(progress.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">
                                Step {progress.stepIndex + 1}
                              </span>
                              <span className="text-xs text-muted-foreground bg-accent px-2 py-1 rounded-full">
                                {progress.stepType}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                progress.status
                              )}`}
                            >
                              {progress.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">
                            {progress.message}
                          </p>
                          {progress.txHash && (
                            <div className="space-y-1">
                              <div className="bg-muted rounded p-2 border">
                                <p className="text-xs text-muted-foreground mb-1">
                                  Transaction Hash:
                                </p>
                                {explorerUrl ? (
                                  <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-xs bg-background px-2 py-1 rounded border hover:bg-muted/80 transition-colors cursor-pointer text-primary hover:text-primary/80"
                                  >
                                    {progress.txHash.slice(0, 10)}...
                                    {progress.txHash.slice(-8)}
                                  </a>
                                ) : (
                                  <p className="font-mono text-xs bg-background px-2 py-1 rounded border">
                                    {progress.txHash.slice(0, 10)}...
                                    {progress.txHash.slice(-8)}
                                  </p>
                                )}
                              </div>
                              {progress.explorerLink && (
                                <a
                                  href={progress.explorerLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center space-x-1 text-primary hover:text-primary/80 text-xs font-medium transition-colors cursor-pointer"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    />
                                  </svg>
                                  <span>View on Explorer</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
