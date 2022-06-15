import * as testing from "https://deno.land/std@0.143.0/testing/asserts.ts";
import { Message } from "./message.ts";

const cases = [
  [
    "tags with long unicode chars",
    "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871;some-tag=とりくしい :tmi.twitch.tv CLEARMSG #randers :asdf",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871;some-tag=とりくしい :tmi.twitch.tv CLEARMSG #randers :asdf",
      /*command:*/ { kind: "CLEARMSG" },
      /*params:*/ ["asdf"],
      /*tags:*/ {
        login: "supibot",
        targetMsgId: "25fd76d9-4731-4907-978e-a391134ebd67",
        tmiSentTs: "-6795364578871",
        someTag: "とりくしい",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "message includes semicolons",
    "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871 :tmi.twitch.tv CLEARMSG #randers :Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871 :tmi.twitch.tv CLEARMSG #randers :Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
      /*command:*/ { kind: "CLEARMSG" },
      /*params:*/ [
        "Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
      ],
      /*tags:*/ {
        login: "supibot",
        targetMsgId: "25fd76d9-4731-4907-978e-a391134ebd67",
        tmiSentTs: "-6795364578871",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "ping",
    "PING",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "PING",
      /*command:*/ { kind: "PING" },
      /*params:*/ [],
      /*tags:*/ undefined,
      /*prefix:*/ undefined,
      /*channel:*/ undefined
    ),
  ],
  [
    "pong",
    "PONG",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "PONG",
      /*command:*/ { kind: "PONG" },
      /*params:*/ [],
      /*tags:*/ undefined,
      /*prefix:*/ undefined,
      /*channel:*/ undefined
    ),
  ],
  [
    "ping with arg",
    "PING :tmi.twitch.tv",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "PING :tmi.twitch.tv",
      /*command:*/ { kind: "PING" },
      /*params:*/ ["tmi.twitch.tv"],
      /*tags:*/ undefined,
      /*prefix:*/ undefined,
      /*channel:*/ undefined
    ),
  ],
  [
    "pong with arg",
    "PONG :tmi.twitch.tv",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "PONG :tmi.twitch.tv",
      /*command:*/ { kind: "PONG" },
      /*params:*/ ["tmi.twitch.tv"],
      /*tags:*/ undefined,
      /*prefix:*/ undefined,
      /*channel:*/ undefined
    ),
  ],
  [
    "welcome message",
    ":tmi.twitch.tv 001 justinfan12345 :Welcome, GLHF!",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv 001 justinfan12345 :Welcome, GLHF!",
      /*command:*/ { kind: "UNKNOWN", raw: "001" },
      /*params:*/ ["justinfan12345", "Welcome, GLHF!"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "cap ls",
    ":tmi.twitch.tv CAP * LS :twitch.tv/commands twitch.tv/tags twitch.tv/membership",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv CAP * LS :twitch.tv/commands twitch.tv/tags twitch.tv/membership",
      /*command:*/ { kind: "CAP" },
      /*params:*/ ["*", "LS", "twitch.tv/commands twitch.tv/tags twitch.tv/membership"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "cap nak",
    ":tmi.twitch.tv CAP * NAK :twitch.tv/invalid",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv CAP * NAK :twitch.tv/invalid",
      /*command:*/ { kind: "CAP" },
      /*params:*/ ["*", "NAK", "twitch.tv/invalid"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "cap nak *",
    ":tmi.twitch.tv CAP * NAK :twitch.tv/invalid0 twitch.tv/invalid1 twitch.tv/invalid2",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv CAP * NAK :twitch.tv/invalid0 twitch.tv/invalid1 twitch.tv/invalid2",
      /*command:*/ { kind: "CAP" },
      /*params:*/ ["*", "NAK", "twitch.tv/invalid0 twitch.tv/invalid1 twitch.tv/invalid2"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "cap ack",
    ":tmi.twitch.tv CAP * ACK :twitch.tv/commands",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv CAP * ACK :twitch.tv/commands",
      /*command:*/ { kind: "CAP" },
      /*params:*/ ["*", "ACK", "twitch.tv/commands"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "cap ack *",
    ":tmi.twitch.tv CAP * ACK :twitch.tv/commands twitch.tv/tags twitch.tv/membership",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv CAP * ACK :twitch.tv/commands twitch.tv/tags twitch.tv/membership",
      /*command:*/ { kind: "CAP" },
      /*params:*/ ["*", "ACK", "twitch.tv/commands twitch.tv/tags twitch.tv/membership"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "userstate",
    "@badge-info=;badges=;color=#FF0000;display-name=zwb3_pyramids;emote-sets=0;mod=0;subscriber=0;user-type= :tmi.twitch.tv USERSTATE #randers",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=;color=#FF0000;display-name=zwb3_pyramids;emote-sets=0;mod=0;subscriber=0;user-type= :tmi.twitch.tv USERSTATE #randers",
      /*command:*/ { kind: "USERSTATE" },
      /*params:*/ [],
      /*tags:*/ {
        color: "#FF0000",
        displayName: "zwb3_pyramids",
        emoteSets: "0",
        mod: "0",
        subscriber: "0",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "reconnect",
    ":tmi.twitch.tv RECONNECT",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv RECONNECT",
      /*command:*/ { kind: "RECONNECT" },
      /*params:*/ [],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "usernotice gift",
    "@badge-info=;badges=staff/1,premium/1;color=#0000FF;display-name=TWW2;emotes=;id=e9176cd8-5e22-4684-ad40-ce53c2561c5e;login=tww2;mod=0;msg-id=subgift;msg-param-months=1;msg-param-recipient-display-name=Mr_Woodchuck;msg-param-recipient-id=89614178;msg-param-recipient-user-name=mr_woodchuck;msg-param-sub-plan-name=House\\sof\\sNyoro~n;msg-param-sub-plan=1000;room-id=19571752;subscriber=0;system-msg=TWW2\\sgifted\\sa\\sTier\\s1\\ssub\\sto\\sMr_Woodchuck!;tmi-sent-ts=1521159445153;turbo=0;user-id=13405587;user-type=staff :tmi.twitch.tv USERNOTICE #forstycup",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=staff/1,premium/1;color=#0000FF;display-name=TWW2;emotes=;id=e9176cd8-5e22-4684-ad40-ce53c2561c5e;login=tww2;mod=0;msg-id=subgift;msg-param-months=1;msg-param-recipient-display-name=Mr_Woodchuck;msg-param-recipient-id=89614178;msg-param-recipient-user-name=mr_woodchuck;msg-param-sub-plan-name=House\\sof\\sNyoro~n;msg-param-sub-plan=1000;room-id=19571752;subscriber=0;system-msg=TWW2\\sgifted\\sa\\sTier\\s1\\ssub\\sto\\sMr_Woodchuck!;tmi-sent-ts=1521159445153;turbo=0;user-id=13405587;user-type=staff :tmi.twitch.tv USERNOTICE #forstycup",
      /*command:*/ { kind: "USERNOTICE" },
      /*params:*/ [],
      /*tags:*/ {
        badges: "staff/1,premium/1",
        color: "#0000FF",
        displayName: "TWW2",
        id: "e9176cd8-5e22-4684-ad40-ce53c2561c5e",
        login: "tww2",
        mod: "0",
        msgId: "subgift",
        msgParamMonths: "1",
        msgParamRecipientDisplayName: "Mr_Woodchuck",
        msgParamRecipientId: "89614178",
        msgParamRecipientUserName: "mr_woodchuck",
        msgParamSubPlanName: "House\\sof\\sNyoro~n",
        msgParamSubPlan: "1000",
        roomId: "19571752",
        subscriber: "0",
        systemMsg: "TWW2\\sgifted\\sa\\sTier\\s1\\ssub\\sto\\sMr_Woodchuck!",
        tmiSentTs: "1521159445153",
        turbo: "0",
        userId: "13405587",
        userType: "staff",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#forstycup"
    ),
  ],
  [
    "usernotice extendsub",
    "@badge-info=subscriber/1;badges=staff/1,subscriber/0,premium/1;color=;display-name=olivetan;emotes=;flags=;id=6031612b-bd79-4a89-a1a3-b8f3f8bc7573;login=olivetan;mod=0;msg-id=extendsub;msg-param-sub-benefit-end-month=4;msg-param-sub-plan=1000;msg-param-cumulative-months=16;room-id=434858776;subscriber=1;system-msg=olivetan\\sextended\\stheir\\sTier\\s1\\ssubscription\\sthrough\\sApril!;tmi-sent-ts=1565212333824;user-id=433099049;user-type=staff :tmi.twitch.tv USERNOTICE #pennypicklesthedog",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=subscriber/1;badges=staff/1,subscriber/0,premium/1;color=;display-name=olivetan;emotes=;flags=;id=6031612b-bd79-4a89-a1a3-b8f3f8bc7573;login=olivetan;mod=0;msg-id=extendsub;msg-param-sub-benefit-end-month=4;msg-param-sub-plan=1000;msg-param-cumulative-months=16;room-id=434858776;subscriber=1;system-msg=olivetan\\sextended\\stheir\\sTier\\s1\\ssubscription\\sthrough\\sApril!;tmi-sent-ts=1565212333824;user-id=433099049;user-type=staff :tmi.twitch.tv USERNOTICE #pennypicklesthedog",
      /*command:*/ { kind: "USERNOTICE" },
      /*params:*/ [],
      /*tags:*/ {
        badgeInfo: "subscriber/1",
        badges: "staff/1,subscriber/0,premium/1",
        displayName: "olivetan",
        id: "6031612b-bd79-4a89-a1a3-b8f3f8bc7573",
        login: "olivetan",
        mod: "0",
        msgId: "extendsub",
        msgParamSubBenefitEndMonth: "4",
        msgParamSubPlan: "1000",
        msgParamCumulativeMonths: "16",
        roomId: "434858776",
        subscriber: "1",
        systemMsg: "olivetan\\sextended\\stheir\\sTier\\s1\\ssubscription\\sthrough\\sApril!",
        tmiSentTs: "1565212333824",
        userId: "433099049",
        userType: "staff",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#pennypicklesthedog"
    ),
  ],
  [
    "usernotice resub",
    "@badge-info=;badges=staff/1,broadcaster/1,turbo/1;color=#008000;display-name=ronni;emotes=;id=db25007f-7a18-43eb-9379-80131e44d633;login=ronni;mod=0;msg-id=resub;msg-param-cumulative-months=6;msg-param-streak-months=2;msg-param-should-share-streak=1;msg-param-sub-plan=Prime;msg-param-sub-plan-name=Prime;room-id=1337;subscriber=1;system-msg=ronni\\shas\\ssubscribed\\sfor\\s6\\smonths!;tmi-sent-ts=1507246572675;turbo=1;user-id=1337;user-type=staff :tmi.twitch.tv USERNOTICE #dallas :Great stream -- keep it up!",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=staff/1,broadcaster/1,turbo/1;color=#008000;display-name=ronni;emotes=;id=db25007f-7a18-43eb-9379-80131e44d633;login=ronni;mod=0;msg-id=resub;msg-param-cumulative-months=6;msg-param-streak-months=2;msg-param-should-share-streak=1;msg-param-sub-plan=Prime;msg-param-sub-plan-name=Prime;room-id=1337;subscriber=1;system-msg=ronni\\shas\\ssubscribed\\sfor\\s6\\smonths!;tmi-sent-ts=1507246572675;turbo=1;user-id=1337;user-type=staff :tmi.twitch.tv USERNOTICE #dallas :Great stream -- keep it up!",
      /*command:*/ { kind: "USERNOTICE" },
      /*params:*/ ["Great stream -- keep it up!"],
      /*tags:*/ {
        badges: "staff/1,broadcaster/1,turbo/1",
        color: "#008000",
        displayName: "ronni",
        id: "db25007f-7a18-43eb-9379-80131e44d633",
        login: "ronni",
        mod: "0",
        msgId: "resub",
        msgParamCumulativeMonths: "6",
        msgParamStreakMonths: "2",
        msgParamShouldShareStreak: "1",
        msgParamSubPlan: "Prime",
        msgParamSubPlanName: "Prime",
        roomId: "1337",
        subscriber: "1",
        systemMsg: "ronni\\shas\\ssubscribed\\sfor\\s6\\smonths!",
        tmiSentTs: "1507246572675",
        turbo: "1",
        userId: "1337",
        userType: "staff",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#dallas"
    ),
  ],
  [
    "roomstate",
    "@emote-only=0;followers-only=-1;r9k=0;rituals=0;room-id=40286300;slow=0;subs-only=0 :tmi.twitch.tv ROOMSTATE #randers",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@emote-only=0;followers-only=-1;r9k=0;rituals=0;room-id=40286300;slow=0;subs-only=0 :tmi.twitch.tv ROOMSTATE #randers",
      /*command:*/ { kind: "ROOMSTATE" },
      /*params:*/ [],
      /*tags:*/ {
        emoteOnly: "0",
        followersOnly: "-1",
        r9k: "0",
        rituals: "0",
        roomId: "40286300",
        slow: "0",
        subsOnly: "0",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "bad auth",
    ":tmi.twitch.tv NOTICE * :Improperly formatted auth",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv NOTICE * :Improperly formatted auth",
      /*command:*/ { kind: "NOTICE" },
      /*params:*/ ["*", "Improperly formatted auth"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "notice banned",
    "@msg-id=msg_banned :tmi.twitch.tv NOTICE #forsen :You are permanently banned from talking in forsen.",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@msg-id=msg_banned :tmi.twitch.tv NOTICE #forsen :You are permanently banned from talking in forsen.",
      /*command:*/ { kind: "NOTICE" },
      /*params:*/ ["You are permanently banned from talking in forsen."],
      /*tags:*/ { msgId: "msg_banned" },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#forsen"
    ),
  ],
  [
    "hosttarget host",
    ":tmi.twitch.tv HOSTTARGET #randers :leebaxd 0",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv HOSTTARGET #randers :leebaxd 0",
      /*command:*/ { kind: "HOSTTARGET" },
      /*params:*/ ["leebaxd 0"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "hosttarget unhost",
    ":tmi.twitch.tv HOSTTARGET #randers :-",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":tmi.twitch.tv HOSTTARGET #randers :-",
      /*command:*/ { kind: "HOSTTARGET" },
      /*params:*/ ["-"],
      /*tags:*/ undefined,
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "globaluserstate a",
    "@badge-info=;badges=;color=;display-name=receivertest3;emote-sets=0;user-id=422021310;user-type= :tmi.twitch.tv GLOBALUSERSTATE",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=;color=;display-name=receivertest3;emote-sets=0;user-id=422021310;user-type= :tmi.twitch.tv GLOBALUSERSTATE",
      /*command:*/ { kind: "GLOBALUSERSTATE" },
      /*params:*/ [],
      /*tags:*/ { displayName: "receivertest3", emoteSets: "0", userId: "422021310" },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "globaluserstate b",
    "@badge-info=;badges=bits-charity/1;color=#19E6E6;display-name=RANDERS;emote-sets=0,42,237;user-id=40286300;user-type= :tmi.twitch.tv GLOBALUSERSTATE",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=bits-charity/1;color=#19E6E6;display-name=RANDERS;emote-sets=0,42,237;user-id=40286300;user-type= :tmi.twitch.tv GLOBALUSERSTATE",
      /*command:*/ { kind: "GLOBALUSERSTATE" },
      /*params:*/ [],
      /*tags:*/ {
        badges: "bits-charity/1",
        color: "#19E6E6",
        displayName: "RANDERS",
        emoteSets: "0,42,237",
        userId: "40286300",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "clearmsg",
    "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871 :tmi.twitch.tv CLEARMSG #randers :Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@login=supibot;room-id=;target-msg-id=25fd76d9-4731-4907-978e-a391134ebd67;tmi-sent-ts=-6795364578871 :tmi.twitch.tv CLEARMSG #randers :Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
      /*command:*/ { kind: "CLEARMSG" },
      /*params:*/ [
        "Pong! Uptime: 6h,15m; Temperature: 54.8°C; Latency to TMI: 183ms; Commands used: 795",
      ],
      /*tags:*/ {
        login: "supibot",
        targetMsgId: "25fd76d9-4731-4907-978e-a391134ebd67",
        tmiSentTs: "-6795364578871",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "clearchat",
    "@room-id=40286300;tmi-sent-ts=1563051778390 :tmi.twitch.tv CLEARCHAT #randers",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@room-id=40286300;tmi-sent-ts=1563051778390 :tmi.twitch.tv CLEARCHAT #randers",
      /*command:*/ { kind: "CLEARCHAT" },
      /*params:*/ [],
      /*tags:*/ { roomId: "40286300", tmiSentTs: "1563051778390" },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "clearchat permaban",
    "@room-id=40286300;target-user-id=70948394;tmi-sent-ts=1563051758128 :tmi.twitch.tv CLEARCHAT #randers :weeb123",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@room-id=40286300;target-user-id=70948394;tmi-sent-ts=1563051758128 :tmi.twitch.tv CLEARCHAT #randers :weeb123",
      /*command:*/ { kind: "CLEARCHAT" },
      /*params:*/ ["weeb123"],
      /*tags:*/ { roomId: "40286300", targetUserId: "70948394", tmiSentTs: "1563051758128" },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "clearchat timeout",
    "@ban-duration=600;room-id=40286300;target-user-id=70948394;tmi-sent-ts=1563051113633 :tmi.twitch.tv CLEARCHAT #randers :weeb123",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@ban-duration=600;room-id=40286300;target-user-id=70948394;tmi-sent-ts=1563051113633 :tmi.twitch.tv CLEARCHAT #randers :weeb123",
      /*command:*/ { kind: "CLEARCHAT" },
      /*params:*/ ["weeb123"],
      /*tags:*/ {
        banDuration: "600",
        roomId: "40286300",
        targetUserId: "70948394",
        tmiSentTs: "1563051113633",
      },
      /*prefix:*/ { host: "tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "whisper",
    "@badges=;color=#2E8B57;display-name=pajbot;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :Riftey Kappa",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badges=;color=#2E8B57;display-name=pajbot;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :Riftey Kappa",
      /*command:*/ { kind: "WHISPER" },
      /*params:*/ ["randers", "Riftey Kappa"],
      /*tags:*/ {
        color: "#2E8B57",
        displayName: "pajbot",
        emotes: "25:7-11",
        messageId: "2034",
        threadId: "40286300_82008718",
        turbo: "0",
        userId: "82008718",
      },
      /*prefix:*/ { nick: "pajbot", user: "pajbot", host: "pajbot.tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "whisper with action",
    "@badges=;color=#2E8B57;display-name=pajbot;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :ACTION Riftey Kappa",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badges=;color=#2E8B57;display-name=pajbot;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :ACTION Riftey Kappa",
      /*command:*/ { kind: "WHISPER" },
      /*params:*/ ["randers", "\u0001ACTION Riftey Kappa\u0001"],
      /*tags:*/ {
        color: "#2E8B57",
        displayName: "pajbot",
        emotes: "25:7-11",
        messageId: "2034",
        threadId: "40286300_82008718",
        turbo: "0",
        userId: "82008718",
      },
      /*prefix:*/ { nick: "pajbot", user: "pajbot", host: "pajbot.tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "whisper with emotes",
    "@badges=;color=#2E8B57;display-name=pajbot ;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :Riftey Kappa",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badges=;color=#2E8B57;display-name=pajbot ;emotes=25:7-11;message-id=2034;thread-id=40286300_82008718;turbo=0;user-id=82008718;user-type= :pajbot!pajbot@pajbot.tmi.twitch.tv WHISPER randers :Riftey Kappa",
      /*command:*/ { kind: "WHISPER" },
      /*params:*/ ["randers", "Riftey Kappa"],
      /*tags:*/ {
        color: "#2E8B57",
        displayName: "pajbot ",
        emotes: "25:7-11",
        messageId: "2034",
        threadId: "40286300_82008718",
        turbo: "0",
        userId: "82008718",
      },
      /*prefix:*/ { nick: "pajbot", user: "pajbot", host: "pajbot.tmi.twitch.tv" },
      /*channel:*/ undefined
    ),
  ],
  [
    "privmsg",
    "@badge-info=;badges=;color=#0000FF;display-name=JuN1oRRRR;emotes=;flags=;id=e9d998c3-36f1-430f-89ec-6b887c28af36;mod=0;room-id=11148817;subscriber=0;tmi-sent-ts=1594545155039;turbo=0;user-id=29803735;user-type= :jun1orrrr!jun1orrrr@jun1orrrr.tmi.twitch.tv PRIVMSG #pajlada :dank cam",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=;badges=;color=#0000FF;display-name=JuN1oRRRR;emotes=;flags=;id=e9d998c3-36f1-430f-89ec-6b887c28af36;mod=0;room-id=11148817;subscriber=0;tmi-sent-ts=1594545155039;turbo=0;user-id=29803735;user-type= :jun1orrrr!jun1orrrr@jun1orrrr.tmi.twitch.tv PRIVMSG #pajlada :dank cam",
      /*command:*/ { kind: "PRIVMSG" },
      /*params:*/ ["dank cam"],
      /*tags:*/ {
        color: "#0000FF",
        displayName: "JuN1oRRRR",
        id: "e9d998c3-36f1-430f-89ec-6b887c28af36",
        mod: "0",
        roomId: "11148817",
        subscriber: "0",
        tmiSentTs: "1594545155039",
        turbo: "0",
        userId: "29803735",
      },
      /*prefix:*/ { nick: "jun1orrrr", user: "jun1orrrr", host: "jun1orrrr.tmi.twitch.tv" },
      /*channel:*/ "#pajlada"
    ),
  ],
  [
    "privmsg action",
    "@badge-info=subscriber/5;badges=broadcaster/1,subscriber/0;color=#19E6E6;display-name=randers;emotes=;flags=;id=7eb848c9-1060-4e5e-9f4c-612877982e79;mod=0;room-id=40286300;subscriber=1;tmi-sent-ts=1563096499780;turbo=0;user-id=40286300;user-type= :randers!randers@randers.tmi.twitch.tv PRIVMSG #randers :ACTION test",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@badge-info=subscriber/5;badges=broadcaster/1,subscriber/0;color=#19E6E6;display-name=randers;emotes=;flags=;id=7eb848c9-1060-4e5e-9f4c-612877982e79;mod=0;room-id=40286300;subscriber=1;tmi-sent-ts=1563096499780;turbo=0;user-id=40286300;user-type= :randers!randers@randers.tmi.twitch.tv PRIVMSG #randers :ACTION test",
      /*command:*/ { kind: "PRIVMSG" },
      /*params:*/ ["\u0001ACTION test\u0001"],
      /*tags:*/ {
        badgeInfo: "subscriber/5",
        badges: "broadcaster/1,subscriber/0",
        color: "#19E6E6",
        displayName: "randers",
        id: "7eb848c9-1060-4e5e-9f4c-612877982e79",
        mod: "0",
        roomId: "40286300",
        subscriber: "1",
        tmiSentTs: "1563096499780",
        turbo: "0",
        userId: "40286300",
      },
      /*prefix:*/ { nick: "randers", user: "randers", host: "randers.tmi.twitch.tv" },
      /*channel:*/ "#randers"
    ),
  ],
  [
    "join",
    ":test!test@test.tmi.twitch.tv JOIN #channel",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":test!test@test.tmi.twitch.tv JOIN #channel",
      /*command:*/ { kind: "JOIN" },
      /*params:*/ [],
      /*tags:*/ undefined,
      /*prefix:*/ { nick: "test", user: "test", host: "test.tmi.twitch.tv" },
      /*channel:*/ "#channel"
    ),
  ],
  [
    "part",
    ":test!test@test.tmi.twitch.tv PART #channel",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ ":test!test@test.tmi.twitch.tv PART #channel",
      /*command:*/ { kind: "PART" },
      /*params:*/ [],
      /*tags:*/ undefined,
      /*prefix:*/ { nick: "test", user: "test", host: "test.tmi.twitch.tv" },
      /*channel:*/ "#channel"
    ),
  ],
  [
    "tag value with space",
    "@a= b;c=d ;f=g :test!test@test.tmi.twitch.tv PRIVMSG #test :test",
    // @ts-ignore: using private constructor in test,
    new Message(
      /*raw:*/ "@a= b;c=d ;f=g :test!test@test.tmi.twitch.tv PRIVMSG #test :test",
      /*command:*/ { kind: "PRIVMSG" },
      /*params:*/ ["test"],
      /*tags:*/ {
        a: " b",
        c: "d ",
        f: "g",
      },
      /*prefix:*/ { nick: "test", user: "test", host: "test.tmi.twitch.tv" },
      /*channel:*/ "#test"
    ),
  ],
];

for (const [name, input, expected] of cases) {
  Deno.test(`Message.parse ${name}`, () => {
    testing.assertEquals(Message.parse(input), expected);
  });
}
