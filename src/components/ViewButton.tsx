type ViewButtonProps = {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
};

export function ViewButton({ onClick, title = "View", disabled = false }: ViewButtonProps) {
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
        lineHeight: 1,
      }}
      aria-label={title}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M1.5 8s2.75-4.5 6.5-4.5S14.5 8 14.5 8s-2.75 4.5-6.5 4.5S1.5 8 1.5 8Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    </button>
  );
}
