type PlayButtonProps = {
  onClick: () => void;
  title?: string;
};

export function PlayButton({ onClick, title = "Play" }: PlayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="app-icon-button"
      style={{
        width: "22px",
        height: "22px",
        fontSize: "14px",
        lineHeight: 1,
      }}
      aria-label={title}
    >
      ▶
    </button>
  );
}
