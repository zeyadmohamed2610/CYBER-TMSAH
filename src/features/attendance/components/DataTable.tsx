import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
        <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
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
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground">
                  {emptyMessage}
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
