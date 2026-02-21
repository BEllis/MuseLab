type PlayButtonProps = {
  href: string;
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
  textDecoration: "none" as const,
};

export function PlayButton({ href, title = "Play" }: PlayButtonProps) {
  return (
    <a
      href={href}
      title={title}
      style={iconButtonStyle}
      aria-label={title}
    >
      ▶
    </a>
  );
}
