import { useEffect, useState } from "react";
import { createWorkerClient } from "./workerClient";
import "./app.css";

export function App() {
  const [pong, setPong] = useState("waiting...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL("../worker/worker.ts", import.meta.url), {
      type: "module"
    });
    const client = createWorkerClient(worker);
    let active = true;

    client
      .ping()
      .then((value) => {
        if (!active) {
          return;
        }
        setPong(value);
        setError(null);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      active = false;
      client.dispose();
    };
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1>Laser PWA</h1>
        <p>Milestone 0 scaffold: worker wired, PWA shell ready.</p>
      </header>
      <section className="app__card">
        <div className="app__label">Worker response</div>
        {error ? <div className="app__error">{error}</div> : <div className="app__pong">{pong}</div>}
      </section>
    </div>
  );
}
