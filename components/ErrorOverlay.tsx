// components/ErrorOverlay.tsx
type ErrorOverlayProps = {
  error: string | null;
  fallbackMessage: string | null;
  onRetry: (() => void) | null;
  retryLabel?: string;
};

export function ErrorOverlay({
  error,
  fallbackMessage,
  onRetry,
  retryLabel = "Retry",
}: ErrorOverlayProps) {
  if (!error && !fallbackMessage) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#1B202C] text-[#EEEBE8]">
      <div className="text-center space-y-3">
        {error ? (
          <>
            <p className="text-sm opacity-80">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 inline-flex items-center rounded-full bg-[#2A3344] px-4 py-1.5 text-sm font-medium text-[#EEEBE8]"
              >
                {retryLabel}
              </button>
            )}
          </>
        ) : (
          // Loading state only
          <p className="text-sm opacity-70">{fallbackMessage}</p>
        )}
      </div>
    </div>
  );
}
