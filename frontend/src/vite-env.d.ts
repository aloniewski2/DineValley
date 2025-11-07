/// <reference types="vite/client" />

interface ImportMetaEnv extends Readonly<Record<string, string | undefined>> {
  readonly VITE_GOOGLE_PLACES_API_KEY?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.png" {
  const src: string;
  export default src;
}
