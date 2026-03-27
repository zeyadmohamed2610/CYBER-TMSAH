import { useEffect, useState } from "react";
import { BookOpen, Calendar, Plus, Users, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { attendanceService } from "../services/attendanceService";
import type { Lecture } from "../types";

interface Props {
  fixedSubjectId?: string;
  onSelectLecture: (lecture: Lecture) => void;
}

export function LectureManagementPanel({ fixedSubjectId, onSelectLecture }: Props) {
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = await attendanceService.fetchLectures(fixedSubjectId);
    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
      setLectures(result.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [fixedSubjectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixedSubjectId) return;
    setCreating(true);
    const result = await attendanceService.createLecture(fixedSubjectId, title || "Lecture");
    if (result.error) {
      toast({ variant: "destructive", title: "Error", description: result.error });
    } else {
      toast({ title: "Created", description: `Lecture "${title || "Lecture"}" created.` });
      setTitle("");
      setShowCreate(false);
      await load();
    }
    setCreating(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" />
            Lectures
          </CardTitle>
          {fixedSubjectId && (
            <Button
              variant={showCreate ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowCreate(!showCreate)}
              className="gap-1"
            >
              <Plus className="h-3 w-3" />
              New Lecture
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showCreate && fixedSubjectId && (
          <form onSubmit={handleCreate} className="flex items-end gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="lecture-title" className="text-xs">Lecture Title</Label>
              <Input
                id="lecture-title"
                placeholder="e.g. Lecture 5 - Network Security"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <Button type="submit" size="sm" disabled={creating} className="h-8">
              {creating ? "Creating..." : "Create"}
            </Button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : lectures.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No lectures yet</p>
            <p className="text-xs text-muted-foreground/70">Create a lecture to start tracking attendance</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lectures.map((lec) => (
              <button
                key={lec.id}
                onClick={() => onSelectLecture(lec)}
                className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{lec.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {lec.subject_name} &middot; {formatDate(lec.lecture_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="h-3 w-3" />
                    {lec.session_count ?? 0}
                  </div>
                  <Badge variant={lec.attendee_count ?? 0 > 0 ? "default" : "secondary"} className="gap-1">
                    <Users className="h-3 w-3" />
                    {lec.attendee_count ?? 0}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
