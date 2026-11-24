/**
 * CDC wastewater adapter boundary (no network access, no health records).
 * Callers must fetch a documented CDC dataset and verify its schema/version.
 * A row lacking required metadata is rejected rather than assumed current.
 */
import { normalizePublicSignal } from './public-evidence-watch.mjs';

export function fromCdcWastewaterRecord(record, config) {
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      !config || typeof config !== 'object') throw new Error('invalid_cdc_record');
  const { datasetUrl, datasetId, mapping, claimKey='respiratory-trend' } = config;
  if (typeof datasetId !== 'string' || !/^[a-z0-9]{4}-[a-z0-9]{4}$/i.test(datasetId))
    throw new Error('invalid_cdc_dataset');
  if (!mapping || typeof mapping !== 'object' ||
      !['sourceId', 'region', 'publishedOn', 'observedOn', 'stance'].every(k =>
        typeof mapping[k] === 'string' && /^[A-Za-z_][A-Za-z_0-9]*$/.test(mapping[k])))
    throw new Error('invalid_cdc_mapping');
  if (typeof datasetUrl !== 'string' ||
      !datasetUrl.startsWith('https://data.cdc.gov/resource/'+datasetId))
    throw new Error('invalid_cdc_dataset_url');
  const field=k=>Object.prototype.hasOwnProperty.call(record,mapping[k]) ? record[mapping[k]] : undefined;
  return normalizePublicSignal({
    sourceId: field('sourceId'), claimKey, region:field('region'),
    sourceFamily:'CDC_WASTEWATER', url:datasetUrl, publishedOn:field('publishedOn'),
    observedOn:field('observedOn'), stance:field('stance')
  });
}
