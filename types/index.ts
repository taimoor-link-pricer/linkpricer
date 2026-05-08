export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  message?: string;
}

export interface OnboardingFormData {
  userType: string;
  otherRole: string;
  monthlySpend: string;
  challenges: string;
  importanceFactors: string[];
  acquisitionMethods: string[];
}
