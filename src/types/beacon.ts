export enum BeaconType {
  Person = 0,
  Assembly = 1,
}

export type RssiBucket = 'very-near' | 'near' | 'medium' | 'far';

export interface BeaconObservation {
  deviceId: string;
  beaconType: BeaconType;
  isRelay: boolean;
  protocolVersion: number;
  hopsRemaining: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  sequence: number;
  /** The sender's own GPS accuracy in metres, as reported by them (255 = unknown). */
  accuracyMeters: number;
}

export interface BeaconState extends BeaconObservation {
  rawRssi: number;
  smoothedRssi: number;
  bucket: RssiBucket;
  lastSeenAt: number;
}
