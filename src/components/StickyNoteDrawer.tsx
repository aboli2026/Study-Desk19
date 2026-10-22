import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Trash2,
  Check,
  Bold,
  Palette,
  Clock,
  FileText,
  Bookmark,
  Image as ImageIcon,
  Upload,
  Maximize2,
  Loader2,
  ZoomIn,
  Sparkles,
} from 'lucide-react';
import { StickyNoteItem } from '../types';
import { cleanPastedMarkdown, hasMarkdownArtifacts } from '../utils/textCleaner';

interface StickyNoteDrawerProps {
  note: StickyNoteItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (note: StickyNoteItem) => void;
  onDelete: (id: string) => void;
}

const PRESET_COLORS = [
  { bg: '#fef08a', text: '#713f12', name: 'زرد کلاسیک' },
  { bg: '#bbf7d0', text: '#14532d', name: 'سبز نعنایی' },
  { bg: '#fed7aa', text: '#7c2d12', name: 'هلویی' },
  { bg: '#bae6fd', text: '#0c4a6e', name: 'آبی آسمانی' },
  { bg: '#e9d5ff', text: '#581c87', name: 'بنفش اسطوخودوس' },
  { bg: '#fecdd3', text: '#881337', name: 'صورتی ملایم' },
  { bg: '#f3f4f6', text: '#1f2937', name: 'خاکستری مینیمال' },
];

/**
 * Optimizes and compresses attached image to lightweight base64 Data URL
 */
function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const StickyNoteDrawer: React.FC<StickyNoteDrawerProps> = ({
  note,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#fef08a');
  const [textColor, setTextColor] = useState('#713f12');
  const [isBold, setIsBold] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cleanedNotice, setCleanedNotice] = useState<string | null>(null);

  const triggerCleanNotice = (msg = 'علائم اضافی مارک‌داون (## و ...) خودکار پاکسازی شدند') => {
    setCleanedNotice(msg);
    setTimeout(() => setCleanedNotice(null), 3000);
  };

  const handleCleanContent = () => {
    const newContent = cleanPastedMarkdown(content);
    const newTitle = cleanPastedMarkdown(title).replace(/\n/g, ' ').trim();
    setContent(newContent);
    setTitle(newTitle);
    triggerCleanNotice('علائم اضافی (مانند ##) با موفقیت پاکسازی شدند');
  };

  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            return;
          }
        }
      }
    }

    const pastedText = e.clipboardData?.getData('text/plain');
    if (pastedText && hasMarkdownArtifacts(pastedText)) {
      e.preventDefault();
      const cleaned = cleanPastedMarkdown(pastedText);
      const target = e.currentTarget;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const val = target.value;
      const updated = val.substring(0, start) + cleaned + val.substring(end);
      setContent(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + cleaned.length;
      }, 0);
      triggerCleanNotice();
    }
  };

  const handleTitlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData?.getData('text/plain');
    if (pastedText && (pastedText.includes('#') || hasMarkdownArtifacts(pastedText))) {
      e.preventDefault();
      const cleaned = cleanPastedMarkdown(pastedText).replace(/\n/g, ' ').trim();
      const target = e.currentTarget;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      const val = target.value;
      const updated = val.substring(0, start) + cleaned + val.substring(end);
      setTitle(updated);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + cleaned.length;
      }, 0);
      triggerCleanNotice();
    }
  };

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setColor(note.color || '#fef08a');
      setTextColor(note.textColor || '#713f12');
      setIsBold(Boolean(note.isBold));
      setImageUrl(note.imageUrl || null);
    }
  }, [note]);

  if (!isOpen || !note) return null;

  const handleSave = () => {
    onUpdate({
      ...note,
      title: cleanPastedMarkdown(title).replace(/\n/g, ' ').trim() || 'یادداشت چسبان',
      content: content.trim(),
      color,
      textColor,
      isBold,
      imageUrl: imageUrl || undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    onDelete(note.id);
    onClose();
  };

  const handleSelectColor = (bg: string, txt: string) => {
    setColor(bg);
    setTextColor(txt);
  };

  const processImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      setIsUploadingImage(true);
      const compressed = await compressImage(file);
      setImageUrl(compressed);
    } catch (err) {
      console.error('Failed to compress image:', err);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // reset input so the same file can be re-selected if desired
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processImageFile(file);
          break;
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImageFile(file);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 overflow-hidden select-none bg-black/40 flex justify-end"
        onClick={onClose}
        onPaste={handlePaste}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        dir="rtl"
      >
        <div
          className={`w-full sm:w-[600px] md:w-[680px] lg:w-[740px] max-w-full h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-250 transform-gpu ${
            isDraggingOver ? 'ring-4 ring-blue-500/50' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70 shrink-0">
            <div className="flex items-center gap-2">
              <div
                className="w-3.5 h-3.5 rounded-full border border-neutral-300 shadow-xs"
                style={{ backgroundColor: color }}
              />
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-neutral-600" />
                <span>یادداشت صفحه {note.pageNumber}</span>
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 cursor-pointer ios-spring-btn"
                title="حذف یادداشت"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-md shadow-rose-500/25 ios-spring-btn transition-transform"
                title="خروج و بستن"
                aria-label="خروج و بستن"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* Drawer Body Form */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 flex flex-col">
            {/* Note Title */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                عنوان یادداشت
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onPaste={handleTitlePaste}
                placeholder="یک عنوان خلاصه..."
                className="w-full px-3.5 py-2.5 text-sm sm:text-base bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all font-semibold text-neutral-900 shadow-2xs"
              />
            </div>

            {/* Color Palettes */}
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-1">
                <Palette className="w-3.5 h-3.5" />
                <span>رنگ برگه چسبان</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((preset) => {
                  const isSelected = color === preset.bg;
                  return (
                    <button
                      key={preset.bg}
                      onClick={() => handleSelectColor(preset.bg, preset.text)}
                      className={`w-8 h-8 rounded-full border flex items-center justify-center cursor-pointer ios-spring-tool transition-transform ${
                        isSelected
                          ? 'border-neutral-900 scale-110 shadow-sm ring-2 ring-neutral-400'
                          : 'border-neutral-300 hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.bg }}
                      title={preset.name}
                    >
                      {isSelected && (
                        <Check
                          className="w-3.5 h-3.5"
                          style={{ color: preset.text }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formatting & Image Toolbar */}
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-100 flex-wrap">
              <button
                type="button"
                onClick={() => setIsBold(!isBold)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ios-spring-btn transition-colors ${
                  isBold
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
                <span>متن بولد (ضخیم)</span>
              </button>

              {/* One-click markdown and extra symbols cleaner */}
              <button
                type="button"
                onClick={handleCleanContent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 cursor-pointer ios-spring-btn transition-colors shadow-2xs"
                title="حذف خودکار علامت‌های مارک‌داون مانند ##، **، و کدهای اضافی از متن"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>پاکسازی علائم (## و ...)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 cursor-pointer ios-spring-btn transition-colors shadow-2xs"
                title="انتخاب یا پیست عکس در استیکی‌نوت"
              >
                {isUploadingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>{imageUrl ? 'تغییر عکس' : 'افزودن عکس'}</span>
              </button>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 cursor-pointer transition-colors"
                  title="حذف عکس"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف عکس</span>
                </button>
              )}

              <span className="text-[11px] text-neutral-400 mr-auto hidden sm:inline">
                متن پیست‌شده خودکار تمیز می‌شود
              </span>
            </div>

            {/* Cleaned notification banner */}
            {cleanedNotice && (
              <div className="px-3.5 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cleanedNotice}</span>
              </div>
            )}

            {/* Attached Image Preview Card */}
            {imageUrl && (
              <div className="rounded-2xl border border-neutral-200/90 bg-neutral-50 p-3 space-y-2 relative group shadow-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span>تصویر پیوست‌شده</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
                      title="مشاهده اندازه کامل"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>مشاهده کامل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl(null)}
                      className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100/70 transition-colors cursor-pointer"
                      title="حذف تصویر"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => setIsLightboxOpen(true)}
                  className="relative rounded-xl overflow-hidden border border-neutral-200 bg-white cursor-pointer max-h-56 flex items-center justify-center group/img shadow-2xs"
                >
                  <img
                    src={imageUrl}
                    alt="تصویر یادداشت چسبان"
                    className="w-full h-auto max-h-56 object-contain rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white gap-1.5 text-xs font-bold">
                    <Maximize2 className="w-4 h-4" />
                    <span>کلیک برای مشاهده بزرگ‌تر</span>
                  </div>
                </div>
              </div>
            )}

            {/* Elongated Note Content Textarea (تکست‌باکس کشیده، مرتفع و جادار) */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[300px]">
              <label className="block text-xs font-semibold text-neutral-600 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>متن یادداشت</span>
              </label>
              <div
                className="rounded-2xl p-4 sm:p-5 shadow-md flex-1 flex flex-col min-h-[300px] sm:min-h-[360px] transition-colors"
                style={{ backgroundColor: color }}
              >
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onPaste={handleContentPaste}
                  placeholder="متن نکته یا خلاصه این بخش از کتاب یا جزوه را بنویسید (امکان پیست عکس با Ctrl+V وجود دارد - علامت‌های اضافی مانند ## خودکار پاک می‌شوند)..."
                  className="w-full flex-1 bg-transparent resize-y border-none focus:outline-none text-sm sm:text-base leading-relaxed font-sans placeholder:text-neutral-500/70"
                  style={{
                    color: textColor,
                    fontWeight: isBold ? 700 : 400,
                    minHeight: '260px',
                  }}
                  rows={14}
                />
              </div>
            </div>

            {/* Creation date info */}
            {note.createdAt && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono pt-1">
                <Clock className="w-3 h-3" />
                <span>ایجاد شده در: {new Date(note.createdAt).toLocaleDateString('fa-IR')}</span>
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-neutral-200 bg-neutral-50/80 flex items-center justify-between gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-3 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
            >
              انصراف
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ios-spring-btn"
            >
              <Check className="w-4 h-4" />
              <span>ذخیره تغییرات</span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal for Sticky Note Image */}
      {isLightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-ios-popover-open"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="absolute -top-12 left-0 sm:-left-12 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-colors shadow-lg"
              title="بستن تصویر"
            >
              <X className="w-6 h-6 stroke-[2.5]" />
            </button>
            <img
              src={imageUrl}
              alt="تصویر در اندازه کامل"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/20"
            />
          </div>
        </div>
      )}
    </>
  );
};
