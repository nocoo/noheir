import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ReactNode } from 'react';

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
  className
}: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            {Icon ? (
              <CardTitle className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
            ) : (
              <CardTitle>{title}</CardTitle>
            )}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
