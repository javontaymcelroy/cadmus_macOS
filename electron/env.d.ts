/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    ELECTRON_RENDERER_URL?: string
  }
}
