/// <reference types="vite/client" />

declare module 'react-virtuoso' {
  import type { CSSProperties, ReactNode } from 'react'

  export interface VirtuosoProps<T = unknown> {
    data?: readonly T[]
    itemContent?: (index: number, item: T) => ReactNode
    style?: CSSProperties
    [key: string]: unknown
  }

  export function Virtuoso<T = unknown>(props: VirtuosoProps<T>): JSX.Element
}
