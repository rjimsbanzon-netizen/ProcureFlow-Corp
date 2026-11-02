import { formatQuantity } from '../domain/measurementUnits';
import { jsPDF } from 'jspdf';
import { DB } from '../store/state';
import type { ProcurementRecord } from '../types/procurement';
import { canReadEntity } from './documents';

export type PrintableType = 'PR' | 'PO' | 'AGREEMENT' | 'INSPECTION' | 'PAYMENT';
export const PRINT_TITLES: Record<PrintableType, string> = {
  PR: 'PURCHASE REQUISITION',
  PO: 'PURCHASE ORDER',
  AGREEMENT: 'SUPPLIER AGREEMENT',
  INSPECTION: 'DELIVERY INSPECTION REPORT',
  PAYMENT: 'PAYMENT VOUCHER',
};

const money = (n: unknown) => `PHP ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blank = (n: unknown) => String(n ?? '—');

export function printableRecords(type: PrintableType): ProcurementRecord[] {
  const collection = type === 'PR' ? 'requisitions' : type === 'INSPECTION' ? 'deliveries' :
    type === 'PAYMENT' ? 'payments' : 'orders';
  const entity = type === 'AGREEMENT' ? 'PO' : type === 'INSPECTION' ? 'DEL' : type === 'PAYMENT' ? 'PAY' : type;
  return DB[collection].filter(record => canReadEntity(entity, record.id));
}

type Line = [string, unknown];
function buildLines(type: PrintableType, record: ProcurementRecord): { sections: Array<[string, Line[]]>; signers: string[] } {
  const order = type === 'INSPECTION' || type === 'PAYMENT' ? DB.orders.find(o => o.id === record.poId) : record;
  const requisition = type === 'AGREEMENT' ? DB.requisitions.find(r => r.id === record.prId) : undefined;
  switch (type) {
    case 'PR': return {
      sections: [
        ['REQUEST DETAILS', [['Reference number', record.id], ['Department', record.department], ['Requested by', record.requestedBy], ['Date requested', record.createdAt], ['Needed by', record.targetDate], ['Status', record.status]]],
        ['ITEMS & JUSTIFICATION', [['Item / Description', record.itemTitle], ['Specifications', record.specs], ['Quantity', formatQuantity(record.quantity, record.unit)], ['Estimated unit cost', money(record.unitPrice)], ['Estimated total', money(record.totalCost)], ['Purpose / Remarks', record.remarks]]],
      ], signers: ['Requested by', 'Reviewed by', 'Approved by'],
    };
    case 'PO': return {
      sections: [
        ['ORDER INFORMATION', [['PO number', record.id], ['PR reference', record.prId], ['Supplier', record.supplierName], ['Department', record.department], ['Date issued', record.poDate], ['Status', record.status]]],
        ['ORDER DETAILS', [['Item', record.itemTitle], ['Specifications', record.specs], ['Quantity', formatQuantity(record.quantity, record.unit)], ['Agreed unit price', money(record.unitPrice ?? (Number(record.totalCost || 0) / (Number(record.quantity) || 1)))], ['Total amount', money(record.totalCost)], ['Terms', record.agreedTerms]]],
      ], signers: ['Prepared by', 'Authorized by', 'Supplier acknowledgment'],
    };
    case 'AGREEMENT': return {
      sections: [
        ['PARTIES & REFERENCE', [['Agreement reference', `AGR-${record.id}`], ['Linked purchase order', record.id], ['Purchaser / Department', requisition?.department || record.department], ['Supplier', record.supplierName], ['Date of order', record.poDate]]],
        ['AGREED PROCUREMENT TERMS', [['Goods / Services', record.itemTitle], ['Specifications', record.specs], ['Agreed quantity', formatQuantity(record.quantity, record.unit)], ['Agreed price', money(record.totalCost)], ['Negotiated terms', record.agreedTerms || 'See signed agreement / PO attachments']]],
      ], signers: ['Procurement representative', 'Supplier representative'],
    };
    case 'INSPECTION': return {
      sections: [
        ['DELIVERY INFORMATION', [['Inspection / Delivery ref', record.id], ['PO reference', record.poId], ['Supplier', record.supplierName], ['Item', record.itemTitle || order?.itemTitle], ['Date delivered', record.actualDate], ['Status', record.deliveryStatus]]],
        ['INSPECTION RESULT', [['Quantity ordered', formatQuantity(record.orderedQty, record.unit || order?.unit)], ['Quantity received', formatQuantity(record.deliveredQty, record.unit || order?.unit)], ['Compliance status', record.complianceStatus], ['Inspection notes', record.remarks], ['Recorded by', record.recordedBy]]],
      ], signers: ['Inspected by', 'Verified by'],
    };
    case 'PAYMENT': return {
      sections: [
        ['PAYMENT INFORMATION', [['Voucher reference', record.id], ['PO reference', record.poId], ['Supplier', record.supplierName], ['Department', record.department || order?.department], ['Payment status', record.status], ['Payment date', record.paymentDate]]],
        ['DISBURSEMENT DETAILS', [['Amount payable', money(record.paymentAmount ?? record.totalAmount)], ['Method', record.paymentMethod || 'Not yet specified'], ['Transaction reference', record.refNumber || 'Not yet specified'], ['Delivery verified', record.deliveryVerified ? 'Yes' : 'No'], ['Remarks', record.remarks], ['Processed by', record.processedBy]]],
      ], signers: ['Prepared by', 'Payment authorized by', 'Received / Verified by'],
    };
  }
}

export function exportProcurementPDF(type: PrintableType, id: string): void {
  const record = printableRecords(type).find(r => r.id === id);
  if (!record) throw new Error('Document not found or permission denied.');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const bottom = 275;
  let y = 0;
  let page = 1;
  const addPage = () => { pdf.addPage(); page += 1; y = 24; };
  const ensureSpace = (height: number) => { if (y + height > bottom) addPage(); };

  pdf.setFillColor(37, 45, 40);
  pdf.rect(0, 0, pageWidth, 42, 'F');
  pdf.setFillColor(166, 79, 50);
  pdf.rect(0, 42, pageWidth, 2.5, 'F');
  pdf.setTextColor(255, 253, 248);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(19);
  pdf.text('PROCUREFLOW', 17, 20);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5);
  pdf.text('ENTERPRISE PROCUREMENT MANAGEMENT', 17, 28);
  y = 57;

  pdf.setTextColor(39, 45, 40);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15);
  pdf.text(PRINT_TITLES[type], 17, y); y += 9;
  pdf.setTextColor(108, 114, 106); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(`Document Ref: ${type === 'AGREEMENT' ? `AGR-${id}` : id}`, 17, y);
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-PH')}`, 145, y); y += 9;

  const { sections, signers } = buildLines(type, record);
  for (const [heading, lines] of sections) {
    ensureSpace(15);
    pdf.setFillColor(242, 239, 231); pdf.roundedRect(17, y, 176, 10, 1, 1, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(135, 62, 39);
    pdf.text(heading, 21, y + 6.5); y += 14;
    for (const [label, value] of lines) {
      const text = blank(value);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
      const wrapped = pdf.splitTextToSize(text, 119) as string[];
      const lineHeight = Math.max(7, wrapped.length * 4.5 + 3);
      ensureSpace(lineHeight);
      if (y % 2 < 1) { pdf.setFillColor(252, 250, 247); pdf.rect(17, y - 3, 176, lineHeight, 'F'); }
      pdf.setTextColor(113, 118, 110); pdf.text(label, 20, y + 2);
      pdf.setTextColor(39, 45, 40); pdf.text(wrapped, 74, y + 2);
      y += lineHeight;
    }
    y += 6;
  }

  ensureSpace(36);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(135, 62, 39);
  pdf.text('APPROVAL / ACKNOWLEDGMENT', 17, y); y += 22;
  const cols = Math.min(3, signers.length);
  const width = 176 / cols;
  for (let i = 0; i < signers.length; i++) {
    if (i > 0 && i % cols === 0) { y += 28; ensureSpace(30); }
    const x = 17 + (i % cols) * width;
    pdf.setDrawColor(190, 185, 175); pdf.line(x + 2, y, x + width - 8, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(103, 107, 100);
    pdf.text(signers[i], x + 2, y + 5);
  }
  y += 14;
  ensureSpace(12);
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(115, 119, 110);
  pdf.text('Signature lines are intentionally blank. This export does not prove approval or signing.', 17, y);

  for (let index = 1; index <= page; index++) {
    pdf.setPage(index);
    pdf.setDrawColor(217, 211, 197); pdf.line(17, 286, 193, 286);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(117, 120, 112);
    pdf.text('ProcureFlow  |  System-generated procurement document', 17, 291);
    pdf.text(`Page ${index} of ${page}`, 170, 291);
  }
  pdf.save(`${type}-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
}
