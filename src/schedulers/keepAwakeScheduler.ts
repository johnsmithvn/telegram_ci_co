import cron, { ScheduledTask } from "node-cron";
import { logger } from "../logger";

export function startKeepAwakeScheduler(keepAwakeUrl: string, timezoneName: string): ScheduledTask {
  return cron.schedule(
    "*/10 * * * *",
    async () => {
      try {
        const response = await fetch(keepAwakeUrl, {
          method: "GET",
          signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
          logger.warn(
            {
              keepAwakeUrl,
              status: response.status
            },
            "Keep-awake ping returned non-200 status"
          );
        }
      } catch (error) {
        logger.warn({ error, keepAwakeUrl }, "Keep-awake ping failed");
      }
    },
    { timezone: timezoneName }
  );
}

