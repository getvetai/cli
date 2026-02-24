export type BadgeType = 'certified' | 'reviewed' | 'unverified' | 'flagged'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type SkillType = 'skill' | 'mcp'
export type Transport = 'stdio' | 'http' | 'sse'

export interface Permission {
  type: string
  target?: string
  risk: RiskLevel
  detected_by?: string
  evidence?: string[]
}

export interface SecurityIssue {
  severity: RiskLevel | 'info' | 'warning'
  message: string
  count?: number
  evidence?: string[]
}

export interface CodeQuality {
  hasTests: boolean
  hasDocs: boolean
  hasLicense?: boolean
  hasPermissionDeclaration?: boolean
  linesOfCode: number
  dependencyCount?: number
}

export interface McpTool {
  name: string
  description?: string
  inputSchema?: McpToolParam[]
  permissions?: Permission[]
}

export interface McpToolParam {
  name: string
  type: string
  description: string
}

export interface AnalysisResult {
  name: string
  description?: string
  type?: SkillType
  transport?: Transport
  runtime?: string
  tools?: McpTool[]
  permissions: Permission[]
  issues: SecurityIssue[]
  trustScore: number
  badge: BadgeType
  codeQuality: CodeQuality
  riskFactors: string[]
  overview?: string
  envVars?: string[]
}
