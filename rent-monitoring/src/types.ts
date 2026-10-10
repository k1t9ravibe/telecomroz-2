export type PropertyType =
  | 'Жилое'
  | 'Офисное'
  | 'Административное'
  | 'Производственное'
  | 'Складское'
  | 'Техническое'
  | 'Другое';

/** Статус рассмотрения заявки (рабочий процесс). */
export type RequestStatus =
  | 'review'
  | 'justification_requested'
  | 'justification_received'
  | 'approved'
  | 'rejected';

/** Результат сравнения с ценовым ориентиром. */
export type Compliance = 'over' | 'within' | 'nodata';

export type UserRole = 'specialist' | 'customer';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  /** Содержимое файла в виде data URL (для демонстрационного хранения). */
  dataUrl: string;
}

export interface Remark {
  id: string;
  role: UserRole;
  author: string;
  text: string;
  createdAt: string;
  attachments: Attachment[];
}

export type ComparableLevel = 'settlement_type_area' | 'settlement_type' | 'region_type_area' | 'region_type';

export interface BenchmarkResult {
  value: number | null;
  count: number;
  level: ComparableLevel | null;
  periodFrom: string;
  periodTo: string;
}

export interface RentRequest {
  id: string;
  number: string;
  createdAt: string;
  updatedAt: string;
  region: string;
  settlement: string;
  propertyType: PropertyType;
  address: string;
  area: number;
  monthlyCost: number;
  supplier: string;
  notes: string;
  pricePerM2: number;
  benchmark: number | null;
  benchmarkCount: number;
  benchmarkLevel: ComparableLevel | null;
  deviation: number | null;
  compliance: Compliance;
  status: RequestStatus;
  remarks: Remark[];
  addedToPriceBase: boolean;
  isDemo: boolean;
}

export interface PriceRecord {
  id: string;
  region: string;
  settlement: string;
  propertyType: PropertyType;
  area: number;
  monthlyCost: number;
  pricePerM2: number;
  purchaseDate: string;
  source: string;
  requestId: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface MarketOffer {
  id: string;
  region: string;
  settlement: string;
  address: string;
  propertyType: PropertyType;
  area: number;
  monthlyCost: number;
  pricePerM2: number;
  listingDate: string;
  source: string;
  url: string;
  isDemo: boolean;
  createdAt: string;
}

export interface Settings {
  userName: string;
  role: UserRole;
  benchmarkMonths: number;
  minComparables: number;
  allowFallback: boolean;
  tolerancePercent: number;
  autoAddApproved: boolean;
}
