import { expect } from "vitest";

type CapturedIpcHandler = (...args: unknown[]) => unknown;

/** Invokes an IPC handler captured by an Electron mock with an explicit result contract. */
export async function invokeCapturedHandler<TResult>(
  handlers: ReadonlyMap<string, CapturedIpcHandler>,
  channel: string,
  ...args: unknown[]
): Promise<TResult> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return await handler(...args) as TResult;
}

/** Narrows an IPC response union to its successful variant. */
export function expectOkResult<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
}

/** Narrows an IPC response union to its error variant. */
export function expectErrorResult<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: false }> {
  expect(result.ok).toBe(false);
}
