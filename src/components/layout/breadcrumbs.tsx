"use client";

import { Breadcrumbs as BasaltBreadcrumbs } from "@nocoo/basalt/components/breadcrumbs";
import type { ReactNode } from "react";

export type BreadcrumbItem = {
  label: ReactNode;
  href?: string;
  icon?: ReactNode;
};

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return className !== undefined ? (
    <BasaltBreadcrumbs items={items} className={className} />
  ) : (
    <BasaltBreadcrumbs items={items} />
  );
}
