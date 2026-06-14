type ReplaceImageButtonProps = {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
};

function ReplaceImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.75 4.25h3.5L6.125 5.5H12.25V10.25H1.75V4.25Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M7 6.75v3M5.5 8.25h3"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ReplaceImageButton({
  onClick,
  title = "Replace image…",
  disabled = false,
}: ReplaceImageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="app-icon-button"
      style={{
        width: "22px",
        height: "22px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
      aria-label={title}
    >
      <ReplaceImageIcon />
    </button>
  );
}
