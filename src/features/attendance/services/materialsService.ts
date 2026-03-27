import { supabase } from "@/lib/supabaseClient";

export interface Article {
  id: string;
  title: string;
  blogUrl: string;
}

export interface SectionContent {
  id: string;
  title: string;
  description: string;
}

export interface CourseMaterial {
  id: string;
  slug: string;
  title: string;
  icon: string;
  instructor: string;
  second_instructor: string | null;
  teaching_assistants: string[];
  articles: Article[];
  sections_content: SectionContent[];
  pdf_url: string | null;
  sort_order: number;
}

export const materialsService = {
  /** Fetch all course materials from DB */
  async fetchMaterials(): Promise<CourseMaterial[]> {
    const { data, error } = await supabase
      .from("course_materials")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to fetch materials:", error);
      return [];
    }

    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      icon: row.icon as string,
      instructor: row.instructor as string,
      second_instructor: (row.second_instructor as string) ?? null,
      teaching_assistants: (row.teaching_assistants as string[]) ?? [],
      articles: (row.articles as Article[]) ?? [],
      sections_content: (row.sections_content as SectionContent[]) ?? [],
      pdf_url: (row.pdf_url as string) ?? null,
      sort_order: (row.sort_order as number) ?? 0,
    }));
  },

  /** Fetch a single material by slug */
  async fetchMaterialBySlug(slug: string): Promise<CourseMaterial | null> {
    const { data, error } = await supabase
      .from("course_materials")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      console.error("Failed to fetch material:", error);
      return null;
    }

    const row = data as Record<string, unknown>;
    return {
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      icon: row.icon as string,
      instructor: row.instructor as string,
      second_instructor: (row.second_instructor as string) ?? null,
      teaching_assistants: (row.teaching_assistants as string[]) ?? [],
      articles: (row.articles as Article[]) ?? [],
      sections_content: (row.sections_content as SectionContent[]) ?? [],
      pdf_url: (row.pdf_url as string) ?? null,
      sort_order: (row.sort_order as number) ?? 0,
    };
  },
};
