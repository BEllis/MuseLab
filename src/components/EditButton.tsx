type EditButtonProps = {
  onClick: () => void;
  title?: string;
  disabled?: boolean;
};

export function EditButton({ onClick, title = "Edit template", disabled = false }: EditButtonProps) {
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
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M10.5 2.5 13.5 5.5 5.75 13.25H2.75V10.25L10.5 2.5Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
        <path d="M9 4 12 7" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    </button>
  );
}
