import * as React from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends React.ComponentProps<"div"> {
  /**
   * Set to `false` to opt out of Basalt's automatic surface background styling
   * ([data-basalt-surface]). When not specified, cards automatically opt out if an
   * explicit background utility class (e.g. `bg-primary/5`, `dark:bg-*`) is provided.
   */
  surface?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, surface, ...props }, ref) => {
    // If an explicit background is requested via className or surface is explicitly false,
    // do not set data-basalt-surface, which would override the utility background
    // through Basalt's [data-basalt-surface-root] [data-basalt-surface] CSS rule.
    const hasCustomBg = className
      ? /(?:^|\s)(?:[a-z0-9_-]+:)*bg-(?!basalt-card(?:\s|$))/.test(className)
      : false;
    const enableSurface = surface ?? !hasCustomBg;

    return (
      <div
        ref={ref}
        data-slot="card"
        {...(enableSurface ? { "data-basalt-surface": "" } : {})}
        className={cn(
          "bg-basalt-card text-basalt-card-foreground flex flex-col rounded-basalt-lg border-0 shadow-none",
          className,
        )}
        {...props}
      />
    );
  },
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 p-4", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<"h3">>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      data-slot="card-title"
      className={cn(
        "text-lg font-semibold leading-none tracking-tight text-basalt-foreground",
        className,
      )}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.ComponentProps<"p">>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      data-slot="card-description"
      className={cn("text-basalt-muted-foreground text-sm", className)}
      {...props}
    />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("flex-1 min-h-0 px-4 pb-4 pt-0", className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn("flex items-center p-4 pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
