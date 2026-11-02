export type DocumentEntityType = 'PR' | 'BID' | 'PO' | 'DEL' | 'PAY';
export type DocumentCategory =
  | 'Quotation'
  | 'Invoice'
  | 'Delivery Receipt'
  | 'Signed Contract'
  | 'Supporting Document';

export interface ProcurementDocument {
  id: string;
  entityType: DocumentEntityType;
  entityId: string;
  category: DocumentCategory;
  fileName: string;
  mimeType: string;
  size: number;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'Quotation', 'Invoice', 'Delivery Receipt', 'Signed Contract', 'Supporting Document',
];
export const ENTITY_LABELS: Record<DocumentEntityType, string> = {
  PR: 'Purchase Requisition',
  BID: 'Supplier Bid',
  PO: 'Purchase Order',
  DEL: 'Delivery / Inspection',
  PAY: 'Payment',
};
