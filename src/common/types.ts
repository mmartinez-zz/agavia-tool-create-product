export interface ToolContext {
  businessId: string;
  userPhone?: string;
  agentType?: string;
  keywords?: string[];
}

export interface ExecuteRequest {
  tool: string;
  args: Record<string, any>;
  context: ToolContext;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export type ToolHandler = (
  context: ToolContext,
  args: Record<string, any>
) => Promise<ToolResult>;
