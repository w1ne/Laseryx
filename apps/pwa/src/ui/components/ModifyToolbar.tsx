import { useStore } from "../../core/state/store";
import { ObjectService } from "../../core/services/ObjectService";
import { GroupService } from "../../core/services/GroupService";
import { findGroupContaining } from "../../core/groups";
import {
  duplicateObject,
  mirrorHorizontal,
  mirrorVertical,
  rotate90,
  nudgeObject
} from "../../core/objectEdit";

/**
 * Edit menu — group ops + transforms (not Properties).
 * Lives on the canvas toolbar next to constraints.
 */
export function ModifyToolbar() {
  const { state, dispatch } = useStore();
  const { document, selectedObjectId, selectedObjectIds } = state;
  const ids =
    selectedObjectIds.length > 0
      ? selectedObjectIds
      : selectedObjectId
        ? [selectedObjectId]
        : [];
  const selected = document.objects.find((o) => o.id === selectedObjectId);
  const group = selected ? findGroupContaining(document, selected.id) : undefined;
  const canGroup = ids.length >= 2;
  const canUngroup = ids.some((id) => !!findGroupContaining(document, id));
  const hasSelection = ids.length > 0;
  const derived = !!selected?.id.startsWith("components-box:");
  const derivedPlacement = derived && group ? document.enclosureWorkspace?.sheetLayout?.placements.find(({ partId }) => group.id.endsWith(`:${partId}`) || (partId === "fit-coupon" && group.id.endsWith(":coupon"))) : undefined;

  const applyPatch = (patch: ReturnType<typeof mirrorHorizontal>) => {
    if (!selected || !patch) return;
    ObjectService.updateObject(dispatch, selected.id, patch);
  };
  const nudge = (dx: number, dy: number) => group ? GroupService.translateSelection(state, dispatch, group.memberIds, dx, dy) : selected && applyPatch(nudgeObject(selected, dx, dy));
  const rotate = () => group && derivedPlacement && GroupService.updateEnclosurePlacement(state, dispatch, group.memberIds, { rotation: derivedPlacement.rotation === 90 ? 0 : 90 }) || (!derived && selected && applyPatch(rotate90(selected, 1)));

  const dup = () => {
    if (!selected) return;
    const copy = duplicateObject(selected, 10);
    dispatch({ type: "ADD_OBJECT", payload: copy });
    dispatch({ type: "SELECT_OBJECT", payload: copy.id });
  };

  return (
    <div className="editbar" data-testid="modify-toolbar" role="toolbar" aria-label="Edit">
      <span className="editbar__label">Edit</span>

      <button
        type="button"
        className="editbar__btn"
        disabled={!canGroup || derived}
        title="Group — bind 2+ selected objects so they select and move together (⌘/Ctrl+G)"
        onClick={() => GroupService.groupSelection(state, dispatch)}
      >
        Group
      </button>
      <button
        type="button"
        className="editbar__btn"
        disabled={!canUngroup || derived}
        title="Ungroup — split the selected group (⌘/Ctrl+Shift+G)"
        onClick={() => GroupService.ungroupSelection(state, dispatch)}
      >
        Ungroup
      </button>

      {group && (
        <span className="editbar__hint" title="Click any member to select the whole group; drag to move together">
          {group.name} · {group.memberIds.length} parts
        </span>
      )}

      <span className="editbar__sep" />

      <button
        type="button"
        className="editbar__btn"
        disabled={!selected || derived}
        title="Mirror horizontally (left ↔ right) about center"
        onClick={() => selected && applyPatch(mirrorHorizontal(selected))}
      >
        Mirror H
      </button>
      <button
        type="button"
        className="editbar__btn"
        disabled={!selected || derived}
        title="Mirror vertically (top ↔ bottom) about center"
        onClick={() => selected && applyPatch(mirrorVertical(selected))}
      >
        Mirror V
      </button>
      <button
        type="button"
        className="editbar__btn"
        disabled={!selected || (derived && !derivedPlacement)}
        title="Rotate 90° clockwise around center"
        onClick={rotate}
      >
        Rotate 90°
      </button>
      <button
        type="button"
        className="editbar__btn"
        disabled={!selected || derived}
        title="Duplicate (offset 10 mm). Shortcut: ⌘/Ctrl+D"
        onClick={dup}
      >
        Duplicate
      </button>

      <span className="editbar__sep" />

      <button
        type="button"
        className="editbar__btn editbar__btn--icon"
        disabled={!selected}
        title="Nudge left 1 mm (← · Shift = 10 mm)"
        onClick={() => nudge(-1, 0)}
      >
        ←
      </button>
      <button
        type="button"
        className="editbar__btn editbar__btn--icon"
        disabled={!selected}
        title="Nudge right 1 mm (→ · Shift = 10 mm)"
        onClick={() => nudge(1, 0)}
      >
        →
      </button>
      <button
        type="button"
        className="editbar__btn editbar__btn--icon"
        disabled={!selected}
        title="Nudge up 1 mm (↑ · Shift = 10 mm)"
        onClick={() => nudge(0, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="editbar__btn editbar__btn--icon"
        disabled={!selected}
        title="Nudge down 1 mm (↓ · Shift = 10 mm)"
        onClick={() => nudge(0, 1)}
      >
        ↓
      </button>

      {!hasSelection && (
        <span className="editbar__hint">Select an object to edit</span>
      )}

      <style>{`
        .editbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          font-size: 12px;
          color: #0f172a;
        }
        .editbar__label {
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 10px;
          color: #64748b;
          margin-right: 4px;
        }
        .editbar__btn {
          margin: 0;
          padding: 5px 9px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          color: #0f172a;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        .editbar__btn--icon {
          min-width: 30px;
          padding: 5px 6px;
        }
        .editbar__btn:hover:not(:disabled) {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        .editbar__btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .editbar__sep {
          width: 1px;
          height: 22px;
          background: #e2e8f0;
          margin: 0 4px;
        }
        .editbar__hint {
          color: #64748b;
          font-size: 11px;
          font-weight: 600;
          margin-left: 2px;
          max-width: 180px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
