import React from "react";

export const DonateButton: React.FC = () => {
    const DONATE_URL = "https://buymeacoffee.com/3qutj2ucoq";

    return (
        <a
            href={DONATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="donate-button"
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "6px 12px",
                backgroundColor: "#FFDD00", // SMB Yellow
                color: "#000000",
                textDecoration: "none",
                borderRadius: "4px",
                fontWeight: "bold",
                fontSize: "0.9rem",
                border: "none",
                cursor: "pointer",
                marginLeft: "8px"
            }}
        >
            ☕ Buy me a coffee
        </a>
    );
};
