import { useEffect, useState } from 'react';
import { DEFAULT_COMPANY_MATERIAL_CONFIG, type CompanyMaterialConfig } from '../domain/companyMaterialConfig';
import { setConfiguredPriorityNames } from '../domain/procurementClassification';
import { companyMaterialConfigAPI } from '../services/companyMaterialConfig';

export function useCompanyMaterialConfig() {
  const [config, setConfig] = useState<CompanyMaterialConfig>(DEFAULT_COMPANY_MATERIAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setConfiguredPriorityNames(config.priorities);
  }, [config.priorities]);

  useEffect(() => {
    let active = true;
    companyMaterialConfigAPI.get()
      .then(value => { if (active) setConfig(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { config, loading, error };
}
