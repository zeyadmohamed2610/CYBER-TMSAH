import { useState } from "react";
import { supabase } from "@/shared/api/supabaseClient";
import { useAuth } from "@/features/auth/context/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { learningRequest } from "../services";
import type { AttendanceCase } from "../types";

export function CaseAttachment({
  item,
  student,
  run,
}: {
  item: AttendanceCase;
  student: boolean;
  run: (operation: () => Promise<unknown>) => void;
}) {
  const { user } = useAuth();
  const [link, setLink] = useState("");
  return (
    <div className="space-y-3">
      {student && item.status === "pending" && (
        <label className="block text-sm">
          إرفاق مستند للعذر أو المراجعة (صورة أو PDF، حتى 5 ميجابايت)
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            className="mt-2 block max-w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file || !user) return;
              run(async () => {
                const extensions: Record<string, string> = {
                  "application/pdf": "pdf",
                  "image/jpeg": "jpg",
                  "image/png": "png",
                };
                if (!extensions[file.type] || file.size > 5242880)
                  throw new Error("اختر صورة أو مستندًا بالحجم المسموح.");
                const path = `${user.id}/${item.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
                const result = await supabase.storage
                  .from("attendance-evidence")
                  .upload(path, file, { upsert: false, contentType: file.type });
                if (result.error) throw result.error;
                await learningRequest("academic_case_attachment", {
                  p_case: item.id,
                  p_path: path,
                });
              });
            }}
          />
        </label>
      )}
      {item.file_path && (
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            run(async () => {
              const result = await supabase.storage
                .from("attendance-evidence")
                .createSignedUrl(item.file_path!, 120);
              if (result.error) throw result.error;
              setLink(result.data.signedUrl);
            })
          }
        >
          تجهيز عرض المرفق
        </Button>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-primary underline"
        >
          فتح المرفق — الرابط صالح لمدة دقيقتين
        </a>
      )}
    </div>
  );
}
