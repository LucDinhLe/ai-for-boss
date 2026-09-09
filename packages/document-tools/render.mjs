import {Document,Packer,Paragraph,HeadingLevel,Table,TableRow,TableCell,WidthType} from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import PDFDocument from 'pdfkit';
import {fileURLToPath} from 'node:url';

export function validate(input){
  if(!input||!['docx','xlsx','pptx','pdf'].includes(input.format)||typeof input.title!=='string'||!input.title.trim()||input.title.length>200)throw new Error('Choose a document format and a short title.');
  if(JSON.stringify(input).length>200000)throw new Error('Document content exceeds 200 KB.');
  const paragraphs=input.paragraphs??[],headers=input.headers??[],rows=input.rows??[],slides=input.slides??[];
  if(!Array.isArray(paragraphs)||paragraphs.length>100||paragraphs.some(s=>typeof s!=='string'||s.length>10000))throw new Error('Invalid paragraphs.');
  if(!Array.isArray(headers)||headers.length>30||headers.some(s=>typeof s!=='string'||s.length>200))throw new Error('Invalid table headers.');
  if(!Array.isArray(rows)||rows.length>1000||rows.some(r=>!Array.isArray(r)||r.length>30||r.some(c=>typeof c!=='string'&&!(typeof c==='number'&&Number.isFinite(c))||String(c).length>2000)))throw new Error('Invalid table cells.');
  if(!Array.isArray(slides)||slides.length>30||slides.some(s=>!s||typeof s.title!=='string'||s.title.length>200||!Array.isArray(s.bullets)||s.bullets.length>15||s.bullets.some(b=>typeof b!=='string'||b.length>500)))throw new Error('Invalid slides.');
  return {...input,paragraphs,headers,rows,slides};
}
export async function renderDocument(raw){
  const p=validate(raw);
  if(p.format==='docx'){
    const children=[new Paragraph({text:p.title,heading:HeadingLevel.TITLE}),...p.paragraphs.map(text=>new Paragraph({text,spacing:{after:160}}))];
    const table=[...(p.headers.length?[p.headers]:[]),...p.rows];
    if(table.length)children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:table.map(row=>new TableRow({children:row.map(value=>new TableCell({children:[new Paragraph(String(value))]}))}))}));
    return Packer.toBuffer(new Document({sections:[{children}]}));
  }
  if(p.format==='xlsx'){
    const book=new ExcelJS.Workbook();book.creator='AI for Boss';const sheet=book.addWorksheet('Data');
    if(p.headers.length){sheet.addRow(p.headers);sheet.getRow(1).font={bold:true};}
    for(const row of p.rows)sheet.addRow(row);
    if(!p.headers.length&&!p.rows.length){sheet.addRow([p.title]);for(const text of p.paragraphs)sheet.addRow([text]);}
    sheet.columns.forEach(c=>{c.width=24;});
    // Explicit SUM only. Strings never become executable formulas or links.
    if(p.sumLastColumn===true&&p.rows.length){const column=Math.max(p.headers.length,...p.rows.map(r=>r.length));if(column){const address=sheet.getColumn(column).letter;const start=p.headers.length?2:1;const total=sheet.addRow([]);total.getCell(1).value='Tổng';total.getCell(column).value={formula:`SUM(${address}${start}:${address}${start+p.rows.length-1})`,result:p.rows.reduce((n,r)=>n+(typeof r[column-1]==='number'?r[column-1]:0),0)};}}
    return Buffer.from(await book.xlsx.writeBuffer());
  }
  if(p.format==='pptx'){
    const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='AI for Boss';pptx.subject=p.title;pptx.title=p.title;pptx.lang='vi-VN';
    const slides=p.slides.length?p.slides:[{title:p.title,bullets:p.paragraphs}];
    for(const item of slides){const slide=pptx.addSlide();slide.background={color:'F8F7F4'};slide.addText(item.title,{x:0.7,y:0.5,w:12,h:1,fontSize:30,bold:true,color:'855629',breakLine:false});slide.addText(item.bullets.map(text=>({text,options:{bullet:true,breakLine:true}})),{x:0.9,y:1.8,w:11.5,h:4.9,fontSize:20,color:'303030',paraSpaceAfterPt:14,fit:'shrink'});}
    return Buffer.from(await pptx.write({outputType:'nodebuffer'}));
  }
  const doc=new PDFDocument({font:fileURLToPath(new URL('./fonts/NotoSans.ttf',import.meta.url)),size:'A4',margin:48,info:{Title:p.title,Author:'AI for Boss'}});const chunks=[];
  const result=new Promise((resolve,reject)=>{doc.on('data',b=>chunks.push(b));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  doc.font(fileURLToPath(new URL('./fonts/NotoSans.ttf',import.meta.url))).fontSize(20).text(p.title).moveDown();
  doc.fontSize(11);for(const text of p.paragraphs)doc.text(text).moveDown();
  for(const row of [...(p.headers.length?[p.headers]:[]),...p.rows])doc.text(row.join('   |   ')).moveDown(0.35);
  doc.end();return result;
}
