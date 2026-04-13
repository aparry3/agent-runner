interface ValidationError {
  level: string;
  path: string;
  message: string;
}

interface ValidationWarning {
  path: string;
  message: string;
}

interface ValidationBannerProps {
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export function ValidationBanner({ errors, warnings }: ValidationBannerProps) {
  if (errors.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="border border-red-800 bg-red-950/40 rounded-lg p-3">
          <div className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">
            {errors.length} Error{errors.length !== 1 && "s"}
          </div>
          <div className="space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-zinc-500 shrink-0 font-mono text-xs mt-0.5">
                  {err.path || "root"}
                </span>
                <span className="text-red-300">{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="border border-yellow-800 bg-yellow-950/40 rounded-lg p-3">
          <div className="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-2">
            {warnings.length} Warning{warnings.length !== 1 && "s"}
          </div>
          <div className="space-y-1">
            {warnings.map((warn, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-zinc-500 shrink-0 font-mono text-xs mt-0.5">
                  {warn.path || "root"}
                </span>
                <span className="text-yellow-300">{warn.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
