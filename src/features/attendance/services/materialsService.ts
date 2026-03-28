import { supabase } from "@/lib/supabaseClient";
import type { AttendanceApiResponse } from "../types";

const ok = <T>(data: T): AttendanceApiResponse<T> => ({ data, error: null });
const fail = <T>(operation: string, error: unknown): AttendanceApiResponse<T> => ({
  data: null,
  error: typeof error === "object" && error && "message" in error ? String((error as Record<string, unknown>).message) : String(error),
});

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
  async fetchMaterials(): Promise<AttendanceApiResponse<CourseMaterial[]>> {
    const { data, error } = await supabase
      .from("course_materials")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return fail("fetchMaterials", error);
    }

    return ok((data ?? []).map((row: Record<string, unknown>) => ({
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
    })));
  },

  /** Fetch a single material by slug */
  async fetchMaterialBySlug(slug: string): Promise<AttendanceApiResponse<CourseMaterial | null>> {
    const { data, error } = await supabase
      .from("course_materials")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      return fail("fetchMaterialBySlug", error);
    }

    if (!data) {
      return ok(null);
    }

    const row = data as Record<string, unknown>;
    return ok({
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
    });
  },
};
