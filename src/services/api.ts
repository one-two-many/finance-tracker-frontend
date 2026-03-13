import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Types
export interface Account {
  id: number;
  name: string;
  account_type: string;
  currency: string;
  current_balance: number | string; // Can be string from API (Decimal serialized as string)
  default_parser?: string;
  bank_name?: string;
  account_number_last4?: string;
  created_at: string;
}

export interface AccountCreate {
  name: string;
  account_type: string;
  currency?: string;
  initial_balance?: number;
  default_parser?: string;
  bank_name?: string;
  account_number_last4?: string;
}

export interface AccountUpdate {
  name?: string;
  account_type?: string;
  default_parser?: string;
  bank_name?: string;
  account_number_last4?: string;
}

export interface TransactionImportResult {
  row_number: number;
  status: string;
  message?: string;
}

export interface ImportResult {
  total_rows: number;
  created: number;
  skipped: number;
  errors: number;
  categories_created: string[];
  results: TransactionImportResult[];
}

export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  is_global: boolean;
  user_id: number;
}

// Import new types
import type {
  Parser,
  ParserDetectionResponse,
  ImportPreviewResponse,
  ImportConfirmRequest,
  ImportConfirmResponse,
} from "../types/csv";

// Re-export Parser type for other components
export type { Parser } from "../types/csv";

// Account API
export const getAccounts = async (): Promise<Account[]> => {
  const response = await api.get("/api/v1/accounts");
  return response.data;
};

export const createAccount = async (data: AccountCreate): Promise<Account> => {
  const response = await api.post("/api/v1/accounts", data);
  return response.data;
};

export const updateAccount = async (
  accountId: number,
  data: AccountUpdate,
): Promise<Account> => {
  const response = await api.patch(`/api/v1/accounts/${accountId}`, data);
  return response.data;
};

export const deleteAccount = async (accountId: number): Promise<void> => {
  await api.delete(`/api/v1/accounts/${accountId}`);
};

// Transaction CSV Import API
export const uploadCSV = async (
  file: File,
  accountId: number,
  skipDuplicates: boolean = true,
): Promise<ImportResult> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("account_id", accountId.toString());
  formData.append("skip_duplicates", skipDuplicates.toString());

  const response = await api.post("/api/v1/transactions/import-csv", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// Parser API
export const listParsers = async (): Promise<Parser[]> => {
  const response = await api.get("/api/v1/parsers");
  return response.data;
};

export const detectParser = async (
  file: File,
): Promise<ParserDetectionResponse> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/api/v1/parsers/detect", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const previewCSVImport = async (
  file: File,
  accountId: number,
  parserName?: string,
): Promise<ImportPreviewResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("account_id", accountId.toString());
  if (parserName) {
    formData.append("parser_name", parserName);
  }

  const response = await api.post(
    "/api/v1/transactions/import-csv/preview",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
};

export const confirmCSVImport = async (
  request: ImportConfirmRequest,
): Promise<ImportConfirmResponse> => {
  const response = await api.post(
    "/api/v1/transactions/import-csv/confirm",
    request,
  );
  return response.data;
};

// Category API
export interface CategoryCreate {
  name: string;
  color?: string;
  icon?: string;
  is_global?: boolean;
}

export interface CategoryUpdate {
  name?: string;
  color?: string;
  icon?: string;
}

export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get("/api/v1/categories");
  return response.data;
};

export const createCategory = async (
  data: CategoryCreate,
): Promise<Category> => {
  const response = await api.post("/api/v1/categories", data);
  return response.data;
};

export const updateCategory = async (
  categoryId: number,
  data: CategoryUpdate,
): Promise<Category> => {
  const response = await api.patch(`/api/v1/categories/${categoryId}`, data);
  return response.data;
};

export const deleteCategory = async (categoryId: number): Promise<void> => {
  await api.delete(`/api/v1/categories/${categoryId}`);
};

// Analytics API
export interface SankeyNode {
  name: string;
  type: "income" | "cashflow" | "expense" | "surplus";
  color?: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeySummary {
  total_income: number;
  total_expenses: number;
  net_savings: number;
  period: {
    start_date: string;
    end_date: string;
  };
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  summary: SankeySummary;
}

export const getSankeyData = async (
  startDate?: string,
  endDate?: string,
  includeTransfers: boolean = false,
): Promise<SankeyData> => {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  params.append("include_transfers", includeTransfers.toString());

  const response = await api.get(
    `/api/v1/analytics/sankey?${params.toString()}`,
  );
  return response.data;
};

export interface DashboardTransaction {
  id: number;
  account_name: string;
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  transaction_date: string;
  category_name: string | null;
  category_color: string | null;
}

export interface DashboardSummary {
  total_balance: number;
  month_income: number;
  month_expenses: number;
  recent_transactions: DashboardTransaction[];
  period: {
    month_start: string;
    month_end: string;
  };
}

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response = await api.get("/api/v1/analytics/dashboard");
  return response.data;
};

// Import History API
export interface ImportSession {
  id: number;
  account_id: number;
  account_name: string;
  filename: string | null;
  parser_type: string;
  status: string;
  total_rows: number;
  created_count: number;
  skipped_count: number;
  error_count: number;
  created_at: string;
}

export interface ImportSessionTransaction {
  id: number;
  account_id: number;
  account_name: string;
  transaction_type: string;
  amount: number;
  description: string;
  transaction_date: string;
  category_id: number | null;
  created_at: string;
}

export interface ImportSessionDetail {
  session: {
    id: number;
    filename: string | null;
    parser_type: string;
    status: string;
    created_at: string;
  };
  transactions: ImportSessionTransaction[];
}

export const getImportSessions = async (): Promise<ImportSession[]> => {
  const response = await api.get("/api/v1/transactions/import-sessions");
  return response.data;
};

export const getImportSessionTransactions = async (
  sessionId: number,
): Promise<ImportSessionDetail> => {
  const response = await api.get(
    `/api/v1/transactions/import-sessions/${sessionId}/transactions`,
  );
  return response.data;
};

// Category Rules API
export interface CategoryRule {
  id: number;
  category_id: number;
  category_name: string;
  pattern: string;
  pattern_type: "keyword" | "exact" | "regex";
  priority: number;
  is_active: boolean;
}

export interface CategoryRuleCreate {
  category_id: number;
  pattern: string;
  pattern_type: "keyword" | "exact" | "regex";
  priority: number;
}

export interface CategoryRuleUpdate {
  pattern?: string;
  pattern_type?: "keyword" | "exact" | "regex";
  priority?: number;
  is_active?: boolean;
}

export const getCategoryRules = async (): Promise<CategoryRule[]> => {
  const response = await api.get("/api/v1/categories/rules");
  return response.data;
};

export const createCategoryRule = async (
  data: CategoryRuleCreate,
): Promise<CategoryRule> => {
  const response = await api.post("/api/v1/categories/rules", data);
  return response.data;
};

export const updateCategoryRule = async (
  ruleId: number,
  data: CategoryRuleUpdate,
): Promise<CategoryRule> => {
  const response = await api.patch(`/api/v1/categories/rules/${ruleId}`, data);
  return response.data;
};

export const deleteCategoryRule = async (ruleId: number): Promise<void> => {
  await api.delete(`/api/v1/categories/rules/${ruleId}`);
};

// Transaction API
export interface Transaction {
  id: number;
  account_id: number;
  account_name: string;
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
  transaction_type: "income" | "expense" | "transfer";
  amount: number;
  description: string;
  notes: string | null;
  transaction_date: string;
  created_at: string | null;
  splitwise_split: boolean;
}

export interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  account_id?: number;
  category_id?: number;
  transaction_type?: "income" | "expense" | "transfer";
}

export const getTransactions = async (
  filters?: TransactionFilters,
): Promise<Transaction[]> => {
  const params = new URLSearchParams();
  if (filters?.start_date) params.append("start_date", filters.start_date);
  if (filters?.end_date) params.append("end_date", filters.end_date);
  if (filters?.account_id)
    params.append("account_id", filters.account_id.toString());
  if (filters?.category_id)
    params.append("category_id", filters.category_id.toString());
  if (filters?.transaction_type)
    params.append("transaction_type", filters.transaction_type);

  const response = await api.get(`/api/v1/transactions?${params.toString()}`);
  return response.data;
};

export const deleteTransaction = async (
  transactionId: number,
): Promise<void> => {
  await api.delete(`/api/v1/transactions/${transactionId}`);
};

export const updateTransactionCategory = async (
  transactionId: number,
  categoryId: number | null,
): Promise<{
  category_id: number | null;
  category_name: string | null;
  category_color: string | null;
}> => {
  const response = await api.patch(`/api/v1/transactions/${transactionId}`, {
    category_id: categoryId,
  });
  return response.data;
};

// Splitwise Integration API

export interface SplitwiseCredentials {
  api_key: string;
}

export interface SplitwiseCredentialsStatus {
  is_active: boolean;
  last_verified_at: string | null;
  user_info: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export interface SplitwiseFriend {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string;
  balance: Array<{ currency_code: string; amount: number }>;
}

export interface SplitwiseGroupMember {
  id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
}

export interface SplitwiseGroup {
  id: number;
  name: string;
  members: SplitwiseGroupMember[];
}

export interface SplitwiseExpenseCreate {
  transaction_ids: number[];
  split_type: "equal" | "exact" | "percent";
  participants: Array<{
    user_id: number;
    owed_share: number;
    paid_share?: number;
  }>;
  group_id?: number;
}

export interface SplitwiseExpenseResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    transaction_id: number;
    status: "success" | "error";
    splitwise_id?: number;
    url?: string;
    error?: string;
  }>;
}

export const getSplitwiseCredentials =
  async (): Promise<SplitwiseCredentialsStatus> => {
    const response = await api.get("/api/v1/settings/splitwise/credentials");
    return response.data;
  };

export const updateSplitwiseCredentials = async (
  credentials: SplitwiseCredentials,
): Promise<SplitwiseCredentialsStatus> => {
  const response = await api.post(
    "/api/v1/settings/splitwise/credentials",
    credentials,
  );
  return response.data;
};

export const deleteSplitwiseCredentials = async (): Promise<void> => {
  await api.delete("/api/v1/settings/splitwise/credentials");
};

export const getSplitwiseFriends = async (): Promise<SplitwiseFriend[]> => {
  const response = await api.get("/api/v1/settings/splitwise/friends");
  return response.data;
};

export const getSplitwiseGroups = async (): Promise<SplitwiseGroup[]> => {
  const response = await api.get("/api/v1/settings/splitwise/groups");
  return response.data;
};

export const createSplitwiseExpenses = async (
  request: SplitwiseExpenseCreate,
): Promise<SplitwiseExpenseResult> => {
  const response = await api.post(
    "/api/v1/settings/splitwise/expenses",
    request,
  );
  return response.data;
};
