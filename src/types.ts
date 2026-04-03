export interface ExecuteRequest {
  tool: string;
  businessId: string;
  args: Record<string, any>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export type ToolHandler = (
  businessId: string,
  args: Record<string, any>
) => Promise<ToolResult>;
