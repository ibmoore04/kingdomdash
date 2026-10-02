/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    google?: {
      maps?: any
    }
  }

  namespace google {
    namespace maps {
      type Map = any
      type Marker = any
      type Circle = any
      type MapMouseEvent = any
      type Point = any
    }
  }
}

export {}
