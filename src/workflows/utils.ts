import * as Sentry from "@sentry/nextjs";
import type { WorkflowConfig } from "payload";
import { randomUUID } from "node:crypto";

type WorkflowHandlerFn = NonNullable<WorkflowConfig["handler"]>;
type WorkflowHandlerArgs = unknown;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const buildSentryExtra = (args: WorkflowHandlerArgs): Record<string, unknown> => {
  if (!isObject(args)) {
    return {};
  }

  const { input, queue, run } = args as {
    input?: unknown;
    queue?: string;
    run?: {
      id?: string;
      status?: string;
    };
  };

  const extra: Record<string, unknown> = {};

  if (typeof input !== "undefined") {
    extra.input = input;
  }

  if (typeof queue !== "undefined") {
    extra.queue = queue;
  }

  if (run) {
    const { id, status } = run;
    extra.run = {
      id,
      status,
    };
  }

  return extra;
};

const getRunId = (args: WorkflowHandlerArgs): string => {
  if (isObject(args) && isObject(args.run)) {
    const runId = args.run.id;
    if (typeof runId === "string" && runId.length > 0) {
      return runId;
    }
  }
  return randomUUID();
};

const getTasks = (
  args: WorkflowHandlerArgs
): Record<string, unknown> | undefined => {
  if (!isObject(args)) {
    return undefined;
  }
  const tasks = args.tasks;
  return isObject(tasks) ? tasks : undefined;
};

const getWorkflowLogContext = (
  slug: string,
  runId: string,
  args: WorkflowHandlerArgs
) => ({
  log_source: "payload.workflow",
  workflow: slug,
  workflowRunId: runId,
  ...buildSentryExtra(args),
});

const withWorkflowContext = (
  slug: string,
  handler: WorkflowHandlerFn
): WorkflowHandlerFn => {
  return async (args) => {
    if (typeof handler !== "function") {
      return handler as any;
    }
    const runId = getRunId(args);
    const tasks = getTasks(args);
    const logContext = getWorkflowLogContext(slug, runId, args);

    const tasksWithContext =
      tasks && typeof tasks === "object"
        ? new Proxy(tasks, {
            get(target, prop) {
              const original = target[prop as keyof typeof target];
              if (typeof original !== "function") {
                return original;
              }
              return (id: string, options: { input?: unknown } = {}) => {
                const input =
                  options?.input && typeof options.input === "object"
                    ? options.input
                    : {};
                const runContext = {
                  workflowSlug: slug,
                  workflowRunId: runId,
                };
                return (
                  original as (id: string, options?: { input?: unknown }) => unknown
                )(
                  id,
                  {
                    ...options,
                    input: { ...input, runContext },
                  }
                );
              };
            },
          })
        : tasks;

    return Sentry.startSpan(
      {
        op: "payload.workflow",
        name: slug,
        attributes: {
          workflow: slug,
          workflowRunId: runId,
        },
      },
      async () => {
        Sentry.logger.info("workflow.start", logContext);

        const result = await handler({
          ...(isObject(args) ? args : {}),
          tasks: tasksWithContext,
        } as any);

        Sentry.logger.info("workflow.complete", logContext);

        return result;
      }
    );
  };
};

const withWorkflowErrorCapture = (
  slug: string,
  handler: WorkflowHandlerFn
): WorkflowHandlerFn => {
  if (typeof handler !== "function") {
    return handler;
  }

  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      const runId = getRunId(args);
      const logContext = getWorkflowLogContext(slug, runId, args);

      Sentry.logger.error("workflow.error", {
        ...logContext,
        error: error instanceof Error ? error.message : String(error ?? ""),
      });
      Sentry.captureException(error, {
        tags: {
          workflow: slug,
          workflowRunId: runId,
        },
        extra: logContext,
      });
      throw error;
    }
  };
};

export const defineWorkflow = (config: WorkflowConfig): WorkflowConfig => {
  if (!config.handler || typeof config.handler !== "function") {
    return config;
  }

  const wrappedHandler = withWorkflowErrorCapture(
    config.slug,
    withWorkflowContext(config.slug, config.handler as WorkflowHandlerFn)
  );

  return {
    ...config,
    handler: wrappedHandler,
  };
};
