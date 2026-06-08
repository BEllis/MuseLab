type AddButtonProps = {
  onClick: () => void;
  title: string;
  variant?: "default" | "overlay";
};

export function AddButton({ onClick, title, variant = "default" }: AddButtonProps) {
  const overlay = variant === "overlay";

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={overlay ? "app-canvas-overlay-button" : "app-icon-button"}
      style={
        overlay
          ? { fontSize: "24px", lineHeight: 1, fontWeight: 300 }
          : {
              width: "22px",
              height: "22px",
              fontSize: "16px",
              lineHeight: 1,
            }
      }
      aria-label={title}
    >
      +
    </button>
  );
}
