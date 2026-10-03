import { deleteUserAvatar, saveUserAvatar } from "@/features/accounts/services/avatarService";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Camera,
  Check,
  Crop,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CircularImageCropper } from "./CircularImageCropper";

interface AvatarStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  currentAvatarUrl: string | null;
  userInitial: string;
  onAvatarUpdated: (newUrl: string | null) => void;
}

export default function AvatarStudioDialog({
  open,
  onOpenChange,
  userId,
  currentAvatarUrl,
  userInitial,
  onAvatarUpdated,
}: AvatarStudioDialogProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Camera capture state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset selected avatar whenever dialog opens
  useEffect(() => {
    if (open) {
      setSelectedAvatar(currentAvatarUrl);
      setImageToCrop(null);
      stopCamera();
    } else {
      setImageToCrop(null);
      stopCamera();
    }
  }, [open, currentAvatarUrl]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  };

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("متصفحك لا يدعم الوصول المباشر للكاميرا");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      toast.error("تعذر فتح الكاميرا، يرجى التحقق من إذن الوصول للكاميرا");
    } finally {
      setCameraLoading(false);
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 720;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw full uncropped frame so user can crop and frame it as they like
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    stopCamera();
    setImageToCrop(dataUrl);
    toast.info("تم التقاط الصورة! يمكنك الآن قص وتوسيط الفريم الدائري.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً، اختر صورة أصغر من 15 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      toast.error("فشل قراءة ملف الصورة المختارة");
    };
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageToCrop(reader.result);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveAvatar = async () => {
    if (!userId) {
      toast.error("يرجى تسجيل الدخول أولاً");
      return;
    }

    try {
      setSaving(true);
      if (!selectedAvatar) {
        await deleteUserAvatar(userId);
        onAvatarUpdated(null);
        toast.success("تمت إزالة الصورة الشخصية والعودة للافتراضي.");
      } else {
        const { url, error } = await saveUserAvatar(userId, selectedAvatar);
        if (error) {
          toast.warning("تم حفظ الصورة في حسابك.");
        } else {
          toast.success("تم حفظ وتحديث صورتك الشخصية على جميع أجهزتك بنجاح!");
        }
        onAvatarUpdated(url);
      }
      onOpenChange(false);
    } catch (err) {
      console.error("Save avatar error:", err);
      toast.error("حدث خطأ أثناء حفظ الصورة");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatar(null);
    stopCamera();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl bg-[#080C1B]/95 border border-purple-500/30 text-white rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl [&>button:last-child]:hidden"
        dir="rtl"
      >
        <DialogHeader className="text-start pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                {imageToCrop ? (
                  <Crop className="w-5 h-5 text-cyan-200" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                  <span>{imageToCrop ? "محرر وقص الصورة الشخصية" : "الصورة الشخصية الحقيقية"}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  {imageToCrop
                    ? "حدد الجزء المطلوب للظهور داخل الفريم الدائري لحسابك"
                    : "ارفع صورتك من هاتفك أو جهازك لتظهر في حسابك على جميع الأجهزة"}
                </DialogDescription>
              </div>
            </div>

            {/* X Close Button at top left (visual left in RTL) */}
            <button
              type="button"
              onClick={() => {
                if (imageToCrop) {
                  setImageToCrop(null);
                } else {
                  onOpenChange(false);
                }
              }}
              className="shrink-0 w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-all duration-200 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </DialogHeader>

        {imageToCrop ? (
          <div className="py-2">
            <CircularImageCropper
              imageSrc={imageToCrop}
              onCropComplete={(croppedDataUrl) => {
                setSelectedAvatar(croppedDataUrl);
                setImageToCrop(null);
                toast.success("تم ضبط الصورة. اضغط حفظ لتظهر في حسابك.");
              }}
              onCancel={() => setImageToCrop(null)}
            />
          </div>
        ) : (
          <>
            {/* Preview Section */}
            <div className="py-4 flex flex-col sm:flex-row items-center justify-center gap-6 bg-black/40 rounded-2xl p-4 border border-white/5">
              <div className="relative group">
                {/* Glowing Ring */}
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-purple-600 via-cyan-500 to-pink-500 p-[3px] shadow-[0_0_35px_rgba(168,85,247,0.45)] transition-all">
                  <div className="w-full h-full rounded-[21px] bg-[#070A18] overflow-hidden flex items-center justify-center relative">
                    {selectedAvatar ? (
                      <img
                        src={selectedAvatar}
                        alt="Avatar preview"
                        className="w-full h-full object-cover select-none"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-purple-700/60 to-indigo-700/60 flex items-center justify-center text-white font-black text-4xl select-none">
                        {userInitial}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status dot */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#070A18] flex items-center justify-center shadow-lg">
                  <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                </div>
              </div>

              <div className="text-center sm:text-start space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-sm font-bold text-white">معاينة الصورة</span>
                </div>
                <p className="text-xs text-slate-400">
                  تظهر هذه الصورة في شريط التنقل، كشوفات الحضور، والملف التعريفي.
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                  {selectedAvatar && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImageToCrop(selectedAvatar)}
                        className="h-8 px-2.5 rounded-xl text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold gap-1.5"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        <span>قص وتعديل الفريم</span>
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        className="h-8 px-2.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إزالة الصورة</span>
                      </Button>
                    </>
                  )}
                  {selectedAvatar !== currentAvatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAvatar(currentAvatarUrl)}
                      className="h-8 px-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 text-xs font-semibold gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>استعادة السابقة</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Upload & Camera Actions */}
            <div className="space-y-4 pt-1">
              {isCameraActive ? (
                <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 bg-black aspect-video max-h-56 flex flex-col items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 bg-black/60 backdrop-blur-md py-2 px-4">
                    <Button
                      type="button"
                      onClick={captureCameraPhoto}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold gap-2 h-9 px-4 shadow-lg"
                    >
                      <Camera className="w-4 h-4" />
                      <span>التقاط الصورة الآن</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={stopCamera}
                      className="border-white/20 bg-black/50 hover:bg-white/10 text-white rounded-xl text-xs font-bold h-9"
                    >
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Upload from file button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/60 transition-all text-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/20 group-hover:bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-purple-300 mb-2 transition-transform group-hover:scale-110">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                      رفع صورة من جهازك
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      اختر صورة وسيقوم المحرر بقصها بالفريم الدائري
                    </span>
                  </button>

                  {/* Take with camera button */}
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={cameraLoading}
                    className="group flex flex-col items-center justify-center p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-500/40 transition-all text-center cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 group-hover:bg-cyan-600/30 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-2 transition-transform group-hover:scale-110">
                      {cameraLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                      التقاط صورة بالكاميرا
                    </span>
                    <span className="text-[11px] text-slate-400 mt-1">
                      كاميرا الهاتف أو الكمبيوتر المباشرة
                    </span>
                  </button>
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
              />

              <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-300">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <span>احفظ صورتك لتظهر في حسابك على جميع أجهزتك.</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-slate-400 hover:text-white rounded-xl text-xs h-10 px-4"
              >
                إلغاء
              </Button>

              <Button
                type="button"
                onClick={handleSaveAvatar}
                disabled={saving}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs h-10 px-6 gap-2 shadow-[0_4px_20px_rgba(124,58,237,0.4)] transition-all hover:scale-[1.02]"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والتحديث...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ وتطبيق الصورة</span>
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
