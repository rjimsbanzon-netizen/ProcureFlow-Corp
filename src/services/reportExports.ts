/** Consistent, print-ready exports for ProcureFlow Advanced Reports.
 * CSV is a data format (no fonts/colors); PDFs are designed for presentation.
 */
import { jsPDF } from 'jspdf';
import brandLogoUrl from '../assets/pf-corp-report-logo.jpg';

export type ReportCell = string | number | null | undefined;
export type ReportColumn = {
  heading: string;
  weight: number;
  align?: 'left' | 'right' | 'center';
  kind?: 'currency' | 'number' | 'percent' | 'days' | 'rating' | 'text';
};
export type ReportKpi = {label: string; value: string};
export type ReportExport = {
  fileName: string;
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: ReportCell[][];
  kpis: ReportKpi[];
  note?: string;
  barChart?: Array<{label: string; value: number}>;
  totalRow?: ReportCell[];
};

const COLORS = {
  ink: [30, 42, 40] as const,
  muted: [100, 111, 108] as const,
  brand: [172, 82, 53] as const,
  dark: [28, 42, 38] as const,
  border: [218, 225, 220] as const,
  stripe: [248, 249, 247] as const,
  pale: [250, 241, 236] as const,
  white: [255, 255, 255] as const,
};
const asText = (value: ReportCell): string => value === null || value === undefined ? '' : String(value);
const numeral = (value: ReportCell): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const decimal = (value: number, digits = 2) => value.toLocaleString('en-PH', {minimumFractionDigits:digits, maximumFractionDigits:digits});
const simpleDate = () => new Date().toLocaleString('en-PH', {year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function printable(value: ReportCell, column: ReportColumn): string {
  const n = numeral(value);
  if (n !== null && column.kind === 'currency') return `PHP ${decimal(n)}`;
  if (n !== null && column.kind === 'percent') return `${decimal(n, 1)}%`;
  if (n !== null && column.kind === 'days') return `${decimal(n, 1)} d`;
  if (n !== null && column.kind === 'rating') return `${decimal(n, 1)} / 5`;
  if (n !== null && column.kind === 'number') return decimal(n, Number.isInteger(n) ? 0 : 1);
  return asText(value).trim() || 'N/A';
}
function pdfSafe(text: string): string {
  // Standard jsPDF Helvetica cannot render the peso glyph or many Unicode symbols.
  return text.replace(/₱/g,'PHP ').replace(/[→➔]/g,'to').replace(/[–—]/g,'-')
    .replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/\u00a0/g,' ')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\x20-\x7e\u00a1-\u00ff]/g,'?');
}

/** CSV: true numeric cells, UTF-8 BOM, CRLF rows and Excel formula-injection protection. */
export function csvContent(config: ReportExport): string {
  const csvValue = (value: ReportCell) => {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    // Single-line cells make the file easy to inspect even in text editors.
    let valueString = asText(value).replace(/[\r\n\t]+/g,' ').replace(/ {2,}/g,' ').trim();
    if (/^[=+@\-]/.test(valueString)) valueString = "'" + valueString;
    if (/[",]/.test(valueString)) return '"' + valueString.replace(/"/g,'""') + '"';
    return valueString;
  };
  const lines = [config.columns.map(c=>csvValue(c.heading)), ...config.rows.map(r=>config.columns.map((_,i)=>csvValue(r[i])))];
  return '\uFEFF' + lines.map(row=>row.join(',')).join('\r\n') + '\r\n';
}
export function downloadReportCsv(config: ReportExport): void {
  const blob = new Blob([csvContent(config)], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download=`${config.fileName}.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

function rgb(pdf: jsPDF, type: 'fill'|'text'|'draw', value: readonly [number,number,number]) {
  if (type === 'fill') pdf.setFillColor(...value);
  else if (type === 'draw') pdf.setDrawColor(...value);
  else pdf.setTextColor(...value);
}

/** Build the document separately from saving so the output can be tested. */
export function createReportPdf(config: ReportExport, brandLogoData?: string): jsPDF {
  if (!config.columns.length || config.columns.length > 9) throw new Error('Invalid report column definition.');
  if (config.columns.some(c=>!(c.weight > 0))) throw new Error('Invalid report column widths.');
  const pdf = new jsPDF({orientation:'landscape', unit:'mm', format:'a4', compress:true});
  const pageW=pdf.internal.pageSize.getWidth(), pageH=pdf.internal.pageSize.getHeight();
  const x=16, right=pageW-16, tableW=right-x, pageBottom=pageH-18;
  const widths = config.columns.map(c=>tableW*c.weight/config.columns.reduce((sum,col)=>sum+col.weight,0));
  const starts=widths.map((_,i)=>x+widths.slice(0,i).reduce((sum,n)=>sum+n,0));
  const generated = simpleDate();
  const lineH=4.1, cellPad=3;
  let currentY = 0, pageNumber = 1;
  const text=(value:string,x0:number,y0:number,size=9,bold=false,color:readonly [number,number,number]=COLORS.ink,opts?:{align?:'left'|'right'|'center'})=>{
    pdf.setFont('helvetica',bold?'bold':'normal');pdf.setFontSize(size);rgb(pdf,'text',color);pdf.text(pdfSafe(value),x0,y0,opts);
  };
  const basePage=()=>{
    rgb(pdf,'fill',COLORS.dark);pdf.rect(0,0,pageW,40,'F');
    rgb(pdf,'fill',COLORS.brand);pdf.rect(0,0,5,40,'F');
    // The image is a faithful, whitespace-trimmed copy of the supplied PF Corp logo.
    // Embed on EVERY page so exported reports carry the organization's identity.
    rgb(pdf,'fill',COLORS.white);pdf.roundedRect(x,5.5,33,29,2.5,2.5,'F');
    if (brandLogoData) {
      pdf.addImage(brandLogoData,'JPEG',x+1.1,6.1,30.8,27.8,undefined,'FAST');
    } else {
      // Preserve printable output if the browser could not load the logo asset.
      text('PF CORP',x+16.5,21,10,true,COLORS.brand,{align:'center'});
    }
    text('PF CORP  /  ENTERPRISE PROCUREMENT REPORTS',x+40,12.4,8.1,true,COLORS.white);
    text(config.title,x+40,25,20,true,COLORS.white);
    text(config.subtitle,x+40,33,8.7,false,[221,228,224]);
    text('GENERATED',right,13.7,7.4,true,[225,230,225],{align:'right'});
    text(generated,right,20.4,9,false,COLORS.white,{align:'right'});
    text('LIVE PROCUREMENT RECORDS',right,27,7.1,true,[225,230,225],{align:'right'});
    currentY=48;
  };
  const newPage=()=>{pdf.addPage();pageNumber++;basePage();currentY=57;};
  basePage();
  const kpis=config.kpis.slice(0,4);
  const kpiGap=3.5,kpiW=(tableW-(kpis.length-1)*kpiGap)/Math.max(1,kpis.length);
  kpis.forEach((kpi,i)=>{
    const kx=x+i*(kpiW+kpiGap);
    rgb(pdf,'fill',COLORS.stripe);pdf.roundedRect(kx,currentY,kpiW,23,2.4,2.4,'F');
    rgb(pdf,'fill',COLORS.brand);pdf.rect(kx,currentY,1.4,23,'F');
    text(kpi.label.toUpperCase(),kx+5,currentY+7.4,7.2,true,COLORS.muted);
    const fitSize=kpi.value.length>23?11.5:kpi.value.length>16?13:15;
    text(kpi.value,kx+5,currentY+17,fitSize,true,COLORS.ink);
  });
  currentY+=30;
  if(config.barChart?.length){
    const positive=config.barChart.filter(d=>Number.isFinite(d.value)&&d.value>0).sort((a,b)=>b.value-a.value).slice(0,5);
    if(positive.length){
      text('DEPARTMENT SPENDING  /  TOP CONTRIBUTORS',x,currentY,9,true,COLORS.ink);
      currentY+=7;
      const max=Math.max(...positive.map(d=>d.value));
      for (const item of positive){
        const label=pdfSafe(item.label);
        const shortLabel=label.length>34?label.slice(0,33)+'...':label;
        text(shortLabel,x,currentY+3.1,8,false,COLORS.ink);
        rgb(pdf,'fill',COLORS.stripe);pdf.roundedRect(x+72,currentY-0.5,129,4,1.5,1.5,'F');
        rgb(pdf,'fill',COLORS.brand);pdf.roundedRect(x+72,currentY-0.5,Math.max(1,129*item.value/max),4,1.5,1.5,'F');
        text(`PHP ${decimal(item.value)}`,right,currentY+3.1,8,true,COLORS.ink,{align:'right'});
        currentY+=7.3;
      }
      currentY+=4;
    }
  }
  const tableTopGap=4;
  const drawHeader=()=>{
    const h=12;
    rgb(pdf,'fill',COLORS.dark);pdf.roundedRect(x,currentY,tableW,h,2,2,'F');
    for(let i=0;i<config.columns.length;i++){
      const col=config.columns[i], pos=starts[i];
      const lines=pdf.splitTextToSize(pdfSafe(col.heading.toUpperCase()),widths[i]-cellPad*2);
      const align=col.align??'left';
      pdf.setFont('helvetica','bold');pdf.setFontSize(7.3);rgb(pdf,'text',COLORS.white);
      const bx=align==='right'?pos+widths[i]-cellPad:align==='center'?pos+widths[i]/2:pos+cellPad;
      pdf.text(lines.slice(0,2),bx,currentY+(lines.length>1?4.6:7.4),{align});
    }
    currentY+=h;
  };
  const startTable=(continued=false)=>{
    text((continued?'CONTINUED  /  ':'DETAILS  /  ')+`${config.rows.length} RECORD${config.rows.length===1?'':'S'}`,x,currentY+2,8.3,true,COLORS.muted);
    currentY+=tableTopGap+5;
    drawHeader();
  };
  const rowLines=(row:ReportCell[])=>config.columns.map((col,i)=>{
    pdf.setFont('helvetica','normal');pdf.setFontSize(8.2);
    const value=pdfSafe(printable(row[i],col));
    const lines=pdf.splitTextToSize(value,widths[i]-cellPad*2) as string[];
    return lines.length?lines:[''];
  });
  const paintRow=(row:ReportCell[],index:number,footer=false)=>{
    const items=rowLines(row), h=Math.max(10,Math.max(...items.map(a=>a.length))*lineH+5.5);
    if(currentY+h > pageBottom){newPage();startTable(true);}
    rgb(pdf,'fill',footer?COLORS.pale:index%2===0?COLORS.white:COLORS.stripe);
    pdf.rect(x,currentY,tableW,h,'F');
    rgb(pdf,'draw',COLORS.border);pdf.setLineWidth(0.2);pdf.line(x,currentY+h,right,currentY+h);
    for(let i=0;i<config.columns.length;i++){
      const col=config.columns[i],pos=starts[i],align=col.align??'left';
      const lineList=items[i];const bx=align==='right'?pos+widths[i]-cellPad:align==='center'?pos+widths[i]/2:pos+cellPad;
      pdf.setFont('helvetica',footer?'bold':'normal');pdf.setFontSize(8.2);rgb(pdf,'text',footer?COLORS.brand:COLORS.ink);
      pdf.text(lineList,bx,currentY+5.3,{align});
    }
    currentY+=h;
  };
  startTable();
  if(config.rows.length)config.rows.forEach((row,i)=>paintRow(row,i));
  else {paintRow([`No ${config.title.toLowerCase()} records in the selected dataset.`],0);}
  if(config.totalRow)paintRow(config.totalRow,config.rows.length,true);
  if(config.note){
    if(currentY+13 > pageBottom)newPage();
    text(pdfSafe(config.note),x,currentY+7,8,false,COLORS.muted);
  }
  const totalPages=pdf.getNumberOfPages();
  for(let n=1;n<=totalPages;n++){
    pdf.setPage(n);rgb(pdf,'draw',COLORS.border);pdf.setLineWidth(0.25);pdf.line(x,pageH-12,right,pageH-12);
    text('ProcureFlow  |  Procurement management reports',x,pageH-7.2,7.5,false,COLORS.muted);
    text(`PAGE ${n} OF ${totalPages}`,right,pageH-7.2,7.5,true,COLORS.ink,{align:'right'});
  }
  return pdf;
}
// Load Vite's bundled image URL when the user exports; a single cached Promise
// prevents repeated downloads and keeps the initial dashboard render lightweight.
let logoDataPromise: Promise<string | undefined> | undefined;
function loadReportLogo(): Promise<string | undefined> {
  if (!logoDataPromise) {
    logoDataPromise = fetch(brandLogoUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load report logo (${response.status})`);
        const blob = await response.blob();
        return await new Promise<string>((resolve,reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read report logo.'));
          reader.readAsDataURL(blob);
        });
      })
      .catch(error => {
        console.warn('Report logo unavailable; exporting with text fallback.', error);
        logoDataPromise = undefined; // retry on a subsequent export
        return undefined;
      });
  }
  return logoDataPromise;
}
export async function downloadReportPdf(config: ReportExport): Promise<void> {
  const brandLogoData = await loadReportLogo();
  createReportPdf(config, brandLogoData).save(`${config.fileName}.pdf`);
}
