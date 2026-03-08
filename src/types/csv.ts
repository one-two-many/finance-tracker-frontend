/**
 * Types for CSV import functionality.
 */

export interface Parser {
  name: string
  display_name: string
  parser_type: string
  required_headers: string[]
}

export interface ParserDetectionResult {
  name: string
  confidence: number
}

export interface ParserDetectionResponse {
  detected: string | null
  confidence: number
  alternatives: ParserDetectionResult[]
}

export interface PreviewTransaction {
  date: string
  description: string
  amount: number
  original_amount: number  // Signed amount as it appears in CSV
  type: 'income' | 'expense' | 'transfer' | 'refund'
  suggested_category?: string
  is_duplicate: boolean
  is_transfer_candidate: boolean
  transfer_target_account?: string  // Name of target account for transfers
  transfer_target_account_id?: number  // ID of target account for transfers
  notes?: string
}

export interface TransferCandidate {
  description: string
  amount: number
  date: string
  target_account?: string
  confidence?: number
}

export interface ImportPreviewResponse {
  parser_used: string
  parser_display_name: string
  confidence: number
  alternatives: ParserDetectionResult[]
  total_transactions: number
  duplicate_count: number
  transfer_candidate_count: number
  transactions: PreviewTransaction[]
  transfer_candidates: TransferCandidate[]
  error?: string
}

export interface ImportConfirmRequest {
  file_content: string
  account_id: number
  parser_name: string
  category_mappings?: Record<string, number | null>
  type_overrides?: Record<string, string>
  skip_duplicates?: boolean
  filename?: string
}

export interface ImportConfirmResponse {
  total_rows: number
  created: number
  skipped: number
  errors: number
  categories_created: string[]
}

export interface CategoryMapping {
  description: string
  categoryId: number | null
  categoryName?: string
}
