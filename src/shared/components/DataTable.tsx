import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { FileX } from "lucide-react";
import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  cell: (row: T, index?: number) => ReactNode;
  headClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  title: string;
  caption?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyMessage?: string;
}

export const DataTable = <T,>({
  title,
  caption,
  columns,
  rows,
  getRowId,
  emptyMessage = "لا توجد بيانات متاحة.",
}: DataTableProps<T>) => {
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <CardTitle className="text-lg sm:text-xl font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-2 sm:px-6">
        <div className="space-y-3 sm:hidden" aria-label={title}>
          {caption && <p className="text-sm text-muted-foreground">{caption}</p>}
          {!rows.length && <p className="py-6 text-center text-muted-foreground">{emptyMessage}</p>}
          {rows.map((row, index) => (
            <dl key={getRowId(row)} className="rounded-xl border bg-background p-4 space-y-3">
              {columns.map((column) => (
                <div key={column.id} className="min-w-0 space-y-1">
                  <dt className="text-xs text-muted-foreground">{column.header}</dt>
                  <dd className="text-sm break-words [overflow-wrap:anywhere]">
                    {column.cell(row, index)}
                  </dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
        <div
          role="region"
          aria-label={title}
          tabIndex={0}
          className="hidden w-full sm:block sm:overflow-x-auto pb-4 custom-scrollbar"
        >
          <Table className="whitespace-nowrap sm:whitespace-normal">
            {caption ? <TableCaption>{caption}</TableCaption> : null}
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.id} className={column.headClassName}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <FileX className="h-6 w-6 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow key={getRowId(row)}>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.cellClassName}>
                        {column.cell(row, idx)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
