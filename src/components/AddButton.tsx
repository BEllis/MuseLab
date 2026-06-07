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
      className="app-icon-button"
      style={{
        width: "22px",
        height: "22px",
        fontSize: "16px",
        lineHeight: 1,
      }}
      aria-label={title}
    >
      +
    </button>
  );
}
