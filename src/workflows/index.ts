import { WorkflowConfig } from "payload";
import { airtableWorkflow } from "./airtableWorkflow";
import { meedanWorkflow } from "./meedanWorkflow";

export const workflows: WorkflowConfig[] = [airtableWorkflow, meedanWorkflow];
