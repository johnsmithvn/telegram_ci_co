import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import { buildHelpMessage } from "../services/reportService";

export async function handleStart(ctx: BotContext): Promise<void> {
  await ctx.reply(buildHelpMessage(), { ...buildMainKeyboard() });
}

