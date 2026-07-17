export type HazardType = 'earthquake' | 'tsunami' | 'flood' | 'volcano' | 'landslide' | 'general';

export interface Territory {
  id: string;
  name: string;
  centroid: { lat: number; lon: number };
}

export interface MitigationArticle {
  id: string;
  /** Many-to-many: one article can apply to several territories. */
  territoryIds: string[];
  hazardType: HazardType;
  title: string;
  /** Shown on the card. */
  excerpt: string;
  /** Shown in the detail modal. */
  body: string;
}
