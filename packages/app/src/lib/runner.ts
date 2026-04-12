import { createRunner, type Runner } from "@agent-runner/core";
import { getStore } from "./store";

let _runner: Runner | null = null;

/**
 * Get the singleton Runner instance.
 * Connected to the shared store, configured from environment.
 */
export async function getRunner(): Promise<Runner> {
  if (_runner) return _runner;

  const store = await getStore();

  _runner = createRunner({
    store,
    defaults: {
      model: {
        provider: process.env.DEFAULT_MODEL_PROVIDER ?? "openai",
        name: process.env.DEFAULT_MODEL_NAME ?? "gpt-4o",
      },
    },
  });

  return _runner;
}
