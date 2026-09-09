import type { SharedProjectPayload } from "../../io/shareCapsule";

export function SharedProjectDialog({ payload, onOpen, onCancel }: { payload: SharedProjectPayload; onOpen: () => void; onCancel: () => void }) {
  const faces = payload.document.enclosureWorkspace?.enclosure.result?.panels.length ?? 0;
  const operations = payload.camSettings.operations.length;
  return <div className="shared-project-dialog" role="presentation">
    <section className="shared-project-dialog__card" role="dialog" aria-modal="true" aria-labelledby="shared-project-title">
      <h2 id="shared-project-title">Shared fabrication project</h2>
      <p>{payload.document.objects.length} design objects · {faces} box faces · {operations} cutting operations</p>
      <p>Opening replaces the current unsaved canvas. Your machine settings and device connection stay unchanged.</p>
      <div className="shared-project-dialog__actions"><button type="button" className="button button--accent" onClick={onOpen}>Open shared design</button><button type="button" className="button" onClick={onCancel}>Cancel</button></div>
    </section>
  </div>;
}
