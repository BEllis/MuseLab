import type { CitoWasmLoadProgress } from "@/core/cito/citoWasmLoader";

type CitoWasmSplashProps = {
  progress: CitoWasmLoadProgress;
  error?: string | null;
  logoUrl: string;
};

function progressPercent(progress: CitoWasmLoadProgress): number {
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

export function CitoWasmSplash({ progress, error, logoUrl }: CitoWasmSplashProps) {
  const percent = progressPercent(progress);

  return (
    <div className="cito-wasm-splash" role="status" aria-live="polite" aria-busy={!error}>
      <div className="cito-wasm-splash__panel">
        <img className="cito-wasm-splash__logo" src={logoUrl} alt="MuseLab" />
        <h1 className="cito-wasm-splash__title">MuseLab</h1>
        <p className="cito-wasm-splash__subtitle">Visual Novel Designer</p>
        {error ? (
          <p className="cito-wasm-splash__error">{error}</p>
        ) : (
          <>
            <p className="cito-wasm-splash__label">{progress.label}</p>
            <div
              className="cito-wasm-splash__bar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div className="cito-wasm-splash__bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="cito-wasm-splash__percent">{percent}%</p>
          </>
        )}
      </div>
    </div>
  );
}
