import { DEFAULT_COMPANY_MATERIAL_CONFIG, type CompanyMaterialConfig } from '../domain/companyMaterialConfig';
import type { CompanySetupDepartment, CompanySetupApprovalThresholds } from '../domain/companySetup';
import { cloudRequest, CLOUD_API_BASE } from './cloud';

const LOCAL_CONFIG_KEY = 'procureflow_company_material_config_v1';
const LOCAL_SETUP_KEY = 'procureflow_company_setup_v1';

export interface ActiveCompanySetup {
  setupId: string;
  annualBudget: number;
  setupConfig?: ApplyCompanySetupRequest;
  updatedAt: string;
}

export interface ApplyCompanySetupRequest {
  setupId: string;
  industry: CompanyMaterialConfig['industry'];
  companyName: string;
  priorities: CompanyMaterialConfig['priorities'];
  departments: CompanySetupDepartment[];
  annualBudgetPHP: number;
  approvals: CompanySetupApprovalThresholds;
}

function parseConfig(value: unknown): CompanyMaterialConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The saved company material configuration is invalid.');
  }
  const candidate = value as Partial<CompanyMaterialConfig>;
  if (typeof candidate.companyName !== 'string' ||
      !['electronics', 'bakery', 'cellphone', 'construction', 'garment', 'restaurant', 'custom'].includes(String(candidate.industry)) ||
      !Array.isArray(candidate.priorities) ||
      candidate.priorities.length !== 3 ||
      candidate.priorities.some((priority, index) =>
        priority.code !== ['A', 'B', 'C'][index] ||
        typeof priority.name !== 'string' ||
        typeof priority.description !== 'string') ||
      (candidate.activeSetupId !== undefined &&
        candidate.activeSetupId !== null &&
        typeof candidate.activeSetupId !== 'string')) {
    throw new Error('The saved company material configuration is incomplete or invalid.');
  }
  return candidate as CompanyMaterialConfig;
}

export const companyMaterialConfigAPI = {
  async get(): Promise<CompanyMaterialConfig> {
    if (CLOUD_API_BASE) {
      const response = await cloudRequest('/operations/material-configuration') as { config: CompanyMaterialConfig | null };
      return response.config ? parseConfig(response.config) : DEFAULT_COMPANY_MATERIAL_CONFIG;
    }
    const stored = localStorage.getItem(LOCAL_CONFIG_KEY);
    return stored ? parseConfig(JSON.parse(stored)) : DEFAULT_COMPANY_MATERIAL_CONFIG;
  },
  async save(config: CompanyMaterialConfig): Promise<void> {
    if (CLOUD_API_BASE) {
      await cloudRequest('/operations/material-configuration', {
        method: 'PUT',
        body: JSON.stringify({ config })
      });
      return;
    }
    localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(config));
  },
  async activeSetup(): Promise<ActiveCompanySetup | null> {
    if (CLOUD_API_BASE) {
      const response = await cloudRequest('/operations/company-setup') as { activeSetup: ActiveCompanySetup | null };
      return response.activeSetup;
    }
    const stored = localStorage.getItem(LOCAL_SETUP_KEY);
    return stored ? JSON.parse(stored) as ActiveCompanySetup : null;
  },
  async applySetup(setup: ApplyCompanySetupRequest): Promise<{ activeSetup: ActiveCompanySetup; untouchedBudgets: string[] }> {
    if (CLOUD_API_BASE) {
      return await cloudRequest('/operations/company-setup', {
        method: 'PUT',
        body: JSON.stringify({ setup })
      }) as { activeSetup: ActiveCompanySetup; untouchedBudgets: string[] };
    }
    throw new Error('Connect to the Cloudflare company workspace to apply departments, budgets, and approval rules.');
  }
};
