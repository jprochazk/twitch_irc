import { noop } from "./util.ts";

export interface Logger {
  // deno-lint-ignore no-explicit-any
  info(...args: any[]): void;
  // deno-lint-ignore no-explicit-any
  error(...args: any[]): void;
  // deno-lint-ignore no-explicit-any
  warn(...args: any[]): void;
}

export const SILENT_LOGGER: Logger = {
  info: noop,
  error: noop,
  warn: noop,
};

export const LOGGER: Logger = {
  info(...args) {
    console.info("[twitch_irc]", ...args);
  },
  error(...args) {
    console.error("[twitch_irc]", ...args);
  },
  warn(...args) {
    console.warn("[twitch_irc]", ...args);
  },
};
