import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, BookOpen, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabaseClient";

interface Material {
  id: string;
  slug: string;
  title: string;
  icon: string;
  instructor: string;
  second_instructor: string | null;
  teaching_assistants: string[];
  articles: { id: string; title: string; blogUrl: string }[];
  sections_content: { id: string; title: string; description: string }[];
  sort_order: number;
}

export function MaterialsEditor() {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: "",
    title: "",
    icon: "📚",
    instructor: "",
    second_instructor: "",
    teaching_assistants: "",
    articles: "",
    sections_content: "",
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("course_materials").select("*");
    const sorted = (data ?? []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    setMaterials(sorted as Material[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const resetForm = () => {
    setForm({ slug: "", title: "", icon: "📚", instructor: "", second_instructor: "", teaching_assistants: "", articles: "", sections_content: "" });
    setShowAdd(false);
    setEditId(null);
  };

  const parseJSON = (str: string, fallback: unknown) => {
    try { return JSON.parse(str); } catch { return fallback; }
  };

  const handleAdd = async () => {
    const tas = form.teaching_assistants.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.rpc("add_material", {
      p_slug: form.slug,
      p_title: form.title,
      p_icon: form.icon,
      p_instructor: form.instructor,
      p_second_instructor: form.second_instructor || null,
      p_teaching_assistants: tas,
      p_articles: parseJSON(form.articles, []),
      p_sections_content: parseJSON(form.sections_content, []),
      p_pdf_url: null,
    });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تمت الإضافة", description: `تمت إضافة المادة "${form.title}".` });
      resetForm();
      await load();
    }
  };

  const handleEdit = async () => {
    if (!editId) return;
    const tas = form.teaching_assistants.split(",").map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.rpc("update_material", {
      p_id: editId,
      p_title: form.title,
      p_icon: form.icon,
      p_instructor: form.instructor,
      p_second_instructor: form.second_instructor || null,
      p_teaching_assistants: tas,
      p_articles: form.articles ? parseJSON(form.articles, []) : null,
      p_sections_content: form.sections_content ? parseJSON(form.sections_content, []) : null,
      p_pdf_url: null,
    });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم التحديث", description: "تم تحديث المادة." });
      resetForm();
      await load();
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const { error } = await supabase.rpc("delete_material", { p_id: id });
    if (error) {
      toast({ variant: "destructive", title: "خطأ", description: error.message });
    } else {
      toast({ title: "تم الحذف", description: `تم حذف "${title}".` });
      await load();
    }
  };

  const startEdit = (m: Material) => {
    setEditId(m.id);
    setForm({
      slug: m.slug,
      title: m.title,
      icon: m.icon,
      instructor: m.instructor,
      second_instructor: m.second_instructor ?? "",
      teaching_assistants: (m.teaching_assistants ?? []).join(", "),
      articles: JSON.stringify(m.articles ?? [], null, 2),
      sections_content: JSON.stringify(m.sections_content ?? [], null, 2),
    });
    setShowAdd(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            محرر المواد
          </CardTitle>
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="gap-1">
            <Plus className="h-3 w-3" /> إضافة مادة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add/Edit Form */}
        {(showAdd || editId) && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {showAdd && (
                <div>
                  <Label className="text-xs">المعرف (Slug)</Label>
                  <Input className="h-8 text-sm" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="مثال: networking" />
                </div>
              )}
              <div>
                <Label className="text-xs">العنوان</Label>
                <Input className="h-8 text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اسم المادة" />
              </div>
              <div>
                <Label className="text-xs">الأيقونة (emoji)</Label>
                <Input className="h-8 text-sm" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="📚" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">المحاضر</Label>
                <Input className="h-8 text-sm" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} placeholder="د. ..." />
              </div>
              <div>
                <Label className="text-xs">المحاضر الثاني</Label>
                <Input className="h-8 text-sm" value={form.second_instructor} onChange={(e) => setForm({ ...form, second_instructor: e.target.value })} placeholder="اختياري" />
              </div>
              <div>
                <Label className="text-xs">المعيدين (مفصولة بفاصلة)</Label>
                <Input className="h-8 text-sm" value={form.teaching_assistants} onChange={(e) => setForm({ ...form, teaching_assistants: e.target.value })} placeholder="م. أحمد, م. سارة" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">المقالات (JSON)</Label>
                <textarea className="w-full h-20 rounded-md border bg-background px-3 py-2 text-xs font-mono" value={form.articles} onChange={(e) => setForm({ ...form, articles: e.target.value })} placeholder='[{"id":"1","title":"...","blogUrl":"..."}]' />
              </div>
              <div>
                <Label className="text-xs">محتوى الأقسام (JSON)</Label>
                <textarea className="w-full h-20 rounded-md border bg-background px-3 py-2 text-xs font-mono" value={form.sections_content} onChange={(e) => setForm({ ...form, sections_content: e.target.value })} placeholder='[{"id":"s1","title":"...","description":"..."}]' />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={resetForm}><X className="h-3 w-3" /> إلغاء</Button>
              <Button size="sm" onClick={editId ? handleEdit : handleAdd}><Check className="h-3 w-3" /> {editId ? "تحديث" : "إضافة"}</Button>
            </div>
          </div>
        )}

        {/* Materials List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        ) : (
          <div className="space-y-2">
            {materials.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className="text-2xl shrink-0">{m.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{m.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.instructor}
                    {m.second_instructor ? ` · ${m.second_instructor}` : ""}
                    {m.teaching_assistants?.length ? ` · ${m.teaching_assistants.length} TAs` : ""}
                    {m.articles?.length ? ` · ${m.articles.length} articles` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(m)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id, m.title)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
