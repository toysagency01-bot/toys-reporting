import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fontSource from './fonts/open-sans.txt';
import {totals} from './model.js';
export const labels={en:{invoice:'INVOICE',from:'From',to:'Bill to',date:'Invoice date',due:'Due date',description:'Description',quantity:'Qty',price:'Unit price',amount:'Amount',subtotal:'Subtotal',discount:'Discount',tax:'Tax',total:'Total due',payment:'Payment details',notes:'Notes',paid:'PAID',void:'CANCELLED'},ru:{invoice:'ИНВОЙС',from:'Отправитель',to:'Получатель',date:'Дата выставления',due:'Оплатить до',description:'Услуга / описание',quantity:'Кол-во',price:'Цена',amount:'Сумма',subtotal:'Подытог',discount:'Скидка',tax:'Налог',total:'К оплате',payment:'Реквизиты оплаты',notes:'Примечания',paid:'ОПЛАЧЕН',void:'ОТМЕНЁН'}};
export async function invoicePDF(invoice){
 const d=invoice.data,l=labels[d.language],t=totals(d),pdf=await PDFDocument.create();pdf.registerFontkit(fontkit);
 const font=await pdf.embedFont(Uint8Array.from(atob(fontSource.trim()),c=>c.charCodeAt(0)),{subset:true});
 pdf.setTitle(l.invoice+' '+invoice.number);pdf.setSubject('Invoice');pdf.setCreator('TOYS Agency Platform');
 const ink=rgb(.10,.15,.19),muted=rgb(.38,.43,.47),accent=rgb(0,.46,.43);let page,y;
 const newPage=()=>{page=pdf.addPage([595.28,841.89]);y=794;};newPage();
 const draw=(text,x,top,size=10,color=ink)=>page.drawText(String(text),{x,y:top-size,font,size,color});
 const right=(text,x,top,size=10)=>draw(text,x-font.widthOfTextAtSize(String(text),size),top,size);
 function wrap(text,width,size=10){
  const out=[];for(const paragraph of String(text).replace(/\r/g,'').split('\n')){
   let line='';for(const ch of paragraph){if(line&&font.widthOfTextAtSize(line+ch,size)>width){const last=line.lastIndexOf(' ');if(last>line.length/2){out.push(line.slice(0,last));line=line.slice(last+1)+ch;}else{out.push(line);line=ch;}}else line+=ch;}out.push(line);
  }return out;
 }
 const ensure=h=>{if(y-h<55)newPage();};
 const paragraph=(text,width=505,size=10)=>{for(const line of wrap(text,width,size)){ensure(size+5);draw(line,45,y,size);y-=size+5;}};
 draw(l.invoice,45,y,28,accent);right(invoice.number,550,y+1,13);y-=46;
 draw(l.date+': '+d.date,45,y);right(l.due+': '+d.dueDate,550,y);y-=25;
 if(['paid','void'].includes(d.status)){draw(l[d.status],45,y,12,accent);y-=25;}
 const left=wrap(d.issuer,235),rightLines=wrap(d.customer,235);draw(l.from.toUpperCase(),45,y,9,muted);draw(l.to.toUpperCase(),310,y,9,muted);y-=18;
 // Long requisites flow normally rather than running through the item table.
 if(Math.max(left.length,rightLines.length)>25){paragraph(d.issuer);y-=12;paragraph(l.to+':\n'+d.customer);}
 else{for(let i=0;i<Math.max(left.length,rightLines.length);i++){if(left[i])draw(left[i],45,y);if(rightLines[i])draw(rightLines[i],310,y);y-=15;}}
 y-=26;
 function tableHeader(){ensure(40);page.drawRectangle({x:45,y:y-24,width:505,height:28,color:rgb(.94,.97,.97)});draw(l.description,53,y-4,9);right(l.quantity,387,y-4,9);right(l.price,466,y-4,9);right(l.amount,542,y-4,9);y-=37;}
 tableHeader();
 for(const line of t.lines){const description=wrap(line.description,305);for(let i=0;i<description.length;i++){if(y<75){newPage();tableHeader();}draw(description[i],53,y);if(i===0){right(line.quantity,387,y);right(line.price,466,y);right(line.total,542,y);}y-=15;}y-=12;}
 ensure(130);y-=8;
 for(const [label,value]of [[l.subtotal,t.subtotal],...(Number(t.discount)?[[l.discount+' ('+d.discount+'%)','−'+t.discount]]:[]),...(Number(t.tax)?[[l.tax+' ('+d.tax+'%)',t.tax]]:[])]){draw(label,310,y,10,muted);right(value+' '+d.currency,550,y);y-=21;}
 y-=5;draw(l.total,310,y,13,accent);right(t.total+' '+d.currency,550,y,13);y-=42;
 for(const [title,text]of [[l.payment,d.payment],[l.notes,d.notes]])if(text){ensure(45);draw(title.toUpperCase(),45,y,9,muted);y-=19;paragraph(text);y-=20;}
 const pages=pdf.getPages();for(let i=0;i<pages.length;i++)pages[i].drawText(`${i+1} / ${pages.length}`,{x:520,y:27,font,size:8,color:muted});
 return pdf.save();
}
