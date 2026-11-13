import type { BadgeTone } from '@kore-io/design';
import { Check, Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PartyListItemResponseDeliveryStatus } from '../../../shared/api/generated/model';

/**
 * Selo do envio, como no Badge do DS (o ícone de 14 px, traço 2,4 no Check): a lista de
 * grupos e o cartão Envios do Dashboard.
 */
export const deliveryBadges: Record<
  PartyListItemResponseDeliveryStatus,
  { tone: BadgeTone; icon?: ReactNode }
> = {
  not_sent: { tone: 'neutral' },
  sent: { tone: 'info', icon: <Send /> },
  viewed: { tone: 'warning', icon: <Clock /> },
  responded: { tone: 'success', icon: <Check strokeWidth={2.4} /> },
};
