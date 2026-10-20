import { LayerCard } from "@nocoo/basalt";
import type { ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  icon: Icon,
  children,
  actions,
  className,
}: ChartCardProps) {
  return (
    <LayerCard {...(className ? { className } : {})}>
      <LayerCard.Header className="items-stretch flex-col gap-1.5">
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {Icon ? (
              <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground flex items-center gap-2">
                <Icon className="text-basalt-primary size-5" />
                {title}
              </h3>
            ) : (
              <h3 className="text-lg font-semibold leading-none tracking-tight text-basalt-foreground">
                {title}
              </h3>
            )}
            {description && <p className="text-sm text-basalt-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      </LayerCard.Header>
      <LayerCard.Body className="min-h-0 flex-1">{children}</LayerCard.Body>
    </LayerCard>
  );
}
