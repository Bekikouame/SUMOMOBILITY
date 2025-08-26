// / src/documents/constants/document-types.constant.ts
export enum DocumentType {
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  IDENTITY_CARD = 'IDENTITY_CARD',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  INSURANCE = 'INSURANCE',
  MEDICAL_CERTIFICATE = 'MEDICAL_CERTIFICATE',
  CRIMINAL_RECORD = 'CRIMINAL_RECORD',
  RESIDENCE_PROOF = 'RESIDENCE_PROOF'
}

export const DOCUMENT_TYPE_CONFIG = {
  [DocumentType.DRIVING_LICENSE]: {
    label: 'Permis de conduire',
    required: true,
    hasExpiration: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.IDENTITY_CARD]: {
    label: 'Carte d\'identité',
    required: true,
    hasExpiration: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.VEHICLE_REGISTRATION]: {
    label: 'Carte grise',
    required: true,
    hasExpiration: false,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.INSURANCE]: {
    label: 'Assurance véhicule',
    required: true,
    hasExpiration: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.MEDICAL_CERTIFICATE]: {
    label: 'Certificat médical',
    required: false,
    hasExpiration: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.CRIMINAL_RECORD]: {
    label: 'Extrait casier judiciaire',
    required: false,
    hasExpiration: true,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  },
  [DocumentType.RESIDENCE_PROOF]: {
    label: 'Justificatif de domicile',
    required: false,
    hasExpiration: false,
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
  }
};