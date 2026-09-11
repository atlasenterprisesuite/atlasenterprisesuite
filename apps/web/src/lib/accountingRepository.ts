import {
  AccountingRepositoryImpl,
  type AccountingReadGateway,
  type AccountingRepository,
  type AccountingTable,
} from '../../../../packages/accounting/src';
import { atlasRestSelect } from './atlasSession';

export type AtlasAccountingRestSelector = <T>(
  table: AccountingTable,
  columns: string,
  organizationId: string,
) => Promise<T[]>;

export class AtlasRestAccountingReadGateway implements AccountingReadGateway {
  constructor(private readonly selectRows: AtlasAccountingRestSelector = atlasRestSelect) {}

  select<T>(table: AccountingTable, columns: string, organizationId: string): Promise<T[]> {
    return this.selectRows<T>(table, columns, organizationId);
  }
}

export function createAtlasAccountingRepository(
  selectRows: AtlasAccountingRestSelector = atlasRestSelect,
): AccountingRepository {
  return new AccountingRepositoryImpl(new AtlasRestAccountingReadGateway(selectRows));
}
