import React from "react";

type AboutDialogProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>About LaserFather</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body" style={{ lineHeight: "1.6", color: "#333" }}>
                    <p>
                        <strong>LaserFather v{__APP_VERSION__}</strong>
                        {__GIT_SHA__ && __GIT_SHA__ !== `v${__APP_VERSION__}` && __GIT_SHA__ !== __APP_VERSION__ && (
                            <span style={{ fontSize: "0.8em", opacity: 0.6, marginLeft: "8px" }}>
                                ({__GIT_SHA__})
                            </span>
                        )}
                    </p>
                    <hr style={{ margin: "16px 0", border: "0", borderTop: "1px solid #eee" }} />
                    <p>
                        Created by <a href="#" onClick={(e) => { e.preventDefault(); window.open("https://shylenko.com", "_blank"); }} style={{ color: "#2563eb", fontWeight: "600" }}>Andrii Shylenko</a>.
                    </p>
                    <p style={{ marginTop: "12px" }}>
                        <strong>Source Code:</strong><br />
                        <a href="#" onClick={(e) => { e.preventDefault(); window.open("https://github.com/w1ne/Laserfather", "_blank"); }} style={{ color: "#2563eb" }}>
                            github.com/w1ne/Laserfather
                        </a>
                    </p>
                    <p style={{ marginTop: "12px" }}>
                        <strong>Documentation:</strong><br />
                        <a href="#" onClick={(e) => { e.preventDefault(); window.open("https://github.com/w1ne/Laserfather/tree/master/docs", "_blank"); }} style={{ color: "#2563eb" }}>
                            Documentation on GitHub
                        </a>
                    </p>
                    <hr style={{ margin: "16px 0", border: "0", borderTop: "1px solid #eee" }} />
                    <p style={{ fontSize: "13px", color: "#666" }}>
                        Licensed under <strong>CC BY-NC-SA 4.0</strong>.<br />
                        Free for personal and open-source use. Commercial use restricted to the author.
                    </p>
                </div>
                <div className="modal-footer">
                    <button className="button" onClick={onClose}>Close</button>
                </div>
            </div>
            <style>{`
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(2px);
                }
                .modal-content {
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    width: 400px;
                    max-width: 90vw;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                }
                .modal-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 16px;
                }
                .modal-header h2 { margin: 0; font-size: 20px; color: #1e293b; }
                .close-button {
                    background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;
                }
                .modal-footer {
                    margin-top: 24px; display: flex; justify-content: flex-end;
                }
            `}</style>
        </div>
    );
}
