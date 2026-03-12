import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

export default function Card({ children, className = '', padding = 'md', ...props }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-soft border border-border-soft ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
