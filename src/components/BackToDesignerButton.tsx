import { Link } from "react-router-dom";

type BackToDesignerButtonProps = {
  variant?: "default" | "overlay" | "player";
  title?: string;
};

function BackToDesignerIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size * 0.82}
      viewBox="0 0 26 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 10H3M3 10L5.5 7.5M3 10L5.5 12.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="12" y="3" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="18" y="12" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M18 5.5h1v4.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackToDesignerButton({
  variant = "default",
  title = "Back to designer",
}: BackToDesignerButtonProps) {
  const overlay = variant === "overlay" || variant === "player";

  return (
    <Link
      to="/"
      title={title}
      aria-label={title}
      className={
        variant === "player"
          ? "app-player-overlay-button"
          : overlay
            ? "app-canvas-overlay-button"
            : "app-icon-button"
      }
      style={{
        textDecoration: "none",
        color: "inherit",
        ...(overlay
          ? undefined
          : {
              width: "22px",
              height: "22px",
            }),
      }}
    >
      <BackToDesignerIcon size={overlay ? 21 : 14} />
    </Link>
  );
}
