import { ReportReason } from '@prisma/client';

export interface ReportReasonMetadata {
  code: ReportReason;
  label: string;
  weight: number;
  description: string;
}

export const REPORT_REASONS: ReportReasonMetadata[] = [
  { code: 'SEXUAL_CONTENT', label: 'Sexual content', weight: 5, description: 'Sexually explicit material' },
  { code: 'NUDITY', label: 'Nudity', weight: 5, description: 'Nude or exposed imagery' },
  { code: 'HARASSMENT_BULLYING', label: 'Harassment or bullying', weight: 3, description: 'Targeting or intimidating someone' },
  { code: 'HATE_SPEECH', label: 'Hate speech', weight: 5, description: 'Attacks on a protected group' },
  { code: 'VIOLENCE', label: 'Violence', weight: 5, description: 'Violent or graphic content, threats' },
  { code: 'SPAM_SCAM', label: 'Spam or scam', weight: 2, description: 'Misleading, repetitive or fraudulent' },
  { code: 'MISINFORMATION', label: 'Misinformation', weight: 2, description: 'False or misleading information' },
  { code: 'OTHER', label: 'Other', weight: 1, description: 'Something else (add details)' },
];

export const REASON_WEIGHT: Record<ReportReason, number> = {
  SEXUAL_CONTENT: 5,
  NUDITY: 5,
  HARASSMENT_BULLYING: 3,
  HATE_SPEECH: 5,
  VIOLENCE: 5,
  SPAM_SCAM: 2,
  MISINFORMATION: 2,
  OTHER: 1,
};
