type CloseButtonProps = {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
};

export function CloseButton({ onClick, title = "Close", disabled = false }: CloseButtonProps) {
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
        fontSize: "14px",
        lineHeight: 1,
      }}
      aria-label={title}
    >
      ×
    </button>
  );
}
