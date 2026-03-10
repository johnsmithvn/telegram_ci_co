import { Markup } from "telegraf";
import { BotContext } from "../bot/context";
import { buildMainKeyboard, buildStopConfirmInlineKeyboard } from "../bot/keyboard";
import {
  buildAlreadyStoppedMessage,
  buildStopCancelledMessage,
  buildStopConfirmMessage,
  buildStopSuccessMessage
} from "../services/reportService";
import { stopAndPurgeUserData } from "../services/sessionService";

async function clearInlineButtons(ctx: BotContext): Promise<void> {
  try {
    await ctx.editMessageReplyMarkup(undefined);
  } catch {
    // Ignore when message cannot be edited (already edited/expired).
  }
}

export async function handleStopCommand(ctx: BotContext): Promise<void> {
  if (ctx.state.inactiveUser || !ctx.state.trackedUser) {
    await ctx.reply(buildAlreadyStoppedMessage(), { ...buildMainKeyboard() });
    return;
  }

  await ctx.reply(buildStopConfirmMessage(), buildStopConfirmInlineKeyboard());
}

export async function handleStopConfirmYes(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  await clearInlineButtons(ctx);

  if (ctx.state.inactiveUser || !ctx.state.trackedUser) {
    await ctx.reply(buildAlreadyStoppedMessage(), { ...buildMainKeyboard() });
    return;
  }

  const result = await stopAndPurgeUserData(ctx.state.trackedUser.id);
  await ctx.reply(buildStopSuccessMessage(result.deletedSessions), Markup.removeKeyboard());
}

export async function handleStopConfirmNo(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();
  await clearInlineButtons(ctx);
  await ctx.reply(buildStopCancelledMessage(), { ...buildMainKeyboard() });
}
