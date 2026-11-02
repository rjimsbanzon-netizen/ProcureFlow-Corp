import { configFromIndustry, type CompanyIndustry, type CompanyMaterialConfig } from './companyMaterialConfig';
import type { PurchaseCategory } from './procurementClassification';

export interface CompanySetupDepartment {
  name: string;
  purpose: string;
  budgetPercent: number;
}

export interface CompanySetupApprovalThresholds {
  financeFrom: number;
  financeHeadFrom: number;
  adminFrom: number;
}

export interface CompanySetupCategory {
  category: PurchaseCategory;
  requestingDepartment: string;
  examples: string;
}

export interface CompanySetupTemplate {
  id: Exclude<CompanyIndustry, 'custom'>;
  label: string;
  companyName: string;
  summary: string;
  workflow: string;
  departments: CompanySetupDepartment[];
  purchaseCategories: CompanySetupCategory[];
  approvals: CompanySetupApprovalThresholds;
}

const standardApprovals: CompanySetupApprovalThresholds = {
  financeFrom: 100_000,
  financeHeadFrom: 1_000_000,
  adminFrom: 500_000
};

export const COMPANY_SETUP_TEMPLATES: CompanySetupTemplate[] = [
  {
    id: 'electronics',
    label: 'Electronics shop & repair',
    companyName: 'ElectroLab Electronics Shop',
    summary: 'Sells electronics components and accessories and carries out board assembly and electronic repairs.',
    workflow: 'Sales and technicians identify demand for components and replacement parts. Operations checks reorder points and repair jobs, Engineering verifies compatibility, Procurement collects quotes and verifies suppliers, Quality inspects delivered goods, and Finance matches invoices with accepted receipts before payment.',
    departments: [
      { name: 'Operations', purpose: 'Production planning, assembly capacity, material readiness, and work orders.', budgetPercent: 48 },
      { name: 'Procurement', purpose: 'Component sourcing, quotations, purchase orders, supplier performance, and delivery follow-up.', budgetPercent: 7 },
      { name: 'Finance & Accounting', purpose: 'Budget control, approval thresholds, invoice matching, and payment.', budgetPercent: 4 },
      { name: 'Engineering & Product Design', purpose: 'Bill of materials, component specifications, approved equivalents, and engineering changes.', budgetPercent: 12 },
      { name: 'Quality & Compliance', purpose: 'Incoming inspection, test requirements, regulatory evidence, and nonconformance review.', budgetPercent: 9 },
      { name: 'Warehouse & Logistics', purpose: 'Receiving, component storage, traceability, and production replenishment.', budgetPercent: 8 },
      { name: 'IT Systems', purpose: 'Business systems, network, devices, software, and cybersecurity services.', budgetPercent: 3 },
      { name: 'Human Resources', purpose: 'Recruitment, workforce training, safety training, and employee services.', budgetPercent: 3 },
      { name: 'Executive', purpose: 'Company-wide oversight and exceptional approvals; no department-head self-approval.', budgetPercent: 6 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Operations', examples: 'ICs, PCBs, components, wiring, solder, enclosures' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Operations', examples: 'Assembly stations, test rigs, production tools' },
      { category: 'General Services', requestingDepartment: 'Quality & Compliance', examples: 'Calibration, inspection, and certification services' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Engineering & Product Design', examples: 'Engineering design, product testing, and technical consulting' },
      { category: 'Construction & Works', requestingDepartment: 'Operations', examples: 'Production-line fit-out and facility work' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'ERP, CAD, security, and cloud subscriptions' },
      { category: 'Rental & Leasing', requestingDepartment: 'Warehouse & Logistics', examples: 'Temporary storage, handling, and transport equipment' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Plant electricity, connectivity, and recurring production utilities' }
    ],
    approvals: { ...standardApprovals }
  },
  {
    id: 'cellphone',
    label: 'Cellphone repair center',
    companyName: 'FixPoint Mobile Repair Center',
    summary: 'Repairs phones using compatible spare parts, traceable stock, and technician tools.',
    workflow: 'Service desk captures repair demand and compatible model. Repair technicians verify specifications; Operations reviews minimum stock; Procurement chooses accredited suppliers; Quality tests parts at receipt; Finance matches supplier invoices to approved purchase orders and accepted deliveries.',
    departments: [
      { name: 'Operations', purpose: 'Repair job scheduling, stock readiness and daily operations.', budgetPercent: 37 },
      { name: 'Procurement', purpose: 'Replacement-part sourcing, supplier evaluation and purchase orders.', budgetPercent: 8 },
      { name: 'Finance & Accounting', purpose: 'Cash flow, invoices, budgets and payment matching.', budgetPercent: 5 },
      { name: 'Repair & Technical Services', purpose: 'Device diagnosis, part compatibility and technician requirements.', budgetPercent: 16 },
      { name: 'Quality & Testing', purpose: 'Incoming part tests, battery safety and warranty checks.', budgetPercent: 9 },
      { name: 'Inventory & Logistics', purpose: 'Serial/model traceability, secure storage and receiving.', budgetPercent: 9 },
      { name: 'Customer Service', purpose: 'Repair bookings, customer communication and pickup.', budgetPercent: 6 },
      { name: 'IT Systems', purpose: 'Repair ticketing and point-of-sale software.', budgetPercent: 3 },
      { name: 'Human Resources', purpose: 'Technician training, staffing and safety.', budgetPercent: 3 },
      { name: 'Executive', purpose: 'Management oversight and high-value approvals.', budgetPercent: 4 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Repair & Technical Services', examples: 'Replacement batteries, screens, connectors, charge ports' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Repair & Technical Services', examples: 'Microscope, hot air station and testing tools' },
      { category: 'General Services', requestingDepartment: 'Quality & Testing', examples: 'Tool calibration, safety inspections' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Repair & Technical Services', examples: 'Specialized board repair and training' },
      { category: 'Construction & Works', requestingDepartment: 'Operations', examples: 'Repair bench and shop fit-out' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'Ticketing, POS and inventory subscriptions' },
      { category: 'Rental & Leasing', requestingDepartment: 'Operations', examples: 'Repair service test-equipment rental' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Electricity and internet access' }
    ],
    approvals: { ...standardApprovals }
  },
  {
    id: 'bakery',
    label: 'Bakery / food production',
    companyName: 'Golden Crust Bakery',
    summary: 'Produces baked goods with recipe-controlled ingredients, packaging, sanitation, and cold-chain needs.',
    workflow: 'Sales forecasts and production planning set batch requirements. Food Safety approves ingredients, allergens, and supplier evidence; Operations schedules production and checks stock; Procurement buys ingredients and packaging; Receiving records lot and expiry details; Finance monitors budgets and verifies invoices.',
    departments: [
      { name: 'Operations', purpose: 'Production schedules, recipe batch quantities, labor capacity, and material readiness.', budgetPercent: 43 },
      { name: 'Procurement', purpose: 'Ingredient and packaging sourcing, supplier approval, price comparisons, and orders.', budgetPercent: 7 },
      { name: 'Finance & Accounting', purpose: 'Department allocations, approval controls, invoice matching, and payment.', budgetPercent: 4 },
      { name: 'Food Safety & Quality', purpose: 'Food safety plans, allergen controls, ingredient specifications, and incoming checks.', budgetPercent: 10 },
      { name: 'Warehouse & Receiving', purpose: 'Ingredient receipt, lot and expiry tracking, storage, and stock rotation.', budgetPercent: 10 },
      { name: 'Sales & Distribution', purpose: 'Demand forecasts, customer orders, delivery packaging, and route requirements.', budgetPercent: 10 },
      { name: 'Maintenance & Facilities', purpose: 'Oven, refrigeration, utilities, preventive maintenance, and sanitation supplies.', budgetPercent: 6 },
      { name: 'IT Systems', purpose: 'Point-of-sale, order management, accounting systems, and connectivity.', budgetPercent: 2 },
      { name: 'Human Resources', purpose: 'Hiring, food-handler training, shift coverage, and employee services.', budgetPercent: 3 },
      { name: 'Executive', purpose: 'Company-wide oversight and exceptional approvals.', budgetPercent: 5 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Operations', examples: 'Flour, sugar, yeast, dairy, oils, and ingredients' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Maintenance & Facilities', examples: 'Ovens, mixers, proofers, and refrigeration' },
      { category: 'General Services', requestingDepartment: 'Maintenance & Facilities', examples: 'Pest control, cleaning, and equipment maintenance' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Food Safety & Quality', examples: 'Food-safety audits, laboratory testing, and compliance advice' },
      { category: 'Construction & Works', requestingDepartment: 'Maintenance & Facilities', examples: 'Kitchen fit-out, ventilation, and food-safe flooring' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'Point-of-sale, ordering, inventory, and accounting tools' },
      { category: 'Rental & Leasing', requestingDepartment: 'Operations', examples: 'Temporary refrigeration, delivery vehicles, or production equipment' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Electricity, water, gas, and internet for production outlets' }
    ],
    approvals: { ...standardApprovals }
  },
  {
    id: 'construction',
    label: 'Construction contractor',
    companyName: 'BuildCraft Construction Services',
    summary: 'Delivers project-based work with site-specific quantities, safety controls, equipment, and milestones.',
    workflow: 'Project managers create project requisitions from approved estimates and site schedules. Engineering validates drawings and technical specifications; Safety reviews required protection; Operations confirms site need and delivery location; Procurement obtains competitive bids and issues orders; Finance checks project budgets and payment evidence.',
    departments: [
      { name: 'Operations', purpose: 'Project execution, site schedules, workforce coordination, and requisition validation.', budgetPercent: 43 },
      { name: 'Procurement', purpose: 'Materials, subcontractor sourcing, bid comparison, contracts, and delivery tracking.', budgetPercent: 8 },
      { name: 'Finance & Accounting', purpose: 'Project budget control, financial approvals, invoice matching, and payment.', budgetPercent: 6 },
      { name: 'Engineering & Estimating', purpose: 'Drawings, quantities, technical specifications, estimates, and approved substitutions.', budgetPercent: 10 },
      { name: 'Quality & Safety', purpose: 'Inspection plans, site safety equipment, compliance evidence, and quality records.', budgetPercent: 10 },
      { name: 'Fleet & Equipment', purpose: 'Heavy equipment, tools, rentals, maintenance, and utilization planning.', budgetPercent: 8 },
      { name: 'Warehouse & Logistics', purpose: 'Site receiving, storage, inventory movement, and delivery coordination.', budgetPercent: 5 },
      { name: 'IT Systems', purpose: 'Project management systems, mobile devices, connectivity, and software.', budgetPercent: 2 },
      { name: 'Human Resources', purpose: 'Recruitment, worker onboarding, certifications, and employee services.', budgetPercent: 3 },
      { name: 'Executive', purpose: 'Company-wide oversight and exceptional approvals.', budgetPercent: 5 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Operations', examples: 'Cement, steel, lumber, pipes, fasteners, and site consumables' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Fleet & Equipment', examples: 'Excavators, lifts, generators, and major tools' },
      { category: 'General Services', requestingDepartment: 'Operations', examples: 'Site security, waste removal, and equipment servicing' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Engineering & Estimating', examples: 'Design, surveying, engineering, and project consulting' },
      { category: 'Construction & Works', requestingDepartment: 'Operations', examples: 'Specialist subcontract work and project construction packages' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'Project controls, scheduling, document, and field software' },
      { category: 'Rental & Leasing', requestingDepartment: 'Fleet & Equipment', examples: 'Cranes, scaffolds, lifts, and temporary equipment' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Temporary site power, water, fuel, and connectivity' }
    ],
    approvals: { ...standardApprovals }
  },
  {
    id: 'garment',
    label: 'Garment / apparel manufacturer',
    companyName: 'Threadline Apparel Workshop',
    summary: 'Produces apparel by style and order, coordinating fabrics, trims, sewing capacity, quality, and shipment dates.',
    workflow: 'Merchandising converts customer orders into a production plan. Product Development approves patterns, fabrics, and trims; Operations plans cutting and sewing; Quality checks specifications and workmanship; Procurement sources fabric and components; Warehouse tracks lots and production issue; Finance monitors allocations and payment.',
    departments: [
      { name: 'Operations', purpose: 'Order-based production planning, cutting and sewing capacity, and material readiness.', budgetPercent: 47 },
      { name: 'Procurement', purpose: 'Fabric and trim sourcing, supplier negotiations, purchase orders, and delivery schedules.', budgetPercent: 7 },
      { name: 'Finance & Accounting', purpose: 'Budget control, approval thresholds, invoice matching, and payment.', budgetPercent: 4 },
      { name: 'Product Development', purpose: 'Patterns, technical packs, approved samples, fabric specifications, and substitutions.', budgetPercent: 10 },
      { name: 'Quality & Compliance', purpose: 'Fabric inspection, measurement standards, workmanship, and compliance checks.', budgetPercent: 9 },
      { name: 'Warehouse & Logistics', purpose: 'Fabric and trim receipt, lot traceability, stock issue, and finished-goods dispatch.', budgetPercent: 8 },
      { name: 'Sales & Merchandising', purpose: 'Customer forecasts, order changes, style plans, and committed shipment dates.', budgetPercent: 5 },
      { name: 'Maintenance & Facilities', purpose: 'Sewing equipment, utilities, repairs, and preventive maintenance.', budgetPercent: 3 },
      { name: 'IT Systems', purpose: 'Order, production, design, accounting, and communication systems.', budgetPercent: 2 },
      { name: 'Human Resources', purpose: 'Recruitment, workforce training, shift coverage, and employee services.', budgetPercent: 2 },
      { name: 'Executive', purpose: 'Company-wide oversight and exceptional approvals.', budgetPercent: 3 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Operations', examples: 'Fabrics, trims, thread, zippers, buttons, and packaging' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Maintenance & Facilities', examples: 'Industrial sewing, cutting, pressing, and finishing machines' },
      { category: 'General Services', requestingDepartment: 'Operations', examples: 'Garment finishing, repairs, and production support services' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Product Development', examples: 'Pattern development, grading, testing, and technical consulting' },
      { category: 'Construction & Works', requestingDepartment: 'Maintenance & Facilities', examples: 'Factory fit-out, electrical work, and ventilation' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'CAD, production planning, inventory, and ERP tools' },
      { category: 'Rental & Leasing', requestingDepartment: 'Warehouse & Logistics', examples: 'Temporary warehouse space and material-handling equipment' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Factory electricity, water, and production utilities' }
    ],
    approvals: { ...standardApprovals }
  },
  {
    id: 'restaurant',
    label: 'Restaurant / cafe',
    companyName: 'Savor & Sip Restaurant',
    summary: 'Runs a food-service operation with menu planning, perishable stock, food safety, and service continuity.',
    workflow: 'The kitchen sets menu specifications and forecasts; Food Safety approves suppliers and handling standards; restaurant operations validate quantities and service dates; Procurement sources food and indirect supplies; Receiving checks condition and expiry; Finance monitors department allocations and performs invoice and payment controls.',
    departments: [
      { name: 'Operations', purpose: 'Kitchen and service scheduling, menu execution, outlet readiness, and material requirements.', budgetPercent: 42 },
      { name: 'Procurement', purpose: 'Ingredient and service sourcing, price comparisons, supplier approval, and purchase orders.', budgetPercent: 8 },
      { name: 'Finance & Accounting', purpose: 'Budget controls, approval limits, invoice matching, and payment.', budgetPercent: 5 },
      { name: 'Food Safety & Quality', purpose: 'Food safety, allergen controls, supplier evidence, and receiving standards.', budgetPercent: 8 },
      { name: 'Inventory & Receiving', purpose: 'Daily receipt, freshness and expiry checks, storage, and stock rotation.', budgetPercent: 8 },
      { name: 'Marketing & Sales', purpose: 'Menu promotions, customer demand, events, and sales forecasts.', budgetPercent: 7 },
      { name: 'Facilities & Maintenance', purpose: 'Kitchen equipment, refrigeration, cleaning, utilities, and repairs.', budgetPercent: 6 },
      { name: 'IT Systems', purpose: 'Point-of-sale, reservations, delivery, accounting, and network services.', budgetPercent: 3 },
      { name: 'Human Resources', purpose: 'Hiring, food-handler training, schedules, and employee services.', budgetPercent: 4 },
      { name: 'Executive', purpose: 'Company-wide oversight and exceptional approvals.', budgetPercent: 9 }
    ],
    purchaseCategories: [
      { category: 'Goods & Materials', requestingDepartment: 'Operations', examples: 'Fresh produce, meat, dairy, dry goods, beverages, and packaging' },
      { category: 'Equipment & Capital Assets', requestingDepartment: 'Facilities & Maintenance', examples: 'Ovens, chillers, kitchen equipment, and point-of-sale hardware' },
      { category: 'General Services', requestingDepartment: 'Facilities & Maintenance', examples: 'Cleaning, pest control, equipment repair, and waste removal' },
      { category: 'Professional & Consulting Services', requestingDepartment: 'Food Safety & Quality', examples: 'Food safety reviews, laboratory tests, and menu compliance advice' },
      { category: 'Construction & Works', requestingDepartment: 'Facilities & Maintenance', examples: 'Kitchen renovation, ventilation, plumbing, and outlet fit-out' },
      { category: 'Software & Digital Services', requestingDepartment: 'IT Systems', examples: 'POS, delivery, reservation, inventory, and accounting systems' },
      { category: 'Rental & Leasing', requestingDepartment: 'Facilities & Maintenance', examples: 'Kitchen equipment, delivery vehicles, and temporary storage' },
      { category: 'Utilities & Subscriptions', requestingDepartment: 'Operations', examples: 'Electricity, water, gas, and internet service' }
    ],
    approvals: { ...standardApprovals }
  }
];

export function companySetupProfile(
  template: CompanySetupTemplate,
  companyName = template.companyName
): CompanyMaterialConfig {
  return {
    ...configFromIndustry(template.id, companyName),
    activeSetupId: template.id
  };
}

export function allocateSetupBudget(
  departments: readonly CompanySetupDepartment[],
  annualBudgetPHP: number
): { department: string; allocated: number }[] {
  if (!Number.isFinite(annualBudgetPHP) || annualBudgetPHP <= 0) {
    throw new Error('Enter a positive annual procurement budget.');
  }
  const totalCents = Math.round(annualBudgetPHP * 100);
  if (!Number.isSafeInteger(totalCents)) {
    throw new Error('The annual procurement budget is too large.');
  }
  const percentageTotal = departments.reduce((sum, department) => sum + department.budgetPercent, 0);
  if (!departments.length || Math.abs(percentageTotal - 100) > 0.01) {
    throw new Error('Department budget percentages must total 100%.');
  }
  let allocatedCents = 0;
  return departments.map((department, index) => {
    const cents = index === departments.length - 1
      ? totalCents - allocatedCents
      : Math.round(totalCents * department.budgetPercent / 100);
    allocatedCents += cents;
    return { department: department.name, allocated: cents / 100 };
  });
}
