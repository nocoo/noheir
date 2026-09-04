"use client";

import { Separator as BasaltSeparator } from "@nocoo/basalt";
import type * as React from "react";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof BasaltSeparator>) {
  return (
    <BasaltSeparator
      decorative={decorative}
      orientation={orientation}
      className={cn(className)}
      {...props}
    />
  );
}

export { Separator };
