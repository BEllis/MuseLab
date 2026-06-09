import type { ReactNode } from "react";

type TabIconProps = {
  size?: number;
};

function TabIcon({ size = 16, children }: TabIconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function ProjectTabIcon({ size }: TabIconProps) {
  return (
    <TabIcon size={size}>
      <path
        d="M2.5 4.5h4l1 1.5H13.5V12.5H2.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 4.5V3.5H13.5V6H7.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </TabIcon>
  );
}

export function StoriesTabIcon({ size }: TabIconProps) {
  return (
    <TabIcon size={size}>
      <path
        d="M3 3.5h4.5v9H3.25c-.14 0-.25-.11-.25-.25V3.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 3.5H13v8.75c0 .14-.11.25-.25.25H7.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M7.5 3.5v9" stroke="currentColor" strokeWidth="1.25" />
    </TabIcon>
  );
}

export function AssetsTabIcon({ size }: TabIconProps) {
  return (
    <TabIcon size={size}>
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="9"
        rx="1.25"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M5 10l2-2 1.5 1.5L11 8l2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5.75" cy="6.25" r="0.75" fill="currentColor" />
    </TabIcon>
  );
}

export function ModulesTabIcon({ size }: TabIconProps) {
  return (
    <TabIcon size={size}>
      <path
        d="M6.5 2.5 3.5 4.25v3.5L6.5 9.5 9.5 7.75V4.25L6.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 4.25 12.5 6v3.5L9.5 11.25 6.5 9.5"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </TabIcon>
  );
}
