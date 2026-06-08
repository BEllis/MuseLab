type PlayButtonProps = {
  onClick: () => void;
  title?: string;
  variant?: "default" | "overlay";
};

export function PlayButton({ onClick, title = "Play", variant = "default" }: PlayButtonProps) {
  const overlay = variant === "overlay";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={overlay ? "app-canvas-overlay-button" : "app-icon-button"}
      style={
        overlay
          ? { fontSize: "16px", lineHeight: 1, paddingLeft: "2px" }
          : {
              width: "22px",
              height: "22px",
              fontSize: "14px",
              lineHeight: 1,
            }
      }
      aria-label={title}
    >
      ▶
    </button>
  );
}
