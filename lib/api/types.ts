export type ApiValidationError = {
  path: string;
  message: string;
};

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  timestamp: string;
  data?: T;
  error?: ApiValidationError[];
}

