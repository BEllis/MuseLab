type AddButtonProps = {
  onClick: () => void;
  title: string;
};

export function AddButton({ onClick, title }: AddButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        padding: 0,
        border: "1px solid #999",
        borderRadius: "4px",
        background: "#f5f5f5",
        color: "#333",
        fontSize: "16px",
        lineHeight: 1,
        cursor: "pointer",
      }}
      aria-label={title}
    >
      +
    </button>
  );
}
