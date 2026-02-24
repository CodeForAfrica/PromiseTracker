import * as Sentry from "@sentry/nextjs";
import type { TaskConfig, PayloadRequest } from "payload";

export type RunContext = {
  workflowSlug?: string;
  workflowRunId?: string;
};

export type TaskInput = {
  runContext?: RunContext;
  documentIds?: string[];
  forceReextract?: boolean;
  [key: string]: unknown;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getInput = (args: unknown): TaskInput | undefined => {
  if (!isObject(args)) {
    return undefined;
  }
  const input = (args as { input?: unknown }).input;
  return isObject(input) ? (input as TaskInput) : undefined;
};

export const getRunContext = (input?: unknown): RunContext => {
  if (!isObject(input)) {
    return {};
  }

  const runContext = (input as TaskInput).runContext ?? {};
  return {
    workflowSlug: runContext.workflowSlug,
    workflowRunId: runContext.workflowRunId,
  };
};

const parseLogArgs = (
  args: unknown[],
  fallbackMessage: string,
): { message: string; extra: Record<string, unknown> } => {
  let message = fallbackMessage;
  let extra: Record<string, unknown> = {};

  if (args.length === 0) {
    return { message, extra };
  }

  const first = args[0];

  if (typeof first === "string") {
    message = first;
    if (isObject(args[1])) {
      extra = args[1] as Record<string, unknown>;
    }
  } else if (first instanceof Error) {
    message = first.message || fallbackMessage;
    extra = {
      error: {
        name: first.name,
        message: first.message,
        stack: first.stack,
      },
    };
  } else if (isObject(first)) {
    extra = first as Record<string, unknown>;
    if (typeof extra.message === "string" && extra.message.trim()) {
      message = extra.message;
    } else if (typeof extra.msg === "string" && extra.msg.trim()) {
      message = extra.msg;
    }
  }

  return { message, extra };
};

const createTaskLogger = (
  payloadLogger: PayloadRequest["payload"]["logger"],
  taskSlug: string,
  runContext: RunContext,
) => {
  const context = {
    log_source: "payload.task",
    task: taskSlug,
    workflow: runContext.workflowSlug,
    workflowRunId: runContext.workflowRunId,
  };

  const log =
    (level: "info" | "warn" | "error" | "debug") =>
    (...args: unknown[]) => {
      (payloadLogger[level] as (...logArgs: unknown[]) => void)(...args);
      const { message, extra } = parseLogArgs(args, `${taskSlug}.${level}`);
      Sentry.logger[level](message, {
        ...context,
        ...extra,
      });
      Sentry.captureMessage(message, {
        level: level as Sentry.SeverityLevel,
        ...context,
        ...extra,
      });
    };

  return {
    info: log("info"),
    warn: log("warn"),
    error: log("error"),
    debug: log("debug"),
  };
};

export const getTaskLogger = (
  req: PayloadRequest,
  taskSlug: string,
  input?: unknown,
) => {
  const runContext = getRunContext(input);
  const payloadLogger =
    typeof req.payload.logger.child === "function"
      ? req.payload.logger.child({ task: taskSlug, ...runContext })
      : req.payload.logger;

  return createTaskLogger(payloadLogger, taskSlug, runContext);
};

export const withTaskTracing = (
  taskSlug: string,
  handler: NonNullable<TaskConfig["handler"]>,
): NonNullable<TaskConfig["handler"]> => {
  if (typeof handler !== "function") {
    return handler;
  }

  return async (args) => {
    const req = (args as { req: PayloadRequest }).req;
    const input = getInput(args);
    const logger = getTaskLogger(req, taskSlug, input);
    const runContext = getRunContext(input);
    const startedAt = Date.now();

    logger.info({
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
          logger.info({
            message: "task.complete",
            task: taskSlug,
            durationMs: Date.now() - startedAt,
          });
          return result;
        },
      );
    } catch (error) {
      logger.error({
        message: "task.error",
        task: taskSlug,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      Sentry.captureException(error, {
        tags: {
          task: taskSlug,
          workflow: runContext.workflowSlug,
          workflowRunId: runContext.workflowRunId,
        },
        extra: {
          input,
          runContext,
        },
      });
      throw error;
    }
  };
};
