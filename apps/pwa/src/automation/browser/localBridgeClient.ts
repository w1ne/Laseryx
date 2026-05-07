import type { InAppAutomationBridge } from "./inAppBridge";

type FetchLike = typeof fetch;

export type LocalBridgeClientOptions = {
  bridgeUrl: string;
  token: string;
  bridge: InAppAutomationBridge;
  fetchImpl?: FetchLike;
};

export type LocalBridgeConfig = {
  bridgeUrl: string;
  token: string;
};

export function readLocalBridgeConfig(search: string): LocalBridgeConfig | null {
  const params = new URLSearchParams(search);
  const bridgeUrl = params.get("laseryxBridge");
  if (!bridgeUrl) {
    return null;
  }

  return {
    bridgeUrl,
    token: params.get("laseryxToken") ?? "dev"
  };
}

function buildBridgeUrl(base: string, path: string, token: string): string {
  const url = new URL(path, base);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function runLocalBridgePollOnce(options: LocalBridgeClientOptions): Promise<boolean> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const nextResponse = await fetchImpl(buildBridgeUrl(options.bridgeUrl, "/next", options.token));

  if (nextResponse.status === 204) {
    return false;
  }
  if (!nextResponse.ok) {
    throw new Error(`Bridge poll failed: ${nextResponse.status}`);
  }

  const request = await nextResponse.json();
  const protocolResponse = options.bridge.request(request);

  const postResponse = await fetchImpl(buildBridgeUrl(options.bridgeUrl, "/response", options.token), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(protocolResponse)
  });
  if (!postResponse.ok) {
    throw new Error(`Bridge response failed: ${postResponse.status}`);
  }

  return true;
}

export function startLocalBridgeClient(options: LocalBridgeClientOptions): () => void {
  let active = true;
  const loop = async () => {
    while (active) {
      try {
        await runLocalBridgePollOnce(options);
      } catch (error) {
        console.warn("Laseryx automation bridge disconnected", error);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  };
  void loop();
  return () => {
    active = false;
  };
}
