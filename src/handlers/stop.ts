import { Markup } from "telegraf";
import { BotContext } from "../bot/context";
import {
  buildAlreadyStoppedMessage,
  buildStopConfirmMessage,
  buildStopSuccessMessage
} from "../services/reportService";
import { stopAndPurgeUserData } from "../services/sessionService";

export async function handleStopCommand(ctx: BotContext, text: string): Promise<void> {
  if (ctx.state.inactiveUser || !ctx.state.trackedUser) {
    await ctx.reply(buildAlreadyStoppedMessage());
    return;
  }

  const confirmToken = text.trim().split(/\s+/)[1];
  if (!confirmToken || confirmToken.toUpperCase() !== "CONFIRM") {
    await ctx.reply(buildStopConfirmMessage());
    return;
  }

  const result = await stopAndPurgeUserData(ctx.state.trackedUser.id);
  await ctx.reply(buildStopSuccessMessage(result.deletedSessions), Markup.removeKeyboard());
}

