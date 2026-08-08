import type { TemplateIcon } from "../../core/templates";

/** Simple monochrome icons for the shape library. */
export function TemplateIconSvg({ name }: { name: TemplateIcon }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 28 28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const
  };

  switch (name) {
    case "rect":
      return (
        <svg {...common}>
          <rect x="5" y="7" width="18" height="14" rx="1.5" />
        </svg>
      );
    case "hole":
      return (
        <svg {...common}>
          <circle cx="14" cy="14" r="7" />
          <circle cx="14" cy="14" r="2.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "frame":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="20" height="16" rx="1.5" />
          <rect x="8" y="10" width="12" height="8" rx="0.5" />
        </svg>
      );
    case "cutout":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="20" height="16" rx="1.5" strokeDasharray="3 2" />
          <rect x="9" y="10" width="10" height="8" rx="0.5" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path d="M14 5v12" />
          <path d="M9 12l5 5 5-5" />
          <path d="M6 21h16" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="6" y="6" width="16" height="16" />
        </svg>
      );
  }
}
