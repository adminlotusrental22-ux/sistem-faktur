export type BillingBasis = 'harian' | 'paket' | 'perjalanan' | 'orang' | 'unit';
export const BASES: Record<BillingBasis, { label: string; quantity: string; rate: string }> = {
  harian: { label: 'Per unit / hari', quantity: 'unit', rate: 'unit / hari' },
  paket: { label: 'Per paket', quantity: 'paket', rate: 'paket' },
  perjalanan: { label: 'Per perjalanan', quantity: 'perjalanan', rate: 'perjalanan' },
  orang: { label: 'Per orang', quantity: 'orang', rate: 'orang' },
  unit: { label: 'Per unit (sekali)', quantity: 'unit', rate: 'unit' },
};
export interface InvoiceItem { id: string; deskripsi: string; harga: number; qty: number; durasi: number; basis: BillingBasis; }
export interface Charge { id: string; deskripsi: string; harga: number; qty: number; }
export interface InvoiceForm { bahasaInvoice: 'id' | 'en'; statusPembayaran: 'belum_lunas' | 'lunas'; nama: string; noHp: string; email: string; jadwalSewa: string; catatan: string; items: InvoiceItem[]; biayaTambahan: Charge[]; }
export const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
export const itemSubtotal = (i: InvoiceItem) => i.harga * i.qty * (i.basis === 'harian' ? i.durasi : 1);
export const rentalSubtotal = (f: InvoiceForm) => f.items.reduce((sum, i) => sum + itemSubtotal(i), 0);
export const extraSubtotal = (f: InvoiceForm) => f.biayaTambahan.reduce((sum, i) => sum + i.harga * i.qty, 0);
export const invoiceTotal = (f: InvoiceForm) => rentalSubtotal(f) + extraSubtotal(f);
export const calculation = (i: InvoiceItem) => `${rupiah(i.harga)} × ${i.qty} ${BASES[i.basis].quantity}${i.basis === 'harian' ? ` × ${i.durasi} hari` : ''}`;
export const newItem = (): InvoiceItem => ({id: crypto.randomUUID(), deskripsi: '', harga: 0, qty: 1, durasi: 1, basis: 'harian'});
export function initialForm(): InvoiceForm {
  const date = new Date();
  return {bahasaInvoice:'id', statusPembayaran:'belum_lunas', nama:'', noHp:'', email:'', jadwalSewa: `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`, catatan:'', items:[newItem()], biayaTambahan:[]};
}
export function validateForm(f: InvoiceForm): string | null {
  if (!['id','en'].includes(f.bahasaInvoice)) return 'Pilih bahasa invoice.';
  if (!['lunas','belum_lunas'].includes(f.statusPembayaran)) return 'Pilih status pembayaran.';
  if (!f.nama.trim() || !f.noHp.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) || !/^\d{4}-\d{2}-\d{2}$/.test(f.jadwalSewa)) return 'Lengkapi nama, WhatsApp, email yang valid, dan tanggal layanan.';
  if (!f.items.length || f.items.length > 100 || f.biayaTambahan.length > 100) return 'Isi 1–100 layanan dan maksimal 100 biaya tambahan.';
  for (const i of [...f.items, ...f.biayaTambahan]) {
    if (!i.deskripsi.trim() || !Number.isSafeInteger(i.harga) || i.harga < 0 || !Number.isSafeInteger(i.qty) || i.qty < 1) return 'Nama layanan/biaya, harga, dan jumlah harus valid. Gunakan angka bulat positif; harga boleh nol.';
  }
  if (f.items.some(i => !BASES[i.basis] || (i.basis === 'harian' && (!Number.isSafeInteger(i.durasi) || i.durasi < 1))) || !Number.isSafeInteger(invoiceTotal(f))) return 'Periksa dasar tarif, durasi, dan total invoice.';
  return null;
}
export function payloadFor(f: InvoiceForm) {
  return {schemaVersion:3, bahasaInvoice:f.bahasaInvoice, statusPembayaran:f.statusPembayaran, nama:f.nama.trim(), noHp:f.noHp.trim(), email:f.email.trim(), jadwalSewa:f.jadwalSewa, catatan:f.catatan.trim(),
    items:f.items.map(({deskripsi,harga,qty,durasi,basis})=>({deskripsi:deskripsi.trim(),harga,qty,durasi:basis==='harian'?durasi:1,basis})),
    biayaTambahan:f.biayaTambahan.map(({deskripsi,harga,qty})=>({deskripsi:deskripsi.trim(),harga,qty}))};
}
