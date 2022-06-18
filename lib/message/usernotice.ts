import { Channel } from "../base.ts";
import { Message, unescape } from "../message.ts";
import { ChatEvent, parseUser, User } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace UserNotice {
  export function parse(data: Message): UserNotice {
    const result: UserNotice = {
      raw: data,
      type: "usernotice",
      msgId: data.tags!.msgId!,
      channel: data.channel!,
      user: parseUser(data),
      roomId: data.tags!.roomId!,
      id: data.tags!.id!,
      systemMsg: data.tags!.systemMsg!,
      sentAt: data.tag("tmiSentTs", "number")!,
    };
    const text = data.params.at(-1);
    if (text) result.text = text;

    switch (result.msgId) {
      case "sub":
      case "resub":
        result.params = parseParams_Sub(data);
        break;
      case "subgift":
      case "anonsubgift":
        result.params = parseParams_SubGift(data);
        break;
      case "giftpaidupgrade":
      case "anongiftpaidupgrade":
        result.params = parseParams_GiftPaidUpgrade(data);
        break;
      case "raid":
        result.params = parseParams_Raid(data);
        break;
      case "ritual":
        result.params = parseParams_Ritual(data);
        break;
      case "bitsbadgetier":
        result.params = parseParams_BitsBadgeTier(data);
        break;
    }

    return result;
  }
}

export type UserNotice = ChatEvent<"usernotice"> & {
  msgId: string;
  channel: Channel;
  text?: string;
  user: User;
  roomId: string;
  id: string;
  systemMsg: string;
  sentAt: number;
  params?: UserNoticeParams;
};

export type UserNoticeParams = Sub | SubGift | GiftPaidUpgrade | Raid | Ritual | BitsBadgeTier;

// "sub", "resub"
function parseParams_Sub(data: Message): Sub {
  return {
    kind: "sub",
    cumulativeMonths: data.tag("msgParamCumulativeMonths", "number")!,
    shouldShareStreak: data.tag("msgParamShouldShareStreak", "number") === 1,
    streakMonths: data.tag("msgParamStreakMonths", "number") ?? 0,
    subPlan: data.tags!.msgParamSubPlan!,
    subPlanName: unescape(data.tags!.msgParamSubPlanName!),
    isResub: data.tags!.msgId === "resub",
  };
}

export type Sub = {
  kind: "sub";
  cumulativeMonths: number;
  shouldShareStreak: boolean;
  streakMonths: number;
  subPlan: string;
  subPlanName: string;
  isResub: boolean;
};

// "subgift", "anonsubgift"
function parseParams_SubGift(data: Message): SubGift {
  return {
    kind: "subgift",
    cumulativeMonths: data.tag("msgParamCumulativeMonths", "number")!,
    recipientUserId: data.tags!.msgParamRecipientId!,
    recipientLogin: data.tags!.msgParamRecipientUserName!,
    recipientDisplayName: unescape(data.tags!.msgParamRecipientDisplayName!),
    subPlan: data.tags!.msgParamSubPlan!,
    subPlanName: unescape(data.tags!.msgParamSubPlanName!),
    giftMonths: data.tag("msgParamGiftMonths", "number") ?? 1,
    isAnonymous: data.tags!.msgId === "anonsubgift",
  };
}

export type SubGift = {
  kind: "subgift";
  cumulativeMonths: number;
  recipientUserId: string;
  recipientLogin: string;
  recipientDisplayName: string;
  subPlan: string;
  subPlanName: string;
  giftMonths: number;
  isAnonymous: boolean;
};

// "giftpaidupgrade", "anongiftpaidupgrade"
function parseParams_GiftPaidUpgrade(data: Message): GiftPaidUpgrade {
  return {
    kind: "giftpaidupgrade",
    promoGiftTotal: data.tag("msgParamPromoGiftTotal", "number")!,
    promoName: data.tags!.msgParamPromoName!,
    senderLogin: data.tags!.msgParamSenderLogin!,
    senderDisplayName: data.tags!.msgParamSenderName!,
    isAnonymous: data.tags!.msgId === "anongiftpaidugrade",
  };
}

export type GiftPaidUpgrade = {
  kind: "giftpaidupgrade";
  promoGiftTotal: number;
  promoName: string;
  senderLogin: string;
  senderDisplayName: string;
  isAnonymous: boolean;
};

// "raid"
function parseParams_Raid(data: Message): Raid {
  return {
    kind: "raid",
    raiderDisplayName: unescape(data.tags!.msgParamDisplayname!),
    raiderLogin: data.tags!.msgParamLogin!,
    viewers: data.tag("msgParamViewercount", "number")!,
  };
}

export type Raid = {
  kind: "raid";
  raiderDisplayName: string;
  raiderLogin: string;
  viewers: number;
};

// "ritual"
function parseParams_Ritual(data: Message): Ritual {
  return {
    kind: "ritual",
    ritualName: data.tags!.msgParamRitualName!,
  };
}

export type Ritual = {
  kind: "ritual";
  ritualName: string;
};

// "bitsbadgetier"
function parseParams_BitsBadgeTier(data: Message): BitsBadgeTier {
  return {
    kind: "bitsbadgetier",
    threshold: data.tags!.msgParamThreshold!,
  };
}

export type BitsBadgeTier = {
  kind: "bitsbadgetier";
  threshold: string;
};
