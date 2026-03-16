import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/15 text-primary border border-primary/20',
        secondary: 'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/15 text-destructive border border-destructive/20',
        outline: 'border border-border text-foreground',
        profit: 'bg-[hsl(158_100%_42%/0.12)] text-profit border border-[hsl(158_100%_42%/0.2)]',
        loss: 'bg-destructive/10 text-destructive border border-destructive/20',
        neutral: 'bg-muted text-muted-foreground',
        transfer: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
        card_payment: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
        refund: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
