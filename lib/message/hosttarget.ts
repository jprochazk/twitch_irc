import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace HostTarget {
  export function parse(data: Message): HostTarget {
    const result: HostTarget = {
      raw: data,
      type: "hosttarget",
      from: data.channel!,
    };
    const info = parseHostTargetInfo(data.params.at(-1));
    if (info) {
      result.to = info.to;
      result.viewers = info.viewers;
    }
    return result;
  }
}

function parseHostTargetInfo(value?: string) {
  if (!value) return null;
  const splitIdx = value.indexOf(" ");
  if (splitIdx === -1) return null;
  const [l, r] = [value.slice(0, splitIdx), value.slice(splitIdx)];
  if (l === "-" || r === "-") return null;
  return {
    to: l,
    viewers: parseInt(r),
  };
}

export type HostTarget = ChatEvent<"hosttarget"> & {
  /** The channel that initiated the host */
  from: string;
  /**
   * The channel that is receiving the host.
   *
   * If this is `undefined`, it means the source channel
   * is cancelling the host.
   */
  to?: string;
  /** Number of viewers which are taking part in the host */
  viewers?: number;
};
