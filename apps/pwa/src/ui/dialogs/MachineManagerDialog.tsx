import React, { useState } from "react";
import { useStore } from "../../core/state/store";
import { MachineProfile } from "../../core/model";
import { machineRepo } from "../../io/machineRepo";
import { INITIAL_MACHINE_PROFILE } from "../../core/state/types";

type Props = {
    isOpen: boolean;
    onClose: () => void;
};

export function MachineManagerDialog({ isOpen, onClose }: Props) {
    const { state, dispatch } = useStore();
    const { machineProfiles, activeMachineProfileId } = state;

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<MachineProfile | null>(null);

    if (!isOpen) return null;

    const handleEdit = (profile: MachineProfile) => {
        setEditingId(profile.id);
        setEditForm({ ...profile });
    };

    const handleCreate = () => {
        const newProfile: MachineProfile = {
            ...INITIAL_MACHINE_PROFILE,
            id: `machine-${Date.now()}`,
            name: "New Machine",
        };
        setEditingId(newProfile.id);
        setEditForm(newProfile);
    };

    const handleSave = async () => {
        if (!editForm) return;

        // Persist
        await machineRepo.save(editForm);

        // Update Store
        if (machineProfiles.find(p => p.id === editForm.id)) {
            dispatch({ type: "UPDATE_MACHINE_PROFILE", payload: { id: editForm.id, changes: editForm } });
        } else {
            dispatch({ type: "ADD_MACHINE_PROFILE", payload: editForm });
        }

        setEditingId(null);
        setEditForm(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this machine profile?")) return;
        await machineRepo.delete(id);
        dispatch({ type: "DELETE_MACHINE_PROFILE", payload: id });
    };

    const handleSelect = (id: string) => {
        dispatch({ type: "SELECT_MACHINE_PROFILE", payload: id });
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h3>Manage Machines</h3>
                    <button onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {editingId && editForm ? (
                        <div className="edit-form">
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className="form-row">
                                <label>
                                    Width (mm)
                                    <input
                                        type="number"
                                        value={editForm.bedMm.w}
                                        onChange={e => setEditForm({ ...editForm, bedMm: { ...editForm.bedMm, w: e.target.valueAsNumber } })}
                                    />
                                </label>
                                <label>
                                    Height (mm)
                                    <input
                                        type="number"
                                        value={editForm.bedMm.h}
                                        onChange={e => setEditForm({ ...editForm, bedMm: { ...editForm.bedMm, h: e.target.valueAsNumber } })}
                                    />
                                </label>
                            </div>
                            <div className="form-row">
                                <label>
                                    S-Min
                                    <input
                                        type="number"
                                        value={editForm.sRange.min}
                                        onChange={e => setEditForm({ ...editForm, sRange: { ...editForm.sRange, min: e.target.valueAsNumber } })}
                                    />
                                </label>
                                <label>
                                    S-Max
                                    <input
                                        type="number"
                                        value={editForm.sRange.max}
                                        onChange={e => setEditForm({ ...editForm, sRange: { ...editForm.sRange, max: e.target.valueAsNumber } })}
                                    />
                                </label>
                            </div>
                            <div className="form-group">
                                <label>Baud Rate</label>
                                <select
                                    value={editForm.baudRate}
                                    onChange={e => setEditForm({ ...editForm, baudRate: Number(e.target.value) })}
                                >
                                    <option value={115200}>115200</option>
                                    <option value={57600}>57600</option>
                                    <option value={38400}>38400</option>
                                    <option value={9600}>9600</option>
                                </select>
                            </div>

                            <div className="form-actions">
                                <button className="button" onClick={() => setEditingId(null)}>Cancel</button>
                                <button className="button button--primary" onClick={handleSave}>Save</button>
                            </div>
                        </div>
                    ) : (
                        <div className="machine-list">
                            {machineProfiles.map(p => (
                                <div key={p.id} className={`machine-item ${p.id === activeMachineProfileId ? "active" : ""}`}>
                                    <div className="machine-info" onClick={() => handleSelect(p.id)}>
                                        <div className="machine-name">{p.name}</div>
                                        <div className="machine-meta">{p.bedMm.w}x{p.bedMm.h}mm | {p.baudRate} baud</div>
                                    </div>
                                    <div className="machine-actions">
                                        <button className="button button--small" onClick={() => handleEdit(p)}>Edit</button>
                                        {machineProfiles.length > 1 && (
                                            <button className="button button--small button--danger" onClick={() => handleDelete(p.id)}>Del</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button className="button button--full" onClick={handleCreate}>+ Add Machine</button>
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                .modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 1000;
                }
                .modal {
                    background: #fff;
                    width: 450px;
                    border-radius: 16px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    overflow: hidden;
                    color: #0f172a;
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .modal-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex; justify-content: space-between; align-items: center;
                    background: #f8fafc;
                }
                .modal-header h3 { margin: 0; font-size: 1rem; font-weight: 600; color: #334155; }
                .modal-header button { 
                    border: none; background: transparent; font-size: 1.5rem; color: #94a3b8; cursor: pointer; line-height: 1;
                }
                .modal-header button:hover { color: #64748b; }
                
                .modal-body { padding: 20px; }
                
                .machine-item {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 8px;
                    cursor: pointer; transition: all 0.2s;
                    background: #fff;
                }
                .machine-item:hover { border-color: #cbd5e1; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .machine-item.active { border-color: #3b82f6; background: #eff6ff; ring: 1px solid #3b82f6; }
                
                .machine-info { flex: 1; }
                .machine-name { font-weight: 600; font-size: 0.95rem; margin-bottom: 2px; }
                .machine-meta { font-size: 0.8rem; color: #64748b; font-family: 'JetBrains Mono', monospace; }
                .machine-actions { display: flex; gap: 8px; }
                
                .edit-form { display: flex; flex-direction: column; gap: 16px; }
                .form-group label { display: block; font-size: 0.8rem; margin-bottom: 6px; color: #64748b; font-weight: 500; }
                .form-group input, .form-group select { 
                    width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.9rem;
                    outline: none; transition: border-color 0.2s;
                }
                .form-group input:focus, .form-group select:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1); }
                
                .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
                
                .button { 
                    padding: 8px 16px; border: 1px solid #cbd5e1; background: #fff; 
                    border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 500;
                    color: #334155; transition: all 0.2s;
                }
                .button:hover { background: #f8fafc; border-color: #94a3b8; }
                
                .button--primary { 
                    background: #3b82f6; color: white; border-color: #3b82f6; 
                    box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);
                }
                .button--primary:hover { background: #2563eb; border-color: #2563eb; transform: translateY(-1px); }
                
                .button--danger { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
                .button--danger:hover { background: #fee2e2; border-color: #fca5a5; }
                
                .button--small { padding: 4px 10px; font-size: 0.75rem; }
                .button--full { width: 100%; margin-top: 12px; border-style: dashed; }
            `}</style>
        </div>
    );
}
