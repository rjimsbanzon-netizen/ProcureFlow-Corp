export type MaterialClassCode = 'A' | 'B' | 'C';
export type CompanyIndustry = 'electronics' | 'bakery' | 'cellphone' | 'construction' | 'garment' | 'restaurant' | 'custom';

export interface CompanyPriorityDefinition {
  code: MaterialClassCode;
  name: string;
  description: string;
}

export interface CompanyMaterialConfig {
  companyName: string;
  industry: CompanyIndustry;
  priorities: CompanyPriorityDefinition[];
  activeSetupId?: string | null;
}

export const INDUSTRY_TEMPLATES: Record<CompanyIndustry, { label: string; companyName: string; priorities: CompanyPriorityDefinition[] }> = {
  electronics: {
    label: 'Electronics shop & repair',
    companyName: 'ElectroLab Electronics Shop',
    priorities: [
      { code: 'A', name: 'Core sales & repair items', description: 'Popular development boards, replacement parts, ICs and regulated adapters whose shortage delays customer orders and repairs.' },
      { code: 'B', name: 'Regular electronics consumables', description: 'Connectors, wiring, solder, tools, jumper kits and frequently replenished accessories.' },
      { code: 'C', name: 'Shop & facility support', description: 'Organizers, labels, minor cleaning products and general administrative supplies.' }
    ]
  },
  bakery: {
    label: 'Bakery / food production',
    companyName: 'Golden Crust Bakery',
    priorities: [
      { code: 'A', name: 'Recipe-critical ingredients', description: 'Flour, sugar, yeast, dairy, oils, and other ingredients required for core products.' },
      { code: 'B', name: 'Packaging and baking consumables', description: 'Boxes, liners, baking paper, labels, and regularly used production supplies.' },
      { code: 'C', name: 'Shop and facility supplies', description: 'Cleaning products, office materials, minor tools, and non-production supplies.' }
    ]
  },
  cellphone: {
    label: 'Cellphone repair center',
    companyName: 'FixPoint Mobile Repair Center',
    priorities: [
      { code: 'A', name: 'Repair-critical replacement parts', description: 'Model-specific batteries, charging ports and displays needed to complete confirmed customer repairs.' },
      { code: 'B', name: 'Routine repair and retail supplies', description: 'Screen protectors, soldering consumables and frequently used repair accessories.' },
      { code: 'C', name: 'Workshop and reception supplies', description: 'ESD mats, packaging, receipts and non-urgent support materials.' }
    ]
  },
  construction: {
    label: 'Construction / hardware',
    companyName: 'BuildCraft Construction Services',
    priorities: [
      { code: 'A', name: 'Safety- and schedule-critical materials', description: 'Structural steel, cement, reinforcement, and safety items required to keep active jobs safe and on schedule.' },
      { code: 'B', name: 'Standard construction materials', description: 'Lumber, pipes, electrical supplies, fasteners, and planned finishing materials.' },
      { code: 'C', name: 'Site and office support supplies', description: 'General tools, stationery, cleaning supplies, and non-job-specific facility items.' }
    ]
  },
  garment: {
    label: 'Garment / apparel production',
    companyName: 'Threadline Apparel Workshop',
    priorities: [
      { code: 'A', name: 'Order-critical fabrics and trims', description: 'Main fabrics, required lining, and unique trims tied to committed production orders.' },
      { code: 'B', name: 'Regular sewing materials', description: 'Thread, zippers, buttons, elastic, packaging, and other regularly consumed inputs.' },
      { code: 'C', name: 'Workshop and office supplies', description: 'Needles, maintenance items, stationery, and general facility supplies.' }
    ]
  },
  restaurant: {
    label: 'Restaurant / cafe',
    companyName: 'Savor & Sip Restaurant',
    priorities: [
      { code: 'A', name: 'Menu-critical ingredients', description: 'Fresh and core ingredients needed to prepare the current menu and meet food-safety requirements.' },
      { code: 'B', name: 'Regular food-service supplies', description: 'Beverages, takeaway packaging, napkins, and regularly used kitchen consumables.' },
      { code: 'C', name: 'Dining and facility supplies', description: 'Cleaning products, office materials, smallwares, and non-menu support items.' }
    ]
  },
  custom: {
    label: 'Other / custom company',
    companyName: 'My Company',
    priorities: [
      { code: 'A', name: 'Core production materials', description: 'Materials that directly support the company’s main product or service.' },
      { code: 'B', name: 'Regular operating materials', description: 'Materials used regularly to support production or daily operations.' },
      { code: 'C', name: 'Support materials', description: 'Occasional, maintenance, facility, or other supporting materials.' }
    ]
  }
};

export const DEFAULT_COMPANY_MATERIAL_CONFIG: CompanyMaterialConfig = {
  companyName: INDUSTRY_TEMPLATES.electronics.companyName,
  industry: 'electronics',
  priorities: INDUSTRY_TEMPLATES.electronics.priorities.map(item => ({ ...item }))
};

export function configFromIndustry(industry: CompanyIndustry, companyName?: string): CompanyMaterialConfig {
  const template = INDUSTRY_TEMPLATES[industry];
  return {
    companyName: companyName?.trim() || template.companyName,
    industry,
    priorities: template.priorities.map(item => ({ ...item }))
  };
}
