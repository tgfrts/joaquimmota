import data from './sample-content.json';
import sourceProperties from './buy-properties-source.json';
import { recordsFromContent, selectAvailableProperties, selectFeaturedProperties, type CmsRecord } from './cms-content';
const records = recordsFromContent(data);
// The enum values and public labels are pinned in the source payload contract.
const marketBannerLabels: Record<string, string> = { new: 'Novidade', newPrice: 'Novo Preço', openHouse: 'Open House', reserved: 'Reservado' };
function cardFromRecord(own: CmsRecord, fallback?: typeof sourceProperties[number]) {
  return {
    ...fallback,
    legacyId: String(own.legacyId ?? own._id),
    slug: own.slug?.current ?? own.sourceSlug ?? fallback?.slug,
    image: fallback?.image,
    imageWidth: fallback?.imageWidth,
    imageHeight: fallback?.imageHeight,
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
    label: own.listingStatus === 'reserved' ? 'Reservado' : own.marketBanner ? (marketBannerLabels[own.marketBanner] ?? own.marketBanner) : '',
  };
}
export const availableProperties = selectAvailableProperties(records).map(record =>
  cardFromRecord(record, sourceProperties.find(item => item.legacyId === record.legacyId)));
export const featuredProperties = selectFeaturedProperties(records).map(record =>
  cardFromRecord(record, sourceProperties.find(item => item.legacyId === record.legacyId)));
