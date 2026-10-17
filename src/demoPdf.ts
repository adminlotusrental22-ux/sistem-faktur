import {jsPDF} from 'jspdf';
import {type InvoiceForm,BASES,rupiah,itemSubtotal,invoiceTotal} from './billing';
import logoUrl from './assets/invoice/image1.png?url';
import signatureUrl from './assets/invoice/image2.png?url';
import regularUrl from './assets/invoice/PlusJakartaSans-Regular.ttf?url';
import boldUrl from './assets/invoice/PlusJakartaSans-Bold.ttf?url';

function base64(bytes:Uint8Array):string {
  let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(value);
}
let cachedAssets:Promise<Uint8Array[]>|null=null;
function assets(){
  if(!cachedAssets)cachedAssets=Promise.all([logoUrl,signatureUrl,regularUrl,boldUrl].map(async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error('Aset template invoice gagal dimuat.');return new Uint8Array(await response.arrayBuffer());
  })).catch(error=>{cachedAssets=null;throw error;});
  return cachedAssets;
}

// Local rendering mirrors the existing Docs template. Operational PDFs still
// come from the original Google Docs file, preserving its own layout engine.
export async function createDemoPdf(form:InvoiceForm):Promise<Blob>{
  const en=form.bahasaInvoice==='en';
  const t=(id:string,english:string)=>en?english:id;
  const service=(name:string)=>en?({'Antar':'Delivery','Jemput':'Collection','Antar & jemput':'Delivery & collection','Biaya lain':'Additional charge','City Tour Privat':'Private City Tour','Tour per Orang':'Tour per person','Rental Mobil':'Car rental','Transfer / Antar-jemput':'Transfer / shuttle'}[name]||name):name;
  const [logo,signature,regular,bold]=await assets();
  const doc=new jsPDF({unit:'pt',format:'letter',compress:true});
  doc.addFileToVFS('Jakarta-Regular.ttf',base64(regular));doc.addFont('Jakarta-Regular.ttf','Jakarta','normal');
  doc.addFileToVFS('Jakarta-Bold.ttf',base64(bold));doc.addFont('Jakarta-Bold.ttf','Jakarta','bold');
  doc.setProperties({title:'Preview Faktur - Lotus Rental 22',subject:'Preview lokal sebelum pengiriman',author:'Lotus Rental 22'});
  const issued=new Intl.DateTimeFormat(en?'en-GB':'id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Makassar'}).format(new Date());
  const left=45,right=598.5,bottom=750;
  let y=0;
  function font(size=10.5,weight:'normal'|'bold'='normal'){doc.setFont('Jakarta',weight);doc.setFontSize(size);doc.setTextColor(0,0,0);}
  function at(text:string,x:number,baseline:number,size=10.5,weight:'normal'|'bold'='normal'){font(size,weight);doc.text(text,x,baseline);}
  function page(){doc.addPage();at(t('FAKTUR/INVOICE','INVOICE'),left,45,15,'bold');at(t('Lotus Rental 22 · Lanjutan','Lotus Rental 22 · Continued'),left,64,9);y=90;}
  function need(height:number){if(y+height>bottom)page();}
  function paragraph(value:string,width=522,x=left,size=10.5,spacing=14){
    font(size);const lines:string[]=doc.splitTextToSize(value,width);
    for(const line of lines){need(spacing);at(line,x,y,size);y+=spacing;}
  }
  function cell(value:string,x:number,baseline:number,width:number){font();const size=Math.min(10.5,10.5*width/Math.max(doc.getTextWidth(value),width));at(value,x,baseline,size);}
  function tableHeader(){doc.setFillColor(217,217,217);doc.rect(left,y-15,right-left,23.25,'F');at(t('Rincian Layanan & Unit','Services & Items'),50.25,y);at(t('Harga (Rp)','Rate (IDR)'),289.5,y);at(t('Kuantitas','Quantity'),382.5,y);at(t('Jumlah (Rp)','Amount (IDR)'),478.5,y);y+=26;}
  function row(description:string,price:number,qty:number,subtotal:number){
    font();const lines:string[]=doc.splitTextToSize(description,228);const height=Math.max(24,lines.length*14+9);
    if(y+height>bottom-30){page();tableHeader();}
    lines.forEach((line,i)=>at(line,50.25,y+i*14));
    cell(rupiah(price),289.5,y,82);cell(String(qty),382.5,y,84);cell(rupiah(subtotal),478.5,y,115);y+=height;
  }
  // Header, logo, typography and signature are taken from the user's template.
  at(t('FAKTUR/INVOICE','INVOICE'),left,57,18,'bold');
  doc.addImage(logo,'PNG',480,21.75,99.75,99.75);
  at('LOTUS RENTAL 22',left,91,11,'bold');font(11,'bold');const companyWidth=doc.getTextWidth('LOTUS RENTAL 22');
  at(t(' - Rental Motor dan Mobil',' - Motorcycle and Car Rental'),left+companyWidth,91,11);
  ['Waemata, Gorontalo, Labuan Bajo','Labuan Bajo, Nusa Tenggara Timur 86754, Indonesia','082214299174','lotusrental22@gmail.com'].forEach((line,i)=>at(line,left,107+i*15.9,11));
  at(t('Ditagih Kepada','Bill To'),50.25,204,10.5,'bold');
  font();const nameLines:string[]=doc.splitTextToSize(form.nama,290),phoneLines:string[]=doc.splitTextToSize(form.noHp,290);
  let customerY=227;for(const line of nameLines){at(line,50.25,customerY);customerY+=14;}customerY+=9;
  for(const line of phoneLines){at(line,50.25,customerY);customerY+=14;}
  at(t('Faktur Nomor','Invoice No.'),382.5,204,10.5,'bold');at('PREVIEW',478.5,204);
  at(t('Diterbitkan','Issue Date'),382.5,227,10.5,'bold');at(issued,478.5,227,10);
  at(t('Jadwal Sewa/','Rental /'),382.5,250,10.5,'bold');at(t('Pengantaran','Service Date'),382.5,263,10.5,'bold');at(form.jadwalSewa,478.5,250);
  y=Math.max(305,customerY+28);tableHeader();
  for(const item of form.items){const basis=en?({harian:'per unit / day',paket:'per package',perjalanan:'per trip',orang:'per person',unit:'per unit (one-off)'})[item.basis]:BASES[item.basis].label.toLowerCase();const description=item.basis==='harian'?`${service(item.deskripsi)} (${item.durasi} ${t('Hari',item.durasi===1?'day':'days')})`:`${service(item.deskripsi)} (${basis})`;row(description,item.harga,item.qty,itemSubtotal(item));}
  for(const charge of form.biayaTambahan)row(`${service(charge.deskripsi)} (${t('sekali','one-off')})`,charge.harga,charge.qty,charge.harga*charge.qty);
  need(35);y+=4;at(form.statusPembayaran==='lunas'?t('Total tagihan (lunas)','Invoice total (paid)'):t('Jumlah yang harus dibayar','Total amount due'),289.5,y);cell(rupiah(invoiceTotal(form)),478.5,y,115);y+=38;
  if(form.catatan.trim()){paragraph(`${t('Catatan','Notes')}: ${form.catatan}`);y+=14;}
  need(45);
  if(form.statusPembayaran==='lunas'){
    at(t('SUDAH LUNAS. TERIMA KASIH','PAID IN FULL. THANK YOU'),left,y,11,'bold');y+=18;
    paragraph(t('Sisa pembayaran: Rp 0','Balance due: Rp 0'));y+=8;
  }else{paragraph(t('Status pembayaran: BELUM LUNAS','Payment status: UNPAID'));y+=8;}
  // Keep payment instructions and the signature together whenever possible.
  need(217);paragraph(form.statusPembayaran==='lunas'?t('Informasi Pembayaran','Payment Information'):t('Instruksi Pembayaran','Payment Instructions'));y+=12;
  paragraph('Bank : BRI',522,left,10.5,12.6);
  paragraph(t('Nomor rekening','Account number')+' : 383501038979532',522,left,10.5,12.6);
  paragraph(t('Nama pemilik rekening','Account holder')+' : SIDIK BADAWY ALGHOZALY',522,left,10.5,12.6);
  y+=24;paragraph(form.statusPembayaran==='lunas'?t('Pembayaran telah diterima. Terima kasih telah menggunakan layanan Lotus Rental 22, semoga perjalanan Anda menyenangkan!','Payment received. Thank you for choosing Lotus Rental 22. We wish you a pleasant journey!'):t('Pemesanan unit sah setelah pembayaran kami konfirmasi. Terima kasih telah menggunakan layanan Lotus Rental 22, semoga perjalanan Anda menyenangkan!','Your booking is confirmed once payment has been verified. Thank you for choosing Lotus Rental 22. We wish you a pleasant journey!'),522,left,10.5,12.6);
  y+=13;paragraph('Lotus Rental 22');
  need(75);doc.addImage(signature,'PNG',46.5,y-3,99.75,52.5);y+=62;at(issued,left,y);
  return doc.output('blob');
}
