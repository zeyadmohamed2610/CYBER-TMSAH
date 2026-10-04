import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";
import { Menu, PanelRightClose, PanelRightOpen, X, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface DashboardDestination {
  value: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  category?: string;
  badge?: number;
}
interface Props {
  items: DashboardDestination[];
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  title: string;
  groups?: { id: string; label: string }[];
  compactMobile?: boolean;
}
export function DashboardWorkspace({
  items,
  value,
  onValueChange,
  children,
  title,
  groups,
  compactMobile = false,
}: Props) {
  const [open, setOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setDesktop(query.matches);
      if (query.matches) setOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const selected = items.find((i) => i.value === value) ?? items[0];
  const priority = compactMobile
    ? items
    : [...items].sort((a, b) => {
        const order = ["schedule", "lectures", "users", "records", "attendance-records"];
        const rank = (item: DashboardDestination) => {
          const i = order.indexOf(item.value);
          return i < 0 ? order.length : i;
        };
        return rank(a) - rank(b);
      });
  const mobileItems = priority.slice(0, 4);
  const shortLabel = (item: DashboardDestination) =>
    item.shortLabel ??
    (
      {
        schedule: "الجدول",
        lectures: "الجلسات",
        users: "الحسابات",
        records: "السجل",
        "attendance-records": "السجل",
        stats: "الإحصاءات",
        profile: "بياناتي",
      } as Record<string, string>
    )[item.value] ??
    item.label;
  const sections = groups ?? [{ id: "all", label: "أقسام المنصة" }];
  const select = (next: string) => {
    onValueChange(next);
    setOpen(false);
  };
  const badge = (item: DashboardDestination) =>
    item.badge && item.badge > 0 ? (
      <span className="shrink-0 rounded-full bg-purple-500/15 px-2 py-0.5 text-xs tabular-nums text-purple-200">
        {item.badge}
        <span className="sr-only"> عناصر جديدة</span>
      </span>
    ) : null;
  const links = (drawer: boolean) =>
    sections.map((group) => (
      <div key={group.id} className="w-full space-y-1">
        {!collapsed || drawer ? (
          <p className="px-3 pb-1 pt-4 text-xs font-semibold text-slate-400">{group.label}</p>
        ) : null}
        {items
          .filter((item) => group.id === "all" || item.category === group.id)
          .map((item) => {
            const Icon = item.icon;
            const className = cn(
              "min-h-11 w-full rounded-xl border border-transparent px-3 py-2.5 text-sm font-semibold flex items-center gap-3 text-start whitespace-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1020]",
              value === item.value
                ? "bg-purple-500/15 border-purple-400/25 text-purple-200"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
              collapsed && !drawer && "justify-center px-2",
            );
            const content = (
              <>
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                {(!collapsed || drawer) && (
                  <>
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {badge(item)}
                  </>
                )}
              </>
            );
            return drawer ? (
              <button
                key={item.value}
                type="button"
                className={className}
                aria-current={value === item.value ? "page" : undefined}
                onClick={() => select(item.value)}
              >
                {content}
              </button>
            ) : (
              <TabsTrigger
                key={item.value}
                value={item.value}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
                className={className}
              >
                {content}
              </TabsTrigger>
            );
          })}
      </div>
    ));
  return (
    <Tabs
      value={value}
      onValueChange={onValueChange}
      orientation={desktop ? "vertical" : "horizontal"}
      dir="rtl"
      className={cn(
        "dashboard-workspace grid min-w-0 gap-4 pb-24 lg:pb-0 lg:gap-6",
        collapsed ? "lg:grid-cols-[5rem_minmax(0,1fr)]" : "lg:grid-cols-[15rem_minmax(0,1fr)]",
      )}
    >
      <aside
        aria-label="التنقل الرئيسي"
        className="hidden lg:block sticky top-24 self-start rounded-2xl border border-border bg-card p-3 max-h-[calc(100dvh-7rem)] overflow-y-auto"
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 border-b border-white/10 pb-3",
            collapsed && "justify-center",
          )}
        >
          {!collapsed && <p className="text-sm font-bold text-white">{title}</p>}
          <button
            type="button"
            aria-label={collapsed ? "توسيع القائمة" : "تصغير القائمة"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
          >
            {collapsed ? (
              <PanelRightOpen className="h-5 w-5" />
            ) : (
              <PanelRightClose className="h-5 w-5" />
            )}
          </button>
        </div>
        <TabsList
          aria-label="أقسام لوحة التحكم"
          className="flex h-auto w-full flex-col items-stretch justify-start gap-1 bg-transparent p-0"
        >
          {desktop && links(false)}
        </TabsList>
      </aside>
      <div className="min-w-0 space-y-4">
        {!desktop && (
          <div className="lg:hidden rounded-2xl border border-border bg-card p-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label="فتح قائمة التنقل"
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  <Menu aria-hidden="true" className="h-5 w-5 text-purple-300" />
                  <span className="min-w-0 flex-1 font-bold text-white">{selected?.label}</span>
                  <span className="text-xs text-slate-400">القائمة</span>
                </button>
              </DialogTrigger>
              <DialogContent
                dir="rtl"
                className="inset-y-0 right-0 left-auto top-0 flex h-[100dvh] w-[min(88vw,22rem)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-y-0 border-l border-r-0 border-white/10 bg-[#0b1020] p-4 shadow-2xl data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 [&>button:last-child]:hidden"
              >
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label="إغلاق القائمة"
                    className="absolute left-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </DialogClose>
                <DialogHeader className="border-b border-white/10 pb-4 pl-12 text-right">
                  <DialogTitle className="text-white">{title}</DialogTitle>
                  <DialogDescription>اختر الصفحة التي تريد الوصول إليها</DialogDescription>
                </DialogHeader>
                <nav
                  aria-label="قائمة التنقل"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]"
                >
                  {links(true)}
                </nav>
              </DialogContent>

              {/* Keep the dock relative to the viewport, outside animated page containers. */}
              {createPortal(
                <nav
                  aria-label="اختصارات لوحة التحكم"
                  className="mobile-dock grid grid-cols-5 gap-1 lg:hidden"
                >
                  <TabsList
                    aria-label="التنقل الرئيسي للهاتف"
                    className="col-span-4 grid h-auto w-full grid-cols-4 gap-1 bg-transparent p-0"
                  >
                    {mobileItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <TabsTrigger
                          key={item.value}
                          value={item.value}
                          aria-label={item.label}
                          className="min-h-14 min-w-0 flex-col gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold whitespace-normal data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
                        >
                          <Icon aria-hidden="true" className="h-5 w-5" />
                          <span>{shortLabel(item)}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="المزيد من الصفحات"
                    aria-expanded={open}
                    className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Menu aria-hidden="true" className="h-5 w-5" />
                    <span>المزيد</span>
                  </button>
                </nav>,
                document.body,
              )}
            </Dialog>
          </div>
        )}
        {children}
      </div>
    </Tabs>
  );
}
