import { buildMainKeyboard } from "../bot/keyboard";
import { BotContext } from "../bot/context";
import { checkIn } from "../services/sessionService";
import { buildAlreadyCheckedInMessage, buildCheckInSuccessMessage } from "../services/reportService";

export async function handleCheckIn(ctx: BotContext, timezoneName: string): Promise<void> {
  const user = ctx.state.trackedUser;
  if (!user) {
    return;
  }

  const now = new Date();
  const result = await checkIn(user.id, now, timezoneName);

  const message = result.alreadyWorking
    ? buildAlreadyCheckedInMessage(result.session.startTime, timezoneName)
    : buildCheckInSuccessMessage(result.session.startTime, timezoneName);

  await ctx.reply(message, {
    ...buildMainKeyboard()
  });
}

