import data from './sample-content.json';
import sourceProperties from './buy-properties-source.json';
import { ownRecordByLegacyId, recordsFromContent } from './cms-content';
const records = recordsFromContent(data);
// The enum values and public labels are pinned in the source payload contract.
const marketBannerLabels: Record<string, string> = { new: 'Novidade', newPrice: 'Novo Preço', openHouse: 'Open House', reserved: 'Reservado' };
export const availableProperties = sourceProperties.map((fallback) => {
  const own = ownRecordByLegacyId(records, 'property', fallback.legacyId);
  if (!own) return { ...fallback, cms: undefined, priceOnRequest: false };
  return {
    ...fallback,
    cms: own,
    title: own.title,
    price: String(own.price ?? ''),
    priceOnRequest: own.priceOnRequest === true,
    municipality: own.municipality ?? '',
    parish: own.parish ?? '',
    reference: own.referenceCode ?? '',
    beds: own.bedrooms,
    baths: own.bathrooms,
    parking: own.parkingSpaces,
    area: own.grossArea,
    label: own.marketBanner ? (marketBannerLabels[own.marketBanner] ?? own.marketBanner) : '',
  };
});
