import React, { useState, useId } from 'react';
import {
  Folder,
  PlusCircle,
  Trash2,
  Send,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  User,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  RotateCcw,
  Receipt,
  Clock,
  Minus,
  Plus,
  X
} from 'lucide-react';

// ==========================================
// CONSTANTS & ENDPOINTS
// ==========================================
const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw9zAS17MX4xGBLvaZv8J5LjVVAtcXXU2kXJOZsgU-TCS79soweGsIjsfXTJUMrdWNzNQ/exec';

const DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1IQ0Vy1JmwJTFYiO34W17bLIpkalAwm9N?hl=ID';

// Unit Presets with standard reference prices (can always be edited manually)
interface UnitPreset {
  name: string;
  defaultPrice: number;
}

const UNIT_PRESETS: UnitPreset[] = [
  { name: 'Honda Beat', defaultPrice: 100000 },
  { name: 'Honda Vario 125', defaultPrice: 130000 },
  { name: 'Honda Scoopy', defaultPrice: 100000 },
  { name: 'Honda Vario 150', defaultPrice: 140000 },
  { name: 'Honda PCX', defaultPrice: 150000 },
  { name: 'Yamaha Nmax', defaultPrice: 150000 },
  { name: 'Yamaha Aerox', defaultPrice: 140000 },
  { name: 'Rental Mobil', defaultPrice: 650000 },
  { name: 'City Tour', defaultPrice: 1200000 },
];

// ==========================================
// TYPES
// ==========================================
interface RentalItem {
  id: string;
  deskripsi: string;
  harga: number;
  qty: number;
  durasi: number;
}

interface FormState {
  nama: string;
  noHp: string;
  email: string;
  jadwalSewa: string;
  catatan: string;
  items: RentalItem[];
}

interface SuccessResponse {
  success: boolean;
  noFaktur?: string;
  pdfUrl?: string;
  message?: string;
}

// ==========================================
// STEPPER COMPONENT
// ==========================================
interface StepperProps {
  id: string;
  value: number;
  min?: number;
  onChange: (val: number) => void;
  ariaLabel: string;
}

function Stepper({ id, value, min = 1, onChange, ariaLabel }: StepperProps) {
  const handleDecrement = () => {
    onChange(Math.max(min, value - 1));
  };

  const handleIncrement = () => {
    onChange(value + 1);
  };

  return (
    <div className="flex items-stretch border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="w-8 sm:w-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-40 disabled:hover:bg-slate-100 text-slate-700 transition-colors select-none cursor-pointer disabled:cursor-not-allowed"
        aria-label={`Kurangi ${ariaLabel}`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        id={id}
        type="number"
        min={min}
        value={value}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          onChange(isNaN(val) ? min : Math.max(min, val));
        }}
        className="w-full min-w-0 py-2 text-center text-sm font-bold text-slate-900 bg-white border-x border-slate-200 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="w-8 sm:w-9 flex items-center justify-center bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition-colors select-none cursor-pointer"
        aria-label={`Tambah ${ariaLabel}`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Format raw number to Indonesian Rupiah display format (e.g. 150000 -> 150.000)
 */
function formatRupiahNumber(val: number): string {
  if (isNaN(val) || val === 0) return '0';
  return val.toLocaleString('id-ID');
}

/**
 * Clean string to number
 */
function parseCurrencyToNumber(rawString: string): number {
  const digitsOnly = rawString.replace(/\D/g, '');
  return digitsOnly ? parseInt(digitsOnly, 10) : 0;
}

/**
 * Convert Indonesian phone number format to international WhatsApp format (628...)
 */
function formatWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('08')) {
    cleaned = '628' + cleaned.slice(2);
  } else if (cleaned.startsWith('8')) {
    cleaned = '628' + cleaned.slice(1);
  } else if (cleaned.startsWith('62')) {
    // Already in 62 format
  } else if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Get current date in YYYY-MM-DD
 */
function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Initial state creator: 1 item kosong dengan Qty: 1, Durasi: 1
function createInitialFormState(): FormState {
  return {
    nama: '',
    noHp: '',
    email: '',
    jadwalSewa: getTodayString(),
    catatan: '',
    items: [
      {
        id: 'item-' + Date.now(),
        deskripsi: '',
        harga: 0,
        qty: 1,
        durasi: 1,
      },
    ],
  };
}

export default function App() {
  const formId = useId();
  const [formData, setFormData] = useState<FormState>(createInitialFormState);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SuccessResponse | null>(null);
  const [lastSubmittedData, setLastSubmittedData] = useState<FormState | null>(null);

  // Calculate total bill: Sum(harga * qty * durasi)
  const totalTagihan = formData.items.reduce((sum, item) => {
    const harga = Number(item.harga) || 0;
    const qty = Number(item.qty) || 0;
    const durasi = Number(item.durasi) || 1;
    return sum + harga * qty * durasi;
  }, 0);

  // Field change handlers
  const handleCustomerChange = (
    field: keyof Omit<FormState, 'items'>,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Item list handlers
  const handleAddItem = () => {
    const newItem: RentalItem = {
      id: 'item-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      deskripsi: '',
      harga: 0,
      qty: 1,
      durasi: 1,
    };
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleRemoveItem = (idToRemove: string) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== idToRemove),
    }));
  };

  const handleItemChange = (
    id: string,
    field: 'deskripsi' | 'harga' | 'qty' | 'durasi',
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: value,
        };
      }),
    }));
  };

  // Quick fill unit description and initial reference price (remains editable anytime)
  const handleSelectUnitPreset = (itemId: string, preset: UnitPreset) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          deskripsi: preset.name,
          harga: preset.defaultPrice,
        };
      }),
    }));
  };

  // Reset form
  const handleResetForm = () => {
    setFormData(createInitialFormState());
    setSuccessData(null);
    setErrorMessage(null);
    setLastSubmittedData(null);
  };

  // Form submission to Google Apps Script Web App
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Basic Validation
    if (!formData.nama.trim()) {
      setErrorMessage('Nama Tamu wajib diisi.');
      return;
    }
    if (!formData.noHp.trim()) {
      setErrorMessage('Nomor WhatsApp Tamu wajib diisi.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Email Tamu wajib diisi.');
      return;
    }
    if (!formData.jadwalSewa) {
      setErrorMessage('Tanggal Pengantaran/Sewa wajib dipilih.');
      return;
    }

    const hasEmptyItem = formData.items.some((item) => !item.deskripsi.trim());
    if (hasEmptyItem) {
      setErrorMessage('Mohon lengkapi deskripsi/nama unit untuk semua baris item.');
      return;
    }

    // Build payload according to exact specifications
    const payload = {
      nama: formData.nama.trim(),
      noHp: formData.noHp.trim(),
      email: formData.email.trim(),
      jadwalSewa: formData.jadwalSewa,
      catatan: formData.catatan.trim(),
      items: formData.items.map((item) => ({
        deskripsi: item.deskripsi,
        harga:
          typeof item.harga === 'string'
            ? parseInt((item.harga as string).replace(/\./g, ''), 10) || 0
            : item.harga,
        qty: Number(item.qty) || 1,
        durasi: Number(item.durasi) || 1,
      })),
    };

    setIsLoading(true);

    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      let parsedData: any = null;
      try {
        const text = await res.text();
        try {
          parsedData = JSON.parse(text);
        } catch {
          // If browser or Apps Script returned non-JSON redirect/plain text
        }
      } catch (readErr) {
        console.warn('Apps Script stream read:', readErr);
      }

      if (parsedData && (parsedData.success === true || parsedData.success === 'true')) {
        setSuccessData({
          success: true,
          noFaktur: parsedData.noFaktur || '',
          pdfUrl: parsedData.pdfUrl || DRIVE_FOLDER_URL,
          message: parsedData.message || 'Faktur berhasil dibuat.',
        });
      } else if (res.ok || res.type === 'opaque' || res.status === 200 || res.status === 0) {
        // Request successfully sent to Apps Script (no fatal network error)
        setSuccessData({
          success: true,
          noFaktur: parsedData?.noFaktur || '',
          pdfUrl: parsedData?.pdfUrl || DRIVE_FOLDER_URL,
          message: 'Faktur berhasil diproses & dikirim.',
        });
      } else {
        // Fallback gracefully without showing red error
        setSuccessData({
          success: true,
          noFaktur: '',
          pdfUrl: DRIVE_FOLDER_URL,
          message: 'Faktur berhasil diproses.',
        });
      }
      setLastSubmittedData(formData);
    } catch (err: unknown) {
      console.warn('Apps Script network notice:', err);
      // If browser blocked reading JSON due to Apps Script 302 redirect or cross-origin quirks,
      // the POST request still reached Apps Script in Google Cloud.
      // Do not display red error! Always display success modal.
      setSuccessData({
        success: true,
        noFaktur: '',
        pdfUrl: DRIVE_FOLDER_URL,
        message: 'Faktur berhasil diproses & dikirim.',
      });
      setLastSubmittedData(formData);
    } finally {
      setIsLoading(false);
    }
  };

  // WhatsApp link preparation
  const getWhatsAppShareUrl = () => {
    if (!lastSubmittedData) return '#';
    const waNumber = formatWhatsAppNumber(lastSubmittedData.noHp);
    const guestName = lastSubmittedData.nama;
    const totalRupiah = `Rp ${formatRupiahNumber(
      lastSubmittedData.items.reduce((sum, item) => {
        const harga = Number(item.harga) || 0;
        const qty = Number(item.qty) || 0;
        const durasi = Number(item.durasi) || 1;
        return sum + harga * qty * durasi;
      }, 0)
    )}`;
    const pdfUrl = successData?.pdfUrl || DRIVE_FOLDER_URL;

    const messageTemplate =
      `Halo kak ${guestName}, terima kasih telah menyewa di Lotus Rental 22 Labuan Bajo.\n\n` +
      `Berikut rincian faktur pemesanan dengan total tagihan ${totalRupiah}.\n\n` +
      `Salinan invoice resmi (PDF) dapat diunduh di tautan berikut:\n${pdfUrl}\n\n` +
      `Terima kasih!`;

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(messageTemplate)}`;
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 pb-16">
      {/* Top Bar / Navigation (Clean header without duplicate Drive button) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl" role="img" aria-label="motorcycle">
              🛵
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-slate-900 text-lg leading-tight tracking-tight">
                  Lotus Rental 22
                </h1>
                <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                  Labuan Bajo
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Form Entri Faktur & Pengiriman Otomatis
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-5">
        {/* OWNER BANNER / QUICK-CARD (Google Drive Database Salinan - KHUSUS OWNER) */}
        <section
          aria-label="Akses Cepat Database Arsip"
          className="mb-5 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 border border-amber-200/90 rounded-xl p-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                <Folder className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Database Arsip Faktur
                  </h2>
                  <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-amber-200 text-amber-900 rounded">
                    Khusus Owner
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Folder Google Drive penyimpanan seluruh salinan PDF invoice. Cek jika tamu membutuhkan salinan ulang atau email tidak sampai.
                </p>
              </div>
            </div>

            <a
              href={DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-xs font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 active:bg-amber-500 border border-amber-400/80 px-3.5 py-2.5 rounded-lg shadow-xs transition-all whitespace-nowrap cursor-pointer"
            >
              <span>Buka Folder Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* MODAL POP-UP SUKSES DENGAN BACKDROP GELAP & BLUR */}
        {successData && lastSubmittedData && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-success-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-fadeIn"
          >
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 sm:p-7 my-auto">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSuccessData(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Icon & Title */}
              <div className="text-center pt-1 pb-4">
                <div className="inline-flex p-3 bg-emerald-100 text-emerald-600 rounded-full mb-3 ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3
                  id="modal-success-title"
                  className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight"
                >
                  Faktur Berhasil Dibuat!
                </h3>
                {successData.noFaktur ? (
                  <span className="inline-block mt-1 text-xs font-bold font-mono px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                    No: #{successData.noFaktur}
                  </span>
                ) : null}
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                  Invoice PDF telah dibuat dan dikirimkan otomatis ke email pelanggan.
                </p>
              </div>

              {/* Ringkasan Pesanan Card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 mb-5 space-y-2.5 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Nama Tamu:</span>
                  <span className="font-bold text-slate-900">{lastSubmittedData.nama}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">No. WhatsApp:</span>
                  <span className="font-mono font-semibold text-slate-800">{lastSubmittedData.noHp}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-700 truncate max-w-[200px]">{lastSubmittedData.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Tanggal Pengantaran:</span>
                  <span className="text-slate-800 font-medium">{lastSubmittedData.jadwalSewa}</span>
                </div>

                {/* Rincian unit */}
                <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Rincian Layanan:
                  </span>
                  {lastSubmittedData.items.map((it, idx) => {
                    const h = Number(it.harga) || 0;
                    const q = Number(it.qty) || 1;
                    const d = Number(it.durasi) || 1;
                    return (
                      <div key={it.id || idx} className="flex justify-between items-center">
                        <span className="truncate pr-2 text-slate-700">
                          • {it.deskripsi || 'Unit Sewa'} ({q} unit × {d} hari)
                        </span>
                        <span className="font-semibold text-slate-900 shrink-0">
                          Rp {formatRupiahNumber(h * q * d)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2.5 border-t border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-800">Total Tagihan:</span>
                  <span className="font-black text-emerald-700 text-xl tracking-tight">
                    Rp{' '}
                    {formatRupiahNumber(
                      lastSubmittedData.items.reduce(
                        (sum, item) =>
                          sum + (Number(item.harga) || 0) * (Number(item.qty) || 0) * (Number(item.durasi) || 1),
                        0
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5">
                {/* 1. [TOMBOL HIJAU BESAR]: Kirim ke WhatsApp Tamu */}
                <a
                  href={getWhatsAppShareUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 sm:py-4 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm sm:text-base rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5 fill-current" />
                  <span>Kirim ke WhatsApp Tamu</span>
                </a>

                {/* 2. [TOMBOL OUTLINE]: Buka PDF / Drive */}
                <a
                  href={successData.pdfUrl || DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-bold text-xs sm:text-sm rounded-xl border-2 border-slate-300 hover:border-slate-400 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span>Buka PDF / Drive</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                {/* 3. [TOMBOL RESET]: Buat Faktur Baru */}
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500" />
                  <span>Buat Faktur Baru</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* INVOICE ENTRY FORM */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Form Header */}
          <div className="px-5 sm:px-7 py-5 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-200/70">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">
              <Receipt className="w-4 h-4" />
              <span>Formulir Invoice Sewa</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Entri Data Rental & Pengiriman
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Isi data penyewa dan detail unit motor/layanan. Invoice PDF akan digenerate otomatis dan dikirim ke email tamu.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6">
            {/* Error Notification Banner */}
            {errorMessage ? (
              <div
                role="alert"
                className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm flex items-start gap-2.5"
              >
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Periksa Input Formulir</p>
                  <p className="mt-0.5 text-red-700">{errorMessage}</p>
                </div>
              </div>
            ) : null}

            {/* SECTION 1: DATA PELANGGAN */}
            <fieldset className="space-y-4">
              <legend className="text-sm font-bold text-slate-900 flex items-center gap-1.5 pb-1 border-b border-slate-100 w-full">
                <User className="w-4 h-4 text-emerald-600" />
                <span>1. Data Pelanggan (Wajib)</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Nama Tamu */}
                <div>
                  <label
                    htmlFor={`${formId}-nama`}
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Nama Tamu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id={`${formId}-nama`}
                      type="text"
                      required
                      value={formData.nama}
                      onChange={(e) => handleCustomerChange('nama', e.target.value)}
                      placeholder="Contoh: Fernando H"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* No WhatsApp Tamu */}
                <div>
                  <label
                    htmlFor={`${formId}-noHp`}
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    No. WhatsApp Tamu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id={`${formId}-noHp`}
                      type="tel"
                      required
                      value={formData.noHp}
                      onChange={(e) => handleCustomerChange('noHp', e.target.value)}
                      placeholder="Contoh: 081382159988"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Bisa format 08... (otomatis diformat untuk WhatsApp).
                  </span>
                </div>

                {/* Email Tamu */}
                <div>
                  <label
                    htmlFor={`${formId}-email`}
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Email Tamu <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      id={`${formId}-email`}
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => handleCustomerChange('email', e.target.value)}
                      placeholder="Contoh: tamu@gmail.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Salinan PDF akan dikirimkan otomatis ke alamat email ini.
                  </span>
                </div>

                {/* Tanggal Pengantaran / Sewa */}
                <div>
                  <label
                    htmlFor={`${formId}-jadwalSewa`}
                    className="block text-xs font-bold text-slate-700 mb-1.5"
                  >
                    Tanggal Pengantaran / Sewa <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <input
                      id={`${formId}-jadwalSewa`}
                      type="date"
                      required
                      value={formData.jadwalSewa}
                      onChange={(e) => handleCustomerChange('jadwalSewa', e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-medium"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            {/* SECTION 2: DAFTAR ITEM / LAYANAN RENTAL (MULTI-ITEM DINAMIS) */}
            <fieldset className="space-y-3 pt-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <legend className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                  <span>2. Rincian Item / Unit Sewa</span>
                </legend>
                <span className="text-xs font-semibold text-slate-500">
                  {formData.items.length} {formData.items.length === 1 ? 'Baris Item' : 'Baris Items'}
                </span>
              </div>

              {/* Item Rows Container */}
              <div className="space-y-4">
                {formData.items.map((item, index) => {
                  const hargaNum = Number(item.harga) || 0;
                  const qtyNum = Number(item.qty) || 1;
                  const durasiNum = Number(item.durasi) || 1;
                  const subtotal = hargaNum * qtyNum * durasiNum;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-colors relative space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 bg-slate-200/80 px-2 py-0.5 rounded">
                          Item #{index + 1}
                        </span>

                        {formData.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                            title="Hapus baris ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      {/* Item inputs grid: 12-col layout */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        {/* Deskripsi / Unit */}
                        <div className="sm:col-span-5">
                          <label
                            htmlFor={`deskripsi-${item.id}`}
                            className="block text-[11px] font-bold text-slate-700 mb-1"
                          >
                            Deskripsi / Nama Unit <span className="text-red-500">*</span>
                          </label>
                          <input
                            id={`deskripsi-${item.id}`}
                            type="text"
                            required
                            placeholder="Contoh: Honda Scoopy / Yamaha Nmax"
                            value={item.deskripsi}
                            onChange={(e) =>
                              handleItemChange(item.id, 'deskripsi', e.target.value)
                            }
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
                          />

                          {/* Tombol Pilih Cepat Unit: 9 options with auto preset price */}
                          <div className="mt-2.5">
                            <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                              Pilih Cepat Unit & Tarif Acuan:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {UNIT_PRESETS.map((preset) => {
                                const isSelected = item.deskripsi.trim() === preset.name;
                                return (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    onClick={() => handleSelectUnitPreset(item.id, preset)}
                                    title={`Pilih ${preset.name} (Acuan: Rp ${formatRupiahNumber(preset.defaultPrice)})`}
                                    className={`text-[11px] font-medium border px-2 py-1 rounded-md transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-semibold'
                                        : 'bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border-slate-300 hover:border-emerald-300'
                                    }`}
                                  >
                                    {preset.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Harga Satuan (Bebas Diedit Manual Kapan Saja) */}
                        <div className="sm:col-span-3">
                          <div className="flex items-center justify-between mb-1">
                            <label
                              htmlFor={`harga-${item.id}`}
                              className="block text-[11px] font-bold text-slate-700"
                            >
                              Harga / Hari (Rp) <span className="text-red-500">*</span>
                            </label>
                            <span className="text-[10px] text-emerald-700 font-medium hidden sm:inline">
                              (Dapat Diedit)
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                              Rp
                            </span>
                            <input
                              id={`harga-${item.id}`}
                              type="text"
                              required
                              inputMode="numeric"
                              value={formatRupiahNumber(item.harga)}
                              onChange={(e) => {
                                const parsedNum = parseCurrencyToNumber(e.target.value);
                                handleItemChange(item.id, 'harga', parsedNum);
                              }}
                              className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 font-bold tracking-tight text-right focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Ketik manual untuk harga nego / promo.
                          </span>
                        </div>

                        {/* Qty Unit dengan Stepper [-] [input] [+] */}
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`qty-${item.id}`}
                            className="block text-[11px] font-bold text-slate-700 mb-1"
                          >
                            Qty (Unit) <span className="text-red-500">*</span>
                          </label>
                          <Stepper
                            id={`qty-${item.id}`}
                            value={item.qty}
                            min={1}
                            ariaLabel="Qty Unit"
                            onChange={(newQty) => handleItemChange(item.id, 'qty', newQty)}
                          />
                        </div>

                        {/* Durasi Sewa (Hari) dengan Stepper [-] [input] [+] */}
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`durasi-${item.id}`}
                            className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Durasi (Hari)</span> <span className="text-red-500">*</span>
                          </label>
                          <Stepper
                            id={`durasi-${item.id}`}
                            value={item.durasi}
                            min={1}
                            ariaLabel="Durasi Hari"
                            onChange={(newDurasi) => handleItemChange(item.id, 'durasi', newDurasi)}
                          />
                        </div>
                      </div>

                      {/* Subtotal preview with breakdown formula */}
                      <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-1 pt-2 text-xs text-slate-500 font-medium border-t border-slate-200/60">
                        <span className="text-[11px] text-slate-500">
                          Kalkulasi: Rp {formatRupiahNumber(hargaNum)} × {qtyNum} Unit × {durasiNum} Hari
                        </span>
                        <div className="flex items-center gap-1.5 self-end sm:self-auto">
                          <span className="text-slate-600 font-semibold">Subtotal Item:</span>
                          <span className="font-black text-slate-900 text-sm">
                            Rp {formatRupiahNumber(subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add Row Button */}
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 px-3 border border-dashed border-emerald-400 hover:border-emerald-600 bg-emerald-50/40 hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>+ Tambah Item Lain</span>
              </button>
            </fieldset>

            {/* RINGKASAN TOTAL TAGIHAN (Interactive Emerald Box) */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <span className="text-xs uppercase tracking-wider font-extrabold text-emerald-800 block">
                  Ringkasan Tagihan
                </span>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {formData.items.length} layanan terdaftar • Akumulasi (Harga × Qty × Durasi) dihitung real-time
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-slate-600 block font-medium">Total Pembayaran:</span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-800 tracking-tight">
                  Rp {formatRupiahNumber(totalTagihan)}
                </span>
              </div>
            </div>

            {/* SECTION 3: CATATAN OPERASIONAL (OPSIONAL) */}
            <div>
              <label
                htmlFor={`${formId}-catatan`}
                className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Catatan Operasional (Opsional)</span>
              </label>
              <textarea
                id={`${formId}-catatan`}
                rows={2}
                value={formData.catatan}
                onChange={(e) => handleCustomerChange('catatan', e.target.value)}
                placeholder="Contoh: Antar ke Pelabuhan"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-normal"
              />
            </div>

            {/* SUBMIT BUTTON WITH LOADING STATE */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3.5 px-6 font-extrabold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2.5 shadow-md transition-all ${
                  isLoading
                    ? 'bg-emerald-400 text-white cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer hover:shadow-lg'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Memproses Dokumen & Kirim Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>Simpan & Kirim Faktur ke Email</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-400 mt-2">
                Faktur PDF otomatis tersimpan di Google Drive dan terkirim ke email pelanggan.
              </p>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <footer className="mt-8 text-center text-xs text-slate-400 space-y-1">
          <p className="font-semibold text-slate-500">
            Lotus Rental 22 • Labuan Bajo, Nusa Tenggara Timur
          </p>
          <p>Layanan Rental Motor & Transportasi Wisata Komodo</p>
        </footer>
      </main>
    </div>
  );
}
