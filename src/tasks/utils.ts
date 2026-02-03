import * as Sentry from "@sentry/nextjs";
import type { PayloadRequest } from "payload/types";

export type RunContext = {
  workflowSlug?: string;
  workflowRunId?: string;
};

type TaskInput = {
  runContext?: RunContext;
  documentIds?: string[];
  [key: string]: unknown;
};

export type TaskHandlerArgs = {
  req: PayloadRequest;
  input?: TaskInput;
};

export const getRunContext = (input?: TaskInput): RunContext => {
  if (!input || typeof input !== "object") {
    return {};
  }

  const runContext = input.runContext ?? {};
  return {
    workflowSlug: runContext.workflowSlug,
    workflowRunId: runContext.workflowRunId,
  };
};

export const getTaskLogger = (
  req: PayloadRequest,
  taskSlug: string,
  input?: TaskInput
) => {
  const baseLogger = req?.payload?.logger;
  const runContext = getRunContext(input);
  const fields = {
    task: taskSlug,
    ...runContext,
  };

  if (baseLogger && typeof (baseLogger as any).child === "function") {
    return (baseLogger as any).child(fields);
  }

  return baseLogger;
};

export const withTaskTracing = <T extends TaskHandlerArgs>(
  taskSlug: string,
  handler: (args: T) => Promise<{ output: Record<string, unknown> }>
) => {
  return async (args: T) => {
    const { req, input } = args;
    const logger = getTaskLogger(req, taskSlug, input);
    const runContext = getRunContext(input);
    const startedAt = Date.now();

    if (runContext.workflowSlug) {
      Sentry.setTag("workflow", runContext.workflowSlug);
    }
    if (runContext.workflowRunId) {
      Sentry.setTag("workflowRunId", runContext.workflowRunId);
    }
    Sentry.setTag("task", taskSlug);

    logger?.info?.({
      message: "task.start",
      task: taskSlug,
    });

    try {
      return await Sentry.startSpan(
        {
          op: "payload.task",
          name: taskSlug,
          attributes: {
            task: taskSlug,
            workflow: runContext.workflowSlug,
            workflowRunId: runContext.workflowRunId,
          },
        },
        async () => {
          const result = await handler(args);
          logger?.info?.({
            message: "task.complete",
            task: taskSlug,
            durationMs: Date.now() - startedAt,
          });
          return result;
        }
      );
    } catch (error) {
      logger?.error?.({
        message: "task.error",
        task: taskSlug,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      throw error;
    }
  };
};
