import type { TemplateIcon } from "../../core/templates";

/** Sketch tool icons. */
export function TemplateIconSvg({ name }: { name: TemplateIcon }) {
  const common = {
    width: 32,
    height: 32,
    viewBox: "0 0 32 32",
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
          <rect x="6" y="8" width="20" height="16" rx="1" />
        </svg>
      );
    case "hole":
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="8" />
        </svg>
      );
    case "line":
      return (
        <svg {...common}>
          <line x1="6" y1="24" x2="26" y2="8" />
        </svg>
      );
    case "construction":
      return (
        <svg {...common}>
          <line x1="6" y1="24" x2="26" y2="8" strokeDasharray="3 2.5" />
        </svg>
      );
    case "import":
      return (
        <svg {...common}>
          <path d="M16 6v14" />
          <path d="M10 14l6 6 6-6" />
          <path d="M7 26h18" />
        </svg>
      );
    case "frame":
    case "cutout":
      return (
        <svg {...common}>
          <rect x="6" y="8" width="20" height="16" rx="1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="8" y="8" width="16" height="16" />
        </svg>
      );
  }
}
