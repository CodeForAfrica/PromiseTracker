import * as Sentry from "@sentry/nextjs";
import type { TaskConfig, PayloadRequest } from "payload";

export type RunContext = {
  workflowSlug?: string;
  workflowRunId?: string;
};

export type TaskInput = {
  runContext?: RunContext;
  documentIds?: string[];
  [key: string]: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTaskInput = (value: unknown): value is TaskInput => isObject(value);

const getReq = (args: unknown): PayloadRequest | undefined => {
  if (!isObject(args)) {
    return undefined;
  }
  const req = args.req;
  return req as PayloadRequest | undefined;
};

const getInput = (args: unknown): TaskInput | undefined => {
  if (!isObject(args)) {
    return undefined;
  }
  const input = (args as { input?: unknown }).input;
  return isTaskInput(input) ? input : undefined;
};

export const getRunContext = (input?: unknown): RunContext => {
  if (!isTaskInput(input)) {
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
  input?: unknown
) => {
  const baseLogger = req?.payload?.logger;
  const runContext = getRunContext(input);
  const fields = {
    task: taskSlug,
    ...runContext,
  };

  if (baseLogger && "child" in baseLogger && typeof baseLogger.child === "function") {
    return baseLogger.child(fields);
  }

  return baseLogger;
};

export const withTaskTracing = (
  taskSlug: string,
  handler: NonNullable<TaskConfig["handler"]>
): NonNullable<TaskConfig["handler"]> => {
  if (typeof handler !== "function") {
    return handler;
  }

  return async (args) => {
    const req = getReq(args);
    const input = getInput(args);
    const logger = req ? getTaskLogger(req, taskSlug, input) : undefined;
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
