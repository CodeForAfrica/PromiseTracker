import * as Sentry from "@sentry/nextjs";
import type { WorkflowConfig } from "payload";

type WorkflowHandlerFn = Extract<
  NonNullable<WorkflowConfig["handler"]>,
  (...args: any[]) => any
>;
type WorkflowHandlerArgs = Parameters<WorkflowHandlerFn>[0];

const buildSentryExtra = (args: WorkflowHandlerArgs): Record<string, unknown> => {
  if (!args || typeof args !== "object") {
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

const withWorkflowErrorCapture = (
  slug: string,
  handler: WorkflowHandlerFn
): WorkflowHandlerFn => {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          workflow: slug,
        },
        extra: buildSentryExtra(args),
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
    config.handler as WorkflowHandlerFn
  );

  return {
    ...config,
    handler: wrappedHandler,
  };
};
