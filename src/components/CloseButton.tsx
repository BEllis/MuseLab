type CloseButtonProps = {
  onClick: () => void;
  title?: string;
};

const iconButtonStyle = {
  display: "inline-flex" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  width: "22px",
  height: "22px",
  padding: 0,
  border: "1px solid #999",
  borderRadius: "4px",
  background: "#f5f5f5",
  color: "#333",
  fontSize: "14px",
  lineHeight: 1,
  cursor: "pointer" as const,
};

export function CloseButton({ onClick, title = "Close" }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={iconButtonStyle}
      aria-label={title}
    >
      ×
    </button>
  );
}
