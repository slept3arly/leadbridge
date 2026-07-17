export interface ParserManifest {
  key: string;
  name: string;
  version: string;
  description: string;
  providerTypesSupported: string[];
  developerNotes: string;
  supportsAttachments: boolean;
  enabled: boolean;
}
