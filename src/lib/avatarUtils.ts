import { supabase } from "@/lib/supabaseClient";

/**
 * Resizes and compresses an image file into a square WebP/JPEG data URL
 */
export async function compressAndCropImage(
  file: File,
  maxDimension = 512,
  quality = 0.88
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("فشل قراءة ملف الصورة."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("فشل تحميل محتوى الصورة."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("تعذر تشغيل معالج الصور (Canvas Context)."));
          return;
        }

        // Calculate center square crop
        const minSide = Math.min(img.width, img.height);
        const startX = (img.width - minSide) / 2;
        const startY = (img.height - minSide) / 2;

        const targetSize = Math.min(minSide, maxDimension);
        canvas.width = targetSize;
        canvas.height = targetSize;

        // Draw cropped and scaled image
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(
          img,
          startX,
          startY,
          minSide,
          minSide,
          0,
          0,
          targetSize,
          targetSize
        );

        // Try WebP first, fallback to JPEG
        try {
          const webpData = canvas.toDataURL("image/webp", quality);
          if (webpData.startsWith("data:image/webp")) {
            resolve(webpData);
            return;
          }
        } catch {
          // ignore and fallback
        }

        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an avatar image for a user.
 * Attempts Supabase storage first; if unavailable, uses the compressed data URL directly.
 */
export async function saveUserAvatar(
  userId: string,
  imageDataUrl: string
): Promise<{ url: string; error?: string }> {
  try {
    // 1. Check if it's already a hosted URL (e.g. from preset or external)
    if (imageDataUrl.startsWith("http://") || imageDataUrl.startsWith("https://") || imageDataUrl.startsWith("data:image/svg+xml")) {
      await persistAvatarMetadata(userId, imageDataUrl);
      return { url: imageDataUrl };
    }

    // 2. Try Supabase Storage upload
    try {
      const base64Data = imageDataUrl.split(",")[1];
      const mimeMatch = imageDataUrl.match(/^data:(.*?);base64/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/webp";
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });

      const extension = mimeType.includes("jpeg") ? "jpg" : "webp";
      const fileName = `${userId}/avatar_${Date.now()}.${extension}`;

      // Upload to avatars bucket
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, blob, {
          cacheControl: "3600",
          upsert: true,
          contentType: mimeType,
        });

      if (!uploadError) {
        const { data: { publicUrl } } = supabase.storage
          .from("avatars")
          .getPublicUrl(fileName);

        if (publicUrl) {
          await persistAvatarMetadata(userId, publicUrl);
          return { url: publicUrl };
        }
      }
    } catch (storageErr) {
      console.warn("Storage upload skipped or unavailable, falling back to data URL:", storageErr);
    }

    // 3. Fallback: Save compressed data URL directly in metadata
    await persistAvatarMetadata(userId, imageDataUrl);
    return { url: imageDataUrl };
  } catch (err) {
    console.error("Failed to save avatar:", err);
    return {
      url: imageDataUrl,
      error: err instanceof Error ? err.message : "فشل حفظ الصورة الشخصية",
    };
  }
}

/**
 * Persists avatar URL to Supabase Auth metadata, localStorage, and public.users if column exists
 */
async function persistAvatarMetadata(userId: string, avatarUrl: string | null) {
  // Update local storage for instant sync across tabs and reloads
  if (avatarUrl) {
    localStorage.setItem(`cyber_avatar_${userId}`, avatarUrl);
  } else {
    localStorage.removeItem(`cyber_avatar_${userId}`);
  }

  // Update Supabase Auth user_metadata
  await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });

  // Try updating public.users table if avatar_url column happens to exist
  try {
    await supabase
      .from("users")
      .update({ avatar_url: avatarUrl } as Record<string, unknown>)
      .eq("auth_id", userId);
  } catch {
    // Column might not exist in users table; safely ignored since user_metadata is source of truth
  }
}

/**
 * Removes user avatar and resets to default initials
 */
export async function deleteUserAvatar(userId: string): Promise<void> {
  await persistAvatarMetadata(userId, null);
}
